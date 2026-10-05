from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, pathlib
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- DATABASE ---
def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_URL_NON_POOLING")
    if not url: return None
    try:
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except Exception as e:
        print(f"DB Error: {e}")
        return None

def clean_email(e): return e.strip().lower() if e else ""
def check_admin(s): return s == (os.getenv("ADMIN_SECRET") or "admin123")

class LoginReq(BaseModel): email: str
class CartAddReq(BaseModel): email: str; product_id: int
class ProductReq(BaseModel): name: str; price: int; image: str = ""; category: str = "General"; secret: str

# --- FIND FRONTEND FOLDER (this fixes your white screen) ---
def find_frontend_file(name: str):
    # Vercel puts files in different places
    possible_roots = [
        pathlib.Path(__file__).parent.parent / "frontend",
        pathlib.Path.cwd() / "frontend",
        pathlib.Path("/vercel/path0/frontend"),
        pathlib.Path("frontend"),
    ]
    for root in possible_roots:
        p = root / name
        if p.exists():
            return str(p)
    return None

ADMIN_HTML_PATH = find_frontend_file("admin.html")
INDEX_HTML_PATH = find_frontend_file("index.html")

# --- API ROUTES ---
@app.get("/api/products")
def get_products():
    try:
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id;")
            rows = cur.fetchall()
            cur.close(); conn.close()
            if rows: return rows
    except Exception as e: print(e)
    return [{"id":1,"name":"Running Shoes","price":89,"image":"https://via.placeholder.com/300","category":"Shoes"}]

@app.get("/api/cart")
def get_cart(email: str = ""):
    email = clean_email(email)
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT product_id FROM carts WHERE LOWER(email)=%s;", (email,)); cart=[r['product_id'] for r in cur.fetchall()]; cur.close(); conn.close(); return {"cart": cart}
    except: return {"cart": []}

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
    if not check_admin(r.secret): return JSONResponse({"error":"wrong admin secret"}, status_code=401)
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("INSERT INTO products (name,price,image,category) VALUES (%s,%s,%s,%s) RETURNING id;", (r.name, r.price, r.image, r.category)); nid=cur.fetchone()['id']; conn.commit(); cur.close(); conn.close(); return {"success":True,"id":nid}
    except Exception as e: return {"error": str(e)}

@app.post("/api/admin/delete-product")
def del_product(product_id: int, secret: str = ""):
    if not check_admin(secret): return JSONResponse({"error":"wrong admin secret"}, status_code=401)
    try:
        conn=get_conn(); cur=conn.cursor(); cur.execute("DELETE FROM products WHERE id=%s;", (product_id,)); conn.commit(); cur.close(); conn.close(); return {"success":True}
    except Exception as e: return {"error": str(e)}

# --- PAGE ROUTES (this fixes Not Found) ---
@app.get("/admin")
def admin_page():
    if ADMIN_HTML_PATH:
        return FileResponse(ADMIN_HTML_PATH)
    # Fallback if file missing
    return HTMLResponse("<h1>Admin Panel</h1><p>admin.html not found in frontend folder. Check your repo has frontend/admin.html</p>")

@app.get("/")
def root_page():
    if INDEX_HTML_PATH:
        return FileResponse(INDEX_HTML_PATH)
    return HTMLResponse(f"<h1>Debug</h1><p>INDEX not found. I searched for frontend/index.html but failed. CWD={os.getcwd()} files={os.listdir('.')}</p>")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    # Try to serve frontend files like style.css, script.js
    fp = find_frontend_file(full_path)
    if fp:
        return FileResponse(fp)
    # For any other page, serve index.html (for SPA)
    if INDEX_HTML_PATH:
        return FileResponse(INDEX_HTML_PATH)
    return JSONResponse({"detail": f"Not Found: {full_path} - frontend missing"}, status_code=404)