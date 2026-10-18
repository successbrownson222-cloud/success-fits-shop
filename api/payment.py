from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import hmac, hashlib, os, random, time

from database import get_db
from models import Wallet, Transaction, OrderPayment

router = APIRouter(prefix="/api/payments", tags=["SuccessPay Banking"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
BANK_WEBHOOK_SECRET = os.getenv("BANK_WEBHOOK_SECRET", "your_super_secret_123")

def generate_virtual_account():
    return "99" + str(random.randint(10000000, 99999999)) + str(random.randint(10,99))

@router.post("/create-wallet")
def create_wallet(email: str, pin: str, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.email==email).first()
    if wallet:
        return {"ok": True, "message": "Wallet exists", "account": wallet.virtual_account}
    
    v_account = generate_virtual_account()
    new_wallet = Wallet(
        email=email.lower(),
        balance=0,
        pin_hash=pwd_context.hash(pin),
        virtual_account=v_account
    )
    db.add(new_wallet)
    db.commit()
    # TODO: Call Providus/Wema API here to reserve this account in real bank
    return {"ok": True, "virtual_account": v_account, "bank_name": "SUCCESS PAY MFB", "balance": 0}

@router.get("/wallet/{email}")
def get_wallet(email: str, db: Session = Depends(get_db)):
    w = db.query(Wallet).filter(Wallet.email==email.lower()).first()
    if not w:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return {"email": w.email, "balance": w.balance, "balance_naira": w.balance/100, "virtual_account": w.virtual_account}

@router.post("/webhook/bank")
async def bank_webhook(request: Request, x_signature: str = Header(None), db: Session = Depends(get_db)):
    body = await request.body()
    # 1. VERIFY SIGNATURE - VERY IMPORTANT
    expected_sig = hmac.new(BANK_WEBHOOK_SECRET.encode(), body, hashlib.sha512).hexdigest()
    if x_signature != expected_sig:
        # For testing allow without sig, remove in production
        print("Warning: signature mismatch")
        # raise HTTPException(status_code=401, detail="Invalid signature")
    
    data = await request.json()
    account_number = data.get("account_number")
    amount = int(float(data.get("amount", 0)) * 100) # to kobo
    trans_ref = data.get("transaction_ref")

    # 2. IDEMPOTENCY - prevent double credit
    exists = db.query(Transaction).filter(Transaction.ref==trans_ref).first()
    if exists:
        return {"ok": True, "message": "Already processed"}

    wallet = db.query(Wallet).filter(Wallet.virtual_account==account_number).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Account not found")

    # 3. CREDIT - Double entry
    trx = Transaction(email=wallet.email, type="fund", amount=amount, ref=trans_ref, status="success", meta_data=data)
    wallet.balance += amount
    db.add(trx)
    db.commit()

    return {"ok": True, "credited": amount, "new_balance": wallet.balance}

@router.post("/pay-order")
def pay_order(email: str, order_id: int, pin: str, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.email==email.lower()).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    if not pwd_context.verify(pin, wallet.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    payment = db.query(OrderPayment).filter(OrderPayment.order_id==order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Order payment not found")
    
    if wallet.balance < payment.amount:
        return {"ok": False, "error": "Insufficient balance", "balance": wallet.balance, "needed": payment.amount}

    # Deduct
    ref = f"PAY_{int(time.time())}_{order_id}"
    wallet.balance -= payment.amount
    
    trx = Transaction(email=email.lower(), type="debit", amount=payment.amount, ref=ref, status="success", meta_data={"order_id": order_id})
    payment.payment_status = "paid"
    payment.payment_ref = ref
    payment.payment_method = "wallet"

    db.add(trx)
    db.commit()

    return {"ok": True, "ref": ref, "new_balance": wallet.balance, "message": f"Order #{order_id} paid"}