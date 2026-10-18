import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_conn():
    """Single source of truth for DB - used by index.py and payment.py"""
    url = (
        os.getenv("POSTGRES_URL_NON_POOLING") or 
        os.getenv("POSTGRES_URL") or 
        os.getenv("DATABASE_URL")
    )
    if not url: 
        print("NO DB URL FOUND")
        return None
    try:
        # Always require SSL for Vercel Postgres / Neon
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
        conn.autocommit = True
        return conn
    except Exception as e:
        print("DB fail:", e)
        return None

# Alias for compatibility with other files calling get_db()
def get_db():
    return get_conn()

def ensure_payment_tables():
    """Create wallet tables ONCE - call manually, not at import"""
    conn = get_conn()
    if not conn: 
        print("ensure_payment_tables: no conn")
        return False
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
        print("Payment tables ensured OK")
        return True
    except Exception as e:
        print("ensure_payment_tables error:", e)
        return False
    finally:
        try: conn.close()
        except: pass

def init_all_tables():
    """Call this once on startup if you want"""
    conn = get_conn()
    if not conn: return
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
            cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT)")
            cur.execute("CREATE TABLE IF NOT EXISTS carts (id SERIAL PRIMARY KEY, email TEXT NOT NULL, product_id INT NOT NULL, qty INT DEFAULT 1, size TEXT DEFAULT 'M', color TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW());")
            cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
        ensure_payment_tables()
    finally:
        try: conn.close()
        except: pass