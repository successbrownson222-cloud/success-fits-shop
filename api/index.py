from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os, json, psycopg2
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
    # Vercel gives 3 URLs — try NON_POOLING first, it's the only one that works with psycopg2
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url:
        print("NO DB URL FOUND")
        return None
    try:
        # Don't pass sslmode if URL already has it
        if "sslmode" in url:
            return psycopg2.connect(url, cursor_factory=RealDictCursor)
        else:
            return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except Exception as e:
        print(f"DB CONNECT FAIL: {e}")
        raise e

def ensure_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS carts (email TEXT, product_id INT, PRIMARY KEY (email, product_id));
    """)

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
        return {"has_db": True, "total": len(rows), "rows": rows, "env_has_db": True}
    except Exception as e:
        return {"has_db": False, "error": str(e)}

@app.get("/api/products")
def get_products(): return PRODUCTS

@app.post("/api/login")
def login(r: LoginReq):
    try:
        conn = get_conn()
        if not conn:
            return {"email":r.email,"cart":[],"warning":"no db"}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("INSERT INTO users (email) VALUES (%s) ON CONFLICT DO NOTHING", (r.email,))
        conn.commit()
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (r.email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        print(f"LOGIN {r.email} cart={cart}")
        return {"email":r.email,"cart":cart}
    except Exception as e:
        print(f"LOGIN ERROR: {e}")
        return {"email":r.email,"cart":[],"error":str(e)}

@app.get("/api/cart/{email}")
def get_cart(email: str):
    try:
        conn = get_conn()
        if not conn: return {"cart":[]}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        return {"cart": cart}
    except Exception as e:
        return {"cart":[],"error":str(e)}

@app.post("/api/cart/add")
def add_cart(r: CartReq):
    try:
        conn = get_conn()
        if not conn: return {"cart":[r.product_id],"warning":"no db"}
        cur = conn.cursor()
        ensure_tables(cur)
        cur.execute("INSERT INTO carts (email, product_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (r.email, r.product_id))
        conn.commit()
        cur.execute("SELECT product_id FROM carts WHERE email=%s", (r.email,))
        cart = [row['product_id'] for row in cur.fetchall()]
        cur.close(); conn.close()
        print(f"ADD {r.email} {r.product_id} -> {cart}")
        return {"cart":cart}
    except Exception as e:
        print(f"ADD ERROR: {e}")
        return {"cart":[],"error":str(e)}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    try:
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM carts WHERE email=%s", (r.email,))
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