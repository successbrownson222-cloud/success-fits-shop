from fastapi import APIRouter, Depends, Header, Request, HTTPException
import os, random, time, hmac, hashlib
from pydantic import BaseModel

# Use your existing get_conn style
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    import bcrypt
    HAS_BCRYPT = True
except:
    HAS_BCRYPT = False

router = APIRouter(prefix="/api/payments", tags=["SuccessPay Banking"])
BANK_SECRET = os.getenv("BANK_WEBHOOK_SECRET", "test_secret_123")

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not url: return None
    if "sslmode" in url:
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    else:
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    conn.autocommit = True
    return conn

def hash_pin(pin: str):
    if HAS_BCRYPT: return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    import hashlib; return hashlib.sha256(pin.encode()).hexdigest()

def check_pin(pin: str, hashed: str):
    if HAS_BCRYPT:
        try: return bcrypt.checkpw(pin.encode(), hashed.encode())
        except: return False
    import hashlib; return hashlib.sha256(pin.encode()).hexdigest() == hashed

def gen_account():
    return "99" + str(random.randint(10000000,99999999)) + str(random.randint(10,99))

def ensure_tables(cur):
    cur.execute("CREATE TABLE IF NOT EXISTS sf_wallets (email TEXT PRIMARY KEY, balance INT DEFAULT 0, pin_hash TEXT, virtual_account TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW());")
    cur.execute("CREATE TABLE IF NOT EXISTS sf_transactions (id SERIAL PRIMARY KEY, email TEXT, type TEXT, amount INT, ref TEXT UNIQUE, status TEXT DEFAULT 'success', meta_data JSONB, created_at TIMESTAMP DEFAULT NOW());")

class WalletReq(BaseModel): email: str; pin: str
class PayReq(BaseModel): email: str; order_id: int; pin: str; amount: int

@router.post("/create-wallet")
def create_wallet(req: WalletReq):
    conn = get_conn()
    if not conn: raise HTTPException(500, "DB not connected")
    try:
        with conn.cursor() as cur:
            ensure_tables(cur)
            cur.execute("SELECT virtual_account, balance FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (req.email,))
            row = cur.fetchone()
            if row:
                return {"ok": True, "virtual_account": row['virtual_account'], "balance": row['balance'], "bank": "SUCCESS PAY MFB"}
            v_acc = gen_account()
            cur.execute("INSERT INTO sf_wallets (email, balance, pin_hash, virtual_account) VALUES (%s, %s, %s, %s)", (req.email.lower(), 0, hash_pin(req.pin), v_acc))
            return {"ok": True, "virtual_account": v_acc, "bank": "SUCCESS PAY MFB", "balance": 0}
    finally:
        try: conn.close()
        except: pass

@router.get("/wallet/{email}")
def get_wallet(email: str):
    conn = get_conn()
    if not conn: raise HTTPException(500, "DB not connected")
    try:
        with conn.cursor() as cur:
            ensure_tables(cur)
            cur.execute("SELECT email, balance, virtual_account FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (email,))
            row = cur.fetchone()
            if not row: raise HTTPException(404, "Wallet not found")
            return {"ok": True, "email": row['email'], "balance": row['balance'], "balance_naira": row['balance']/100, "virtual_account": row['virtual_account']}
    finally:
        try: conn.close()
        except: pass

@router.post("/pay-order")
def pay_order(req: PayReq):
    conn = get_conn()
    if not conn: raise HTTPException(500, "DB not connected")
    try:
        with conn.cursor() as cur:
            ensure_tables(cur)
            cur.execute("SELECT balance, pin_hash FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (req.email,))
            w = cur.fetchone()
            if not w: raise HTTPException(404, "Wallet not found")
            if not check_pin(req.pin, w['pin_hash']): raise HTTPException(401, "Invalid PIN")
            if w['balance'] < req.amount:
                return {"ok": False, "error": "Insufficient balance", "balance": w['balance']}
            ref = f"PAY_{int(time.time())}_{req.order_id}"
            cur.execute("UPDATE sf_wallets SET balance = balance - %s WHERE LOWER(email)=LOWER(%s)", (req.amount, req.email.lower()))
            cur.execute("INSERT INTO sf_transactions (email, type, amount, ref, status) VALUES (%s,'debit',%s,%s,'success')", (req.email.lower(), req.amount, ref))
            return {"ok": True, "ref": ref, "new_balance": w['balance'] - req.amount}
    finally:
        try: conn.close()
        except: pass

@router.post("/webhook/bank")
async def bank_webhook(request: Request):
    data = await request.json()
    account = data.get("account_number")
    amount = int(float(data.get("amount",0))*100)
    t_ref = data.get("transaction_ref") or f"BNK_{int(time.time())}"
    conn = get_conn()
    if not conn: raise HTTPException(500, "DB not connected")
    try:
        with conn.cursor() as cur:
            ensure_tables(cur)
            cur.execute("SELECT email FROM sf_wallets WHERE virtual_account=%s", (account,))
            u = cur.fetchone()
            if not u: raise HTTPException(404, "Account not found")
            cur.execute("SELECT id FROM sf_transactions WHERE ref=%s", (t_ref,))
            if cur.fetchone():
                return {"ok": True, "msg": "Already credited"}
            cur.execute("UPDATE sf_wallets SET balance = balance + %s WHERE virtual_account=%s", (amount, account))
            cur.execute("INSERT INTO sf_transactions (email, type, amount, ref, status, meta_data) VALUES (%s,'fund',%s,%s,'success',%s)", (u['email'], amount, t_ref, str(data)))
            cur.execute("SELECT balance FROM sf_wallets WHERE virtual_account=%s", (account,))
            bal = cur.fetchone()
            return {"ok": True, "new_balance": bal['balance']}
    finally:
        try: conn.close()
        except: pass