import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not url: return None
    try:
        if "sslmode" in url:
            conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        else:
            conn = psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
        conn.autocommit = True
        return conn
    except Exception as e:
        print("DB fail:", e)
        return None

def ensure_payment_tables():
    conn = get_conn()
    if not conn: return
    try:
        with conn.cursor() as cur:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS sf_wallets (
                email TEXT PRIMARY KEY,
                balance INT DEFAULT 0,
                pin_hash TEXT,
                virtual_account TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            );""")
            cur.execute("""
            CREATE TABLE IF NOT EXISTS sf_transactions (
                id SERIAL PRIMARY KEY,
                email TEXT,
                type TEXT,
                amount INT,
                ref TEXT UNIQUE,
                status TEXT DEFAULT 'success',
                meta_data JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );""")
            cur.execute("""
            CREATE TABLE IF NOT EXISTS sf_orders_payments (
                order_id INT PRIMARY KEY,
                email TEXT,
                amount INT,
                payment_method TEXT,
                payment_ref TEXT,
                payment_status TEXT DEFAULT 'pending'
            );""")
    finally:
        try: conn.close()
        except: pass