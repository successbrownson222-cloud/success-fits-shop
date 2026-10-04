from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

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
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except:
        return None

def clean_email(e: str): return e.strip().lower() if e else ""
def check_admin(s): return s == (os.getenv("ADMIN_SECRET") or "admin123")

# FIXED - works on Vercel
def find_frontend(name):
    base = Path(__file__).resolve().parent
    possible = [
        base / ".." / "frontend" / name,
        base / "frontend" / name,
        Path.cwd() / "frontend" / name,
        Path("/var/task/frontend") / name,
        Path("/var/task") / "frontend" / name,
    ]
    for p in possible:
        if p.exists():
            return str(p)
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
        return {"has_db": True, "total": len(rows), "rows": rows, "cwd": os.getcwd(), "dir": str(list(Path.cwd().iterdir())[:10])}
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

# ADMIN - FIXED TO ALWAYS WORK
ADMIN_HTML = """
<!DOCTYPE html><html><head><title>Admin - SUCCESS FITS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:auto}input{width:100%;padding:10px;margin:5px 0}button{padding:12px;background:black;color:white;width:100%;border:none;cursor:pointer}</style>
</head><body>
<h1>SUCCESS FITS - Admin</h1>
<input id="secret" placeholder="Admin Secret (admin123)" value="admin123">
<input id="name" placeholder="Product Name">
<input id="price" placeholder="Price" type="number">
<input id="category" placeholder="Category">
<input id="image" placeholder="Image URL (optional)">
<button onclick="addP()">Add Product</button>
<p id="msg"></p>
<h3>Delete Product</h3>
<input id="delId" placeholder="Product ID to delete" type="number">
<button onclick="delP()" style="background:red">Delete</button>
<script>
async function addP(){
 const b={name:document.getElementById('name').value, price:parseInt(document.getElementById('price').value), category:document.getElementById('category').value, image:document.getElementById('image').value, secret:document.getElementById('secret').value};
 const r=await fetch('/api/admin/add-product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); const j=await r.json(); document.getElementById('msg').innerText=JSON.stringify(j);
}
async function delP(){
 const id=document.getElementById('delId').value; const sec=document.getElementById('secret').value;
 const r=await fetch(`/api/admin/delete-product?product_id=${id}&secret=${sec}`,{method:'POST'}); const j=await r.json(); document.getElementById('msg').innerText=JSON.stringify(j);
}
</script>
</body></html>
"""

@app.get("/admin")
@app.get("/admin/")
def admin_page():
    fp = find_frontend("admin.html")
    if fp: return FileResponse(fp)
    # Fallback - always works even if admin.html missing
    return HTMLResponse(ADMIN_HTML)

@app.get("/")
def root():
    fp = find_frontend("index.html")
    if fp: return FileResponse(fp)
    return HTMLResponse("<h1>API Running - frontend/index.html not found at "+os.getcwd()+"</h1>")

@app.get("/{full_path:path}")
def serve(full_path: str):
    if full_path.startswith("api/"): 
        return HTMLResponse("API Not Found", status_code=404)
    p = find_frontend(full_path)
    if p and os.path.isfile(p): return FileResponse(p)
    fp = find_frontend("index.html")
    if fp: return FileResponse(fp)
    return HTMLResponse(ADMIN_HTML if "admin" in full_path else "<h1>Shop Loading...</h1>", status_code=200)