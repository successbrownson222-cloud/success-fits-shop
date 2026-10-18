from fastapi import APIRouter, Request
from pydantic import BaseModel
import os, random, time, json

router = APIRouter(prefix="/api/payments", tags=["SuccessPay"])

# Don't import psycopg2 or bcrypt at top - import inside functions so site never crashes

def get_conn():
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
        if not url:
            return None
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
        conn.autocommit = True
        return conn
    except Exception as e:
        print("DB ERROR:", e)
        return None

def hash_pin(pin: str):
    try:
        import bcrypt
        return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    except:
        import hashlib
        return hashlib.sha256(pin.encode()).hexdigest()

def check_pin(pin: str, hashed: str):
    try:
        import bcrypt
        return bcrypt.checkpw(pin.encode(), hashed.encode())
    except:
        import hashlib
        return hashlib.sha256(pin.encode()).hexdigest() == hashed

def gen_account():
    return "99" + str(random.randint(10000000,99999999)) + str(random.randint(10,99))

class WalletReq(BaseModel): email: str; pin: str
class PayReq(BaseModel): email: str; order_id: int; pin: str; amount: int

@router.post("/create-wallet")
def create_wallet(req: WalletReq):
    conn = get_conn()
    if not conn: return {"ok": False, "error": "DB not connected - set POSTGRES_URL in Vercel"}
    try:
        with conn.cursor() as cur:
            # Use your existing table from database.py - NO ensure_tables()
            cur.execute("SELECT virtual_account, balance FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (req.email,))
            row = cur.fetchone()
            if row:
                return {"ok": True, "virtual_account": row['virtual_account'], "balance": row['balance'], "bank": "SUCCESS PAY MFB"}
            v_acc = gen_account()
            cur.execute("INSERT INTO sf_wallets (email, balance, pin_hash, virtual_account) VALUES (%s, %s, %s, %s)", (req.email.lower(), 0, hash_pin(req.pin), v_acc))
            return {"ok": True, "virtual_account": v_acc, "bank": "SUCCESS PAY MFB", "balance": 0}
    except Exception as e:
        print("create-wallet error:", e)
        return {"ok": False, "error": str(e)}
    finally:
        try: conn.close()
        except: pass

@router.get("/wallet/{email}")
def get_wallet(email: str):
    conn = get_conn()
    if not conn: return {"ok": False, "error": "DB not connected"}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT email, balance, virtual_account FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (email,))
            row = cur.fetchone()
            if not row: return {"ok": False, "error": "Wallet not found"}
            return {"ok": True, "email": row['email'], "balance": row['balance'], "balance_naira": row['balance']/100, "virtual_account": row['virtual_account']}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        try: conn.close()
        except: pass

@router.post("/webhook/bank")
async def bank_webhook(request: Request):
    try:
        data = await request.json()
        account = str(data.get("account_number") or "").strip()
        amount_raw = data.get("amount", 0)
        try: amount = int(float(amount_raw)*100)
        except: amount = int(amount_raw)
        t_ref = str(data.get("transaction_ref") or f"BNK_{int(time.time())}")
        conn = get_conn()
        if not conn: return {"ok": False, "error": "DB not connected"}
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM sf_wallets WHERE virtual_account=%s", (account,))
            u = cur.fetchone()
            if not u: return {"ok": False, "error": f"Account {account} not found"}
            cur.execute("SELECT id FROM sf_transactions WHERE ref=%s", (t_ref,))
            if cur.fetchone(): return {"ok": True, "msg": "Already credited"}
            cur.execute("UPDATE sf_wallets SET balance = balance + %s WHERE virtual_account=%s", (amount, account))
            cur.execute("INSERT INTO sf_transactions (email, type, amount, ref, status, meta_data) VALUES (%s,'fund',%s,%s,'success',%s)", (u['email'], amount, t_ref, json.dumps(data)))
            cur.execute("SELECT balance FROM sf_wallets WHERE virtual_account=%s", (account,))
            bal = cur.fetchone()
            return {"ok": True, "new_balance": bal['balance'], "new_balance_naira": bal['balance']/100}
    except Exception as e:
        print("WEBHOOK ERROR:", e)
        return {"ok": False, "error": str(e)}