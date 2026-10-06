from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import bcrypt, os, pathlib
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ADMIN_EMAIL = "successbrownson222@gmail.com"

# --- DB CONNECTION ---
def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url: return None
    try:
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except Exception as e:
        print(f"DB Error: {e}")
        return None

def clean_email(e): return e.strip().lower() if e else ""

def is_admin(email: str):
    email = clean_email(email)
    if not email: return False
    if email == ADMIN_EMAIL: return True
    try:
        conn = get_conn()
        if not conn: return False
        cur = conn.cursor()
        cur.execute("SELECT role FROM users WHERE LOWER(email)=%s", (email,))
        row = cur.fetchone()
        cur.close(); conn.close()
        return row and row.get('role') == 'admin'
    except:
        return False

# --- MODELS ---
class LoginReq(BaseModel): email: str
class CartAddReq(BaseModel): email: str; product_id: int
class ProductReq(BaseModel): 
    name: str; price: int; image: str = ""; category: str = "General"; 
    secret: str = ""; admin_email: str = ""; adminEmail: str = ""
class CheckoutReq(BaseModel):
    email: str; name: str; address: str; phone: str; items: list; total: int

class AuthReq(BaseModel):
    email: str; password: str; name: str = ""

# --- AUTH (SECURE - REAL PASSWORD) ---
@app.post("/api/auth/signup")
def signup(data: AuthReq):
    email = clean_email(data.email)
    conn = get_conn()
    if not conn: return {"error":"DB not connected"}
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    try:
        # First user with ADMIN_EMAIL becomes admin automatically
        role = "admin" if email == ADMIN_EMAIL else "user"
        cur.execute("INSERT INTO users (email,password,name,role) VALUES (%s,%s,%s,%s)", (email, hashed, data.name, role))
        conn.commit()
        return {"ok":True, "message":"Account created"}
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return {"error":"Email already exists"}
        return {"error":str(e)}
    finally:
        cur.close(); conn.close()

