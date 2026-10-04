from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PRODUCTS = [
    {"id":1,"name":"Running Shoes","price":89,"image":"","category":"Shoes"},
    {"id":2,"name":"Denim Jacket","price":120,"image":"","category":"Jackets"},
    {"id":3,"name":"Gold Necklace","price":250,"image":"","category":"Jewelry"},
    {"id":4,"name":"Leather Bag","price":75,"image":"","category":"Bags"},
    {"id":5,"name":"White Sneakers","price":95,"image":"","category":"Shoes"},
    {"id":6,"name":"Black T-Shirt","price":35,"image":"","category":"Shirts"},
]

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url: return None
    try:
        if "sslmode" in url: return psycopg2.connect(url, cursor_factory=RealDictCursor)
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except: return None

def clean_email(e: str): return e.strip().lower() if e else ""
def check_admin(s): return s == (os.getenv("ADMIN_SECRET") or "admin123")

def find_frontend(name):
    poss = [f"frontend/{name}", f"../frontend/{name}", os.path.join(os.path.dirname(__file__), f"../frontend/{name}"), os.path.join(os.path.dirname(__file__), f"frontend/{name}")]
    for p in poss:
        if os.path.exists(p): return p
    return None

def ensure_tables():
    try:
        conn = get_conn()
        if not conn: return
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY);")
        cur.execute("CREATE TABLE IF NOT EXISTS carts (email TEXT, product_id INT, PRIMARY KEY (email, product_id));")
        cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT);")
        cur.execute("SELECT COUNT(*) as c FROM products;")
        count = cur.fetchone()['c']
        if count == 0:
            for p in PRODUCTS:
                cur.execute("INSERT INTO products (id,name,price,image,category) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING;", (p['id'],p['name'],p['price'],p['image'],p['category']))
        conn.commit(); cur.close(); conn.close()
    except Exception as e: print(f"TABLE ERROR: {e}")
ensure_tables()

class LoginReq(BaseModel): email: str
class CartAddReq(BaseModel): email: str; product_id: int
class ProductReq(BaseModel): name: str; price: int; image: str = ""; category: str = "General"; secret: str

@app.get("/api/debug")
def debug():
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT email, product_id FROM carts;"); rows=cur.fetchall(); cur.close(); conn.close()
        return {"has_db": True, "total": len(rows), "rows": rows}
    except Exception as e: return {"has_db": False, "error": str(e)}

@app.get("/api/products")
def get_products():
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id;"); rows=cur.fetchall(); cur.close(); conn.close()
        if rows: return rows
        return PRODUCTS
    except: return PRODUCTS

@app.get("/api/cart")
def get_cart(email: str = Query("")):
    email=clean_email(email)
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT product_id FROM carts WHERE LOWER(email)=%s;", (email,)); cart=[r['product_id'] for r in cur.fetchall()]; cur.close(); conn.close(); return {"cart": cart}
    except Exception as e: return {"cart":[], "error": str(e)}

@app.post("/api/login")
def login(r: LoginReq): return get_cart(r.email)

@app.post("/api/cart/add")
def add_cart(r: CartAddReq):
    email=clean_email(r.email)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s AND product_id=%s;", (email, r.product_id))
        cur.execute("INSERT INTO carts (email,product_id) VALUES (%s,%s) ON CONFLICT DO NOTHING;", (email, r.product_id))
        conn.commit(); cur.execute("SELECT product_id FROM carts WHERE LOWER(email)=%s;", (email,)); cart=[row['product_id'] for row in cur.fetchall()]; cur.close(); conn.close(); return {"cart": cart}
    except Exception as e: return {"cart":[], "error": str(e)}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    try:
        email=clean_email(r.email); conn=get_conn(); cur=conn.cursor(); cur.execute("DELETE FROM carts WHERE LOWER(email)=%s;", (email,)); conn.commit(); cur.close(); conn.close()
    except: pass
    return {"cart":[]}

@app.post("/api/admin/add-product")
def add_product(r: ProductReq):
    if not check_admin(r.secret): return {"error":"wrong admin secret"}
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("INSERT INTO products (name,price,image,category) VALUES (%s,%s,%s,%s) RETURNING id;", (r.name, r.price, r.image, r.category)); nid=cur.fetchone()['id']; conn.commit(); cur.close(); conn.close(); return {"success":True,"id":nid}
    except Exception as e: return {"error": str(e)}

@app.post("/api/admin/delete-product")
def del_product(product_id: int, secret: str = ""):
    if not check_admin(secret): return {"error":"wrong admin secret"}
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("DELETE FROM products WHERE id=%s;", (product_id,)); conn.commit(); cur.close(); conn.close(); return {"success":True}
    except Exception as e: return {"error": str(e)}

@app.get("/admin")
def admin_page():
    fp = find_frontend("admin.html")
    if fp: return FileResponse(fp)
    return HTMLResponse(f"admin.html not found - CWD={os.getcwd()} - Checked", status_code=404)

@app.get("/")
def root():
    fp = find_frontend("index.html")
    if fp: return FileResponse(fp)
    return HTMLResponse("<h1>API Running</h1>")

@app.get("/{full_path:path}")
def serve(full_path: str):
    if full_path.startswith("api/"): return {"detail":"Not Found"}
    p = find_frontend(full_path)
    if p: return FileResponse(p)
    fp = find_frontend("index.html")
    if fp: return FileResponse(fp)
    return HTMLResponse("Not found")