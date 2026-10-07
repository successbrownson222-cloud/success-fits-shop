from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, pathlib, json
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    import bcrypt
    HAS_BCRYPT = True
except:
    import hashlib
    HAS_BCRYPT = False

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
ADMIN_EMAIL = "successbrownson222@gmail.com"

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not url: return None
    try:
        return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
    except: return None

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
    except: return False

def hash_pw(pw: str):
    if HAS_BCRYPT:
        return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    import hashlib
    return hashlib.sha256(pw.encode()).hexdigest()

def check_pw(pw: str, hashed: str):
    if HAS_BCRYPT:
        try: return bcrypt.checkpw(pw.encode(), hashed.encode())
        except: return False
    import hashlib
    return hashlib.sha256(pw.encode()).hexdigest() == hashed

class AuthReq(BaseModel):
    email: str; password: str; name: str = ""

class LoginReq(BaseModel): email: str
class CartAddReq(BaseModel): email: str; product_id: int
class ProductReq(BaseModel):
    name: str; price: int; image: str = ""; category: str = "General"
    secret: str = ""; admin_email: str = ""; adminEmail: str = ""

def find_frontend_file(name: str):
    roots = [pathlib.Path(__file__).parent.parent / "frontend", pathlib.Path.cwd() / "frontend", pathlib.Path("/vercel/path0/frontend"), pathlib.Path("frontend")]
    for r in roots:
        p = r / name
        if p.exists(): return str(p)
    return None

ADMIN_HTML = find_frontend_file("admin.html")
INDEX_HTML = find_frontend_file("index.html")

@app.get("/api/health")
def health(): return {"ok": True, "bcrypt": HAS_BCRYPT}

@app.post("/api/auth/signup")
def signup(data: AuthReq):
    email = clean_email(data.email)
    if len(data.password) < 6: return {"error": "Password min 6 chars"}
    conn = get_conn()
    if not conn: return {"error": "DB not connected"}
    try:
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'")
        role = "admin" if email == ADMIN_EMAIL else "user"
        cur.execute("INSERT INTO users (email,password,name,role) VALUES (%s,%s,%s,%s)", (email, hash_pw(data.password), data.name, role))
        conn.commit()
        cur.close(); conn.close()
        return {"ok": True}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return {"error": "Email already exists, please login"}
        return {"error": str(e)}
    finally:
        try: cur.close(); conn.close()
        except: pass

@app.post("/api/auth/login")
def auth_login(data: AuthReq):
    try:
        email = clean_email(data.email)
        conn = get_conn()
        if not conn: return {"error": "DB not connected - check POSTGRES_URL in Vercel env"}
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'")
        cur.execute("SELECT password, name, role FROM users WHERE LOWER(email)=%s", (email,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row: return {"error": "User not found - click Create Admin Account first"}
        pw = row.get('password') if isinstance(row, dict) else row[0]
        name = row.get('name') if isinstance(row, dict) else row[1]
        role = row.get('role') if isinstance(row, dict) else row[2]
        if check_pw(data.password, pw):
            return {"ok": True, "user": {"email": email, "name": name, "role": role}}
        return {"error": "Wrong password"}
    except Exception as e:
        print(f"Login crash: {e}")
        return {"error": f"Server error: {e}"}

@app.get("/api/products")
def get_products():
    try:
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id DESC")
            rows = cur.fetchall()
            cur.close(); conn.close()
            if rows: return rows
    except Exception as e: print(e)
    return []

@app.post("/api/admin/add-product")
def add_product(req: ProductReq, request: Request):
    a_email = clean_email(req.admin_email or req.adminEmail or request.headers.get("x-admin-email",""))
    if req.secret and not a_email: return JSONResponse({"error":"Old secret disabled, login as admin"}, status_code=401)
    if not is_admin(a_email): return JSONResponse({"error": f"Not authorized. Login as {ADMIN_EMAIL}"}, status_code=401)
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT)")
        cur.execute("INSERT INTO products (name,price,image,category) VALUES (%s,%s,%s,%s) RETURNING id", (req.name, req.price, req.image, req.category))
        nid = cur.fetchone()['id']; conn.commit(); cur.close(); conn.close()
        return {"success": True, "id": nid}
    except Exception as e: return {"error": str(e)}

@app.api_route("/api/admin/delete-product", methods=["GET","POST","DELETE"])
def del_product(request: Request):
    qp = request.query_params
    pid = qp.get("product_id"); a_email = clean_email(qp.get("admin_email") or request.headers.get("x-admin-email",""))
    if not pid: return JSONResponse({"error":"product_id required"}, status_code=400)
    if not is_admin(a_email): return JSONResponse({"error":"Not authorized"}, status_code=401)
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("DELETE FROM products WHERE id=%s", (int(pid),)); conn.commit(); cur.close(); conn.close()
        return {"success": True}
    except Exception as e: return {"error": str(e)}

@app.get("/admin")
def admin_page():
    if ADMIN_HTML: return FileResponse(ADMIN_HTML)
    return HTMLResponse("<h1>Admin</h1><p>admin.html missing</p>")

@app.get("/")
def root_page():
    if INDEX_HTML: return FileResponse(INDEX_HTML)
    return HTMLResponse("<h1>Success Fits Shop Running</h1><p><a href='/admin'>/admin</a> | <a href='/api/health'>/api/health</a></p>")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    fp = find_frontend_file(full_path)
    if fp: return FileResponse(fp)
    if INDEX_HTML: return FileResponse(INDEX_HTML)
    return JSONResponse({"detail": f"Not found: {full_path}"}, status_code=404)