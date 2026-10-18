from sqlalchemy import Column, String, Integer, DateTime, JSON
from datetime import datetime

class Wallet(Base):
    __tablename__ = "sf_wallets"
    email = Column(String, primary_key=True)
    balance = Column(Integer, default=0) # store in KOBO: 1000 Naira = 100000
    pin_hash = Column(String, nullable=True)
    virtual_account = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "sf_transactions"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    type = Column(String) # fund, debit, refund
    amount = Column(Integer)
    ref = Column(String, unique=True, index=True)
    status = Column(String, default="pending") # pending, success, failed
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class OrderPayment(Base):
    __tablename__ = "sf_orders_payments"
    order_id = Column(Integer, primary_key=True)
    email = Column(String)
    amount = Column(Integer)
    payment_method = Column(String) # wallet, bank_transfer, pod
    payment_ref = Column(String, nullable=True)
    payment_status = Column(String, default="pending")