from fastapi import APIRouter, Request
from pydantic import BaseModel
import os, random, time, json

router = APIRouter(prefix="/api/payments", tags=["SuccessPay Banking"])

# SAFE IMPORT - Use database.py as single source of truth
try:
    from database import get_conn
    print("payment.py: using database.get_conn")
except:
    # Fallback if database.py not found (never crash)
    def get_conn():
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
            if not url: return None
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
    # 10 digits starting with 99 - like real MFB
    return "99" + str(random.randint(10000000,99999999)) + random.randint(10,99))[:10]

class WalletReq(BaseModel): 
    email: str
    pin: str

class PayReq(BaseModel):
    email: str
    order_id: int
    pin: str
    amount: int

@router.get("/health")
def health():
    conn = get_conn()
    return {"ok": True, "db": bool(conn), "service": "SuccessPay Banking Live"}

@router.post("/create-wallet")
def create_wallet(req: WalletReq):
    conn = get_conn()
    if not conn: 
        return {"ok": False, "error": "DB not connected - set POSTGRES_URL in Vercel"}
    try:
        with conn.cursor() as cur:
            # Tables already created by database.py - NO create here
            cur.execute("SELECT virtual_account, balance FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (req.email,))
            row = cur.fetchone()
            if row:
                return {"ok": True, "exists": True, "virtual_account": row['virtual_account'], "balance": row['balance'], "balance_naira": row['balance']/100, "bank": "SUCCESS PAY MFB"}
            
            # Generate unique account
            v_acc = gen_account()
            for _ in range(5): # try 5 times for uniqueness
                try:
                    cur.execute("INSERT INTO sf_wallets (email, balance, pin_hash, virtual_account) VALUES (%s, %s, %s, %s)", (req.email.lower(), 0, hash_pin(req.pin), v_acc))
                    break
                except Exception as e:
                    if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                        v_acc = gen_account()
                        continue
                    raise e
            
            return {"ok": True, "virtual_account": v_acc, "bank": "SUCCESS PAY MFB", "balance": 0, "balance_naira": 0}
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
            return {"ok": True, "email": row['email'], "balance": row['balance'], "balance_naira": row['balance']/100, "virtual_account": row['virtual_account'], "bank": "SUCCESS PAY MFB"}
    except Exception as e:
        print("get-wallet error:", e)
        return {"ok": False, "error": str(e)}
    finally:
        try: conn.close()
        except: pass

@router.post("/pay-order")
def pay_order(req: PayReq):
    conn = get_conn()
    if not conn: return {"ok": False, "error": "DB not connected"}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT balance, pin_hash FROM sf_wallets WHERE LOWER(email)=LOWER(%s)", (req.email,))
            w = cur.fetchone()
            if not w: return {"ok": False, "error": "Wallet not found - create wallet first"}
            if not check_pin(req.pin, w['pin_hash']): return {"ok": False, "error": "Invalid PIN"}
            if w['balance'] < req.amount:
                return {"ok": False, "error": "Insufficient balance", "balance": w['balance'], "balance_naira": w['balance']/100}
            
            ref = f"PAY_{int(time.time())}_{req.order_id}"
            cur.execute("UPDATE sf_wallets SET balance = balance - %s WHERE LOWER(email)=LOWER(%s)", (req.amount, req.email.lower()))
            cur.execute("INSERT INTO sf_transactions (email, type, amount, ref, status, meta_data) VALUES (%s,'debit',%s,%s,'success',%s)", (req.email.lower(), req.amount, ref, json.dumps({"order_id": req.order_id})))
            cur.execute("INSERT INTO sf_orders_payments (order_id, email, amount, payment_method, payment_ref, payment_status) VALUES (%s,%s,%s,'wallet',%s,'paid') ON CONFLICT (order_id) DO UPDATE SET payment_status='paid', payment_ref=%s", (req.order_id, req.email.lower(), req.amount, ref, ref))
            
            return {"ok": True, "ref": ref, "new_balance": w['balance'] - req.amount, "new_balance_naira": (w['balance'] - req.amount)/100}
    except Exception as e:
        print("pay-order error:", e)
        return {"ok": False, "error": str(e)}
    finally:
        try: conn.close()
        except: pass

@router.post("/webhook/bank")
async def bank_webhook(request: Request):
    """This is your TEST FUND button target"""
    try:
        data = await request.json()
        print("WEBHOOK:", data)
        
        account = str(data.get("account_number") or data.get("virtual_account") or "").strip()
        amount_raw = data.get("amount", 0)
        try: amount = int(float(amount_raw)*100)
        except: amount = int(amount_raw) if amount_raw else 0
        t_ref = str(data.get("transaction_ref") or data.get("ref") or f"BNK_{int(time.time())}")

        if not account: return {"ok": False, "error": "account_number required"}
        if amount <=0: return {"ok": False, "error": "amount required"}

        conn = get_conn()
        if not conn: return {"ok": False, "error": "DB not connected"}
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT email FROM sf_wallets WHERE virtual_account=%s", (account,))
                u = cur.fetchone()
                if not u:
                    return {"ok": False, "error": f"Account {account} not found"}
                
                # Idempotency - don't credit twice
                cur.execute("SELECT id FROM sf_transactions WHERE ref=%s", (t_ref,))
                if cur.fetchone():
                    cur.execute("SELECT balance FROM sf_wallets WHERE virtual_account=%s", (account,))
                    bal = cur.fetchone()
                    return {"ok": True, "msg": "Already credited", "new_balance": bal['balance'], "new_balance_naira": bal['balance']/100}
                
                cur.execute("UPDATE sf_wallets SET balance = balance + %s WHERE virtual_account=%s", (amount, account))
                cur.execute("INSERT INTO sf_transactions (email, type, amount, ref, status, meta_data) VALUES (%s,'fund',%s,%s,'success',%s)", (u['email'], amount, t_ref, json.dumps(data)))
                cur.execute("SELECT balance FROM sf_wallets WHERE virtual_account=%s", (account,))
                bal = cur.fetchone()
                
                return {"ok": True, "email": u['email'], "credited": amount/100, "new_balance": bal['balance'], "new_balance_naira": bal['balance']/100, "message": f"₦{amount/100} credited!"}
        finally:
            try: conn.close()
            except: pass
    except Exception as e:
        print("WEBHOOK ERROR:", e)
        import traceback; traceback.print_exc()
        return {"ok": False, "error": str(e)}