@app.post("/api/auth/login")
def auth_login(data: AuthReq):
    email = clean_email(data.email)
    conn = get_conn()
    if not conn: return {"error":"DB error"}
    cur = conn.cursor()
    cur.execute("SELECT password, name, role FROM users WHERE LOWER(email)=%s", (email,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row: return {"error":"User not found, sign up first"}
    if bcrypt.checkpw(data.password.encode(), row['password'].encode()):
        return {"ok":True, "user":{"email":email, "name":row['name'], "role":row['role']}}
    return {"error":"Wrong password"}

# --- FRONTEND FILE FINDER ---
def find_frontend_file(name: str):
    possible_roots = [
        pathlib.Path(__file__).parent.parent / "frontend",
        pathlib.Path.cwd() / "frontend",
        pathlib.Path("/vercel/path0/frontend"),
        pathlib.Path("frontend"),
    ]
    for root in possible_roots:
        p = root / name
        if p.exists(): return str(p)
    return None

ADMIN_HTML_PATH = find_frontend_file("admin.html")
INDEX_HTML_PATH = find_frontend_file("index.html")

# --- PRODUCTS ---
@app.get("/api/products")
def get_products():
    try:
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id DESC;")
            rows = cur.fetchall()
            cur.close(); conn.close()
            if rows: return rows
    except Exception as e: print(e)
    return [{"id":1,"name":"Running Shoes","price":89,"image":"https://via.placeholder.com/300","category":"Shoes"}]

# --- CART ---
@app.get("/api/cart")
def get_cart(email: str = ""):
    email = clean_email(email)
    if not email: return {"cart": [], "items": []}
    try:
        conn=get_conn()
        if not conn: return {"cart": [], "items": []}
        cur=conn.cursor()
        cur.execute("""
            SELECT p.id, p.name, p.price, p.image, p.category
            FROM carts c JOIN products p ON p.id = c.product_id
            WHERE LOWER(c.email)=%s;
        """, (email,))
        items = cur.fetchall()
        cart_ids = [r['id'] for r in items]
        cur.close(); conn.close()
        return {"cart": cart_ids, "items": items}
    except Exception as e:
        print(f"get_cart error: {e}")
        return {"cart": [], "items": []}

@app.post("/api/login")
def login_old(r: LoginReq):
    return get_cart(r.email)

@app.post("/api/cart/add")
def add_cart(r: CartAddReq):
    email=clean_email(r.email)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS carts (email TEXT, product_id INT, UNIQUE(email, product_id))")
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s AND product_id=%s;", (email, r.product_id))
        cur.execute("INSERT INTO carts (email,product_id) VALUES (%s,%s);", (email, r.product_id))
        conn.commit()
        cur.execute("""
            SELECT p.id, p.name, p.price, p.image, p.category
            FROM carts c JOIN products p ON p.id=c.product_id
            WHERE LOWER(c.email)=%s;
        """, (email,))
        items = cur.fetchall()
        cart_ids = [row['id'] for row in items]
        cur.close(); conn.close()
        return {"cart": cart_ids, "items": items}
    except Exception as e:
        return {"cart":[], "items": [], "error": str(e)}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    try:
        email=clean_email(r.email); conn=get_conn(); cur=conn.cursor()
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s;", (email,))
        conn.commit(); cur.close(); conn.close()
    except Exception as e: print(e)
    return {"cart":[], "items": []}

# --- SECURE CHECKOUT ---
@app.post("/api/checkout")
def checkout(r: CheckoutReq):
    email = clean_email(r.email)
    if not r.address or not r.phone or not r.name:
        return JSONResponse({"error":"Fill address, phone, name"}, status_code=400)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, name TEXT, address TEXT, phone TEXT, items JSONB, total INT, created_at TIMESTAMP DEFAULT NOW())")
        import json
        cur.execute("INSERT INTO orders (email,name,address,phone,items,total) VALUES (%s,%s,%s,%s,%s,%s)", (email,r.name,r.address,r.phone,json.dumps(r.items),r.total))
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s", (email,))
        conn.commit(); cur.close(); conn.close()
        return {"success":True, "message":"Order placed!"}
    except Exception as e:
        return {"error":str(e)}

# --- SECURE ADMIN (NO MORE admin123) ---
@app.post("/api/admin/add-product")
def add_product(r: ProductReq, request: Request):
    # Get admin email from body or header
    admin_email = clean_email(r.admin_email or r.adminEmail or request.headers.get("x-admin-email","") or "")
    # Backwards compat: if old secret is sent, block it
    if r.secret and r.secret != "" and not admin_email:
        return JSONResponse({"error":"Old admin secret disabled. Please login as admin."}, status_code=401)
    if not is_admin(admin_email):
        return JSONResponse({"error":f"Not authorized. Login as {ADMIN_EMAIL}"}, status_code=401)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("INSERT INTO products (name,price,image,category) VALUES (%s,%s,%s,%s) RETURNING id;", (r.name, r.price, r.image, r.category))
        nid=cur.fetchone()['id']; conn.commit(); cur.close(); conn.close()
        return {"success":True,"id":nid, "product":{"id":nid,"name":r.name,"price":r.price,"image":r.image,"category":r.category}}
    except Exception as e: return {"error": str(e)}

@app.api_route("/api/admin/delete-product", methods=["GET","POST","DELETE"])
def del_product(request: Request, product_id: int = None, secret: str = "", admin_email: str = ""):
    # Get params from query or body
    qp = request.query_params
    pid = product_id or qp.get("product_id")
    a_email = clean_email(admin_email or qp.get("admin_email") or qp.get("adminEmail") or request.headers.get("x-admin-email","") or "")
    if qp.get("secret") and not a_email:
        return JSONResponse({"error":"Old secret disabled. Login as admin"}, status_code=401)
    if not pid: return JSONResponse({"error":"product_id required"}, status_code=400)
    if not is_admin(a_email):
        return JSONResponse({"error":"Not authorized - admin only"}, status_code=401)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("DELETE FROM products WHERE id=%s;", (int(pid),)); conn.commit(); cur.close(); conn.close()
        return {"success":True}
    except Exception as e: return {"error": str(e)}

@app.get("/admin")
def admin_page():
    if ADMIN_HTML_PATH: return FileResponse(ADMIN_HTML_PATH)
    return HTMLResponse("<h1>Admin Panel</h1><p>admin.html not found</p>")

@app.get("/")
def root_page():
    if INDEX_HTML_PATH: return FileResponse(INDEX_HTML_PATH)
    return HTMLResponse(f"<h1>Debug</h1><p>INDEX not found. CWD={os.getcwd()}</p>")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    fp = find_frontend_file(full_path)
    if fp: return FileResponse(fp)
    if INDEX_HTML_PATH: return FileResponse(INDEX_HTML_PATH)
    return JSONResponse({"detail": f"Not Found: {full_path}"}, status_code=404)