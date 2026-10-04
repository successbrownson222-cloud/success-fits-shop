from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import HTMLResponse
import os
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url: return None
    try:
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except: return None

def clean_email(e: str): return e.strip().lower() if e else ""
def check_admin(s): return s == (os.getenv("ADMIN_SECRET") or "admin123")

class LoginReq(BaseModel): email: str
class CartAddReq(BaseModel): email: str; product_id: int
class ProductReq(BaseModel): name: str; price: int; image: str = ""; category: str = "General"; secret: str

ADMIN_HTML = """
<!DOCTYPE html><html><head><title>Admin - SUCCESS FITS</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:auto;background:#111;color:#fff}input{width:100%;padding:12px;margin:8px 0;background:#222;color:#fff;border:1px solid #444}button{padding:12px;background:white;color:black;width:100%;border:none;font-weight:bold;cursor:pointer;margin:5px 0}</style></head><body>
<h1>SUCCESS FITS - Admin Panel</h1>
<input id="secret" placeholder="Admin Secret" value="admin123">
<input id="name" placeholder="Product Name">
<input id="price" type="number" placeholder="Price">
<input id="category" placeholder="Category (Shoes, Jackets...)">
<input id="image" placeholder="Image URL">
<button onclick="addP()">ADD PRODUCT</button>
<p id="msg"></p><hr>
<input id="delId" type="number" placeholder="Product ID to delete">
<button onclick="delP()" style="background:red;color:white">DELETE PRODUCT</button>
<script>
async function addP(){
 const data={name:document.getElementById('name').value, price:parseInt(document.getElementById('price').value), category:document.getElementById('category').value, image:document.getElementById('image').value, secret:document.getElementById('secret').value};
 const r=await fetch('/api/admin/add-product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const j=await r.json(); document.getElementById('msg').innerText=JSON.stringify(j);
}
async function delP(){
 const id=document.getElementById('delId').value; const sec=document.getElementById('secret').value;
 const r=await fetch(`/api/admin/delete-product?product_id=${id}&secret=${sec}`,{method:'POST'}); const j=await r.json(); document.getElementById('msg').innerText=JSON.stringify(j);
}
</script></body></html>
"""

@app.get("/admin")
@app.get("/admin/")
def admin_page(): return HTMLResponse(ADMIN_HTML)

@app.get("/api/products")
def get_products():
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id;"); rows=cur.fetchall(); cur.close(); conn.close()
        if rows: return rows
    except: pass
    return [{"id":1,"name":"Running Shoes","price":89,"image":"","category":"Shoes"}]

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

@app.get("/")
def root(): return HTMLResponse("API Running - Use /admin")