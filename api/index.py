from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os, psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PRODUCTS = [
    {"id":1,"name":"Running Shoes","category":"Shoes","price":89,"image":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"},
    {"id":2,"name":"Denim Jacket","category":"Clothes","price":120,"image":"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500"},
    {"id":3,"name":"Gold Necklace","category":"Jewelry","price":250,"image":"https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500"},
    {"id":4,"name":"Leather Bag","category":"Accessories","price":75,"image":"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500"},
    {"id":5,"name":"White Sneakers","category":"Shoes","price":95,"image":"https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=500"},
    {"id":6,"name":"Black T-Shirt","category":"Clothes","price":35,"image":"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500"},
]

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url: return None
    if "sslmode" in url:
        return psycopg2.connect(url, cursor_factory=RealDictCursor)
    else:
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')

def ensure_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS carts (email TEXT, product_id INT, PRIMARY KEY (email, product_id));
    """)

def clean_email(e: str):
    return e.strip().lower() if e else ""

class LoginReq(BaseModel):
    email: str
class CartReq(BaseModel):
    email: str
    product_id: int

@app.get("/api/debug")
def debug():
    try:
        conn = get_conn()
        cur = conn.cursor()
        ensure_tables(cur)
        conn.commit()
        cur.execute("SELECT email, product_id FROM carts")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {"has_db": True, "total": len(rows), "rows": rows}
    except Exception as e:
        return {"has_db": False, "error": str(e)}

@app.get("/api/products")
def get_products(): return PRODUCTS

# === FIX 1: SUPPORT BOTH /api/cart?email= AND /api/cart/{email} ===
@app.get("/api/cart")
def get_cart_query(email: str = Query(None)):
    try:
        if not email: return {"cart":[]}
        email = clean_email(email)
        conn = get_conn()
        if not conn: return {"cart":[]}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        print(f"GET CART QUERY {email} -> {cart}")
        return {"cart": cart}
    except Exception as e:
        print(f"CART QUERY ERROR {e}")
        return {"cart":[],"error":str(e)}

@app.get("/api/cart/{email}")
def get_cart_path(email: str):
    try:
        email = clean_email(email)
        conn = get_conn()
        if not conn: return {"cart":[]}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        print(f"GET CART PATH {email} -> {cart}")
        return {"cart": cart}
    except Exception as e:
        return {"cart":[],"error":str(e)}

# === FIX 2: LOWERCASE EMAIL EVERYWHERE ===
@app.post("/api/login")
def login(r: LoginReq):
    try:
        email = clean_email(r.email)
        conn = get_conn()
        if not conn: return {"email":email,"cart":[]}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("INSERT INTO users (email) VALUES (%s) ON CONFLICT DO NOTHING", (email,))
        conn.commit()
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        print(f"LOGIN {email} cart={cart}")
        return {"email":email,"cart":cart}
    except Exception as e:
        print(f"LOGIN ERROR: {e}")
        return {"email":clean_email(r.email),"cart":[],"error":str(e)}

@app.post("/api/cart/add")
def add_cart(r: CartReq):
    try:
        email = clean_email(r.email)
        conn = get_conn()
        if not conn: return {"cart":[r.product_id]}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("INSERT INTO carts (email, product_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (email, r.product_id))
        conn.commit()
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        print(f"ADD {email} {r.product_id} -> {cart}")
        return {"cart":cart}
    except Exception as e:
        print(f"ADD ERROR: {e}")
        return {"cart":[],"error":str(e)}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    try:
        email = clean_email(r.email)
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM carts WHERE email=%s", (email,))
            conn.commit()
            cur.close(); conn.close()
    except: pass
    return {"cart":[]}

@app.get("/")
def root():
    for p in ["frontend/index.html","../frontend/index.html"]:
        if os.path.exists(p): return FileResponse(p)
    return HTMLResponse("<h1>API Running</h1>")

@app.get("/{full_path:path}")
def serve_front(full_path: str):
    if full_path.startswith("api/"): return {"detail":"Not Found API"}
    for p in ["frontend/index.html","../frontend/index.html"]:
        if os.path.exists(p): return FileResponse(p)
    return HTMLResponse("<h1>Success Fits</h1>")