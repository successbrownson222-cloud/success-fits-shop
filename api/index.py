from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, pathlib
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    import bcrypt
    HAS_BCRYPT = True
except:
    HAS_BCRYPT = False

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
ADMIN_EMAIL = "successbrownson222@gmail.com"

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not url: return None
    try: return psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
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
    if HAS_BCRYPT: return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    import hashlib; return hashlib.sha256(pw.encode()).hexdigest()

def check_pw(pw: str, hashed: str):
    if HAS_BCRYPT:
        try: return bcrypt.checkpw(pw.encode(), hashed.encode())
        except: return False
    import hashlib; return hashlib.sha256(pw.encode()).hexdigest() == hashed

class AuthReq(BaseModel):
    email: str; password: str; name: str = ""

class ProductReq(BaseModel):
    name: str; price: int; image: str = ""; category: str = "General"
    secret: str = ""; admin_email: str = ""; adminEmail: str = ""

class OrderReq(BaseModel):
    email: str; items: str = ""; total: int = 0; address: str = ""; phone: str = ""
    state: str = ""; lga: str = ""; delivery_date: str = ""; delivery_time: str = ""

class CartAddReq(BaseModel):
    email: str; product_id: int

class CartClearReq(BaseModel):
    email: str

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
        role = "admin" if email == ADMIN_EMAIL else "user"
        cur.execute("INSERT INTO users (email,password,name,role) VALUES (%s,%s,%s,%s)", (email, hash_pw(data.password), data.name, role))
        conn.commit(); cur.close(); conn.close()
        return {"ok": True}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return {"error": "Email already exists, please login"}
        return {"error": str(e)}

@app.post("/api/auth/login")
def auth_login(data: AuthReq):
    try:
        email = clean_email(data.email)
        conn = get_conn()
        if not conn: return {"error": "DB not connected"}
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
        cur.execute("SELECT password, name, role FROM users WHERE LOWER(email)=%s", (email,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row: return {"error": "User not found - sign up first"}
        if not check_pw(data.password, row.get('password') or ""):
            return {"error": "Wrong password"}
        return {"ok": True, "user": {"email": email, "name": row.get('name'), "role": row.get('role')}}
    except Exception as e: return {"error": f"Server error: {e}"}

@app.get("/api/products")
def get_products():
    try:
        conn = get_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT)")
            cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id DESC")
            rows = cur.fetchall()
            cur.close(); conn.close()
            if rows: return rows
    except: pass
    return []

@app.post("/api/admin/add-product")
def add_product(req: ProductReq, request: Request):
    a_email = clean_email(req.admin_email or req.adminEmail or request.headers.get("x-admin-email",""))
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
        cur.execute("DELETE FROM products WHERE id=%s", (int(pid),))
        conn.commit(); cur.close(); conn.close()
        return {"success": True}
    except Exception as e: return {"error": str(e)}

# === CART SYNC - THIS WAS MISSING AND CAUSED YOUR VIDEO BUG ===
def ensure_cart_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS carts (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            product_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

@app.get("/api/cart")
def get_cart(email: str = ""):
    try:
        clean = clean_email(email)
        if not clean: return {"items": []}
        conn = get_conn()
        if not conn: return {"items": []}
        cur = conn.cursor()
        ensure_cart_table(cur)
        cur.execute("""
            SELECT p.* FROM carts c
            JOIN products p ON p.id = c.product_id
            WHERE LOWER(c.email) = %s
            ORDER BY c.created_at DESC
        """, (clean,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {"items": rows or []}
    except Exception as e:
        return {"items": [], "error": str(e)}

@app.post("/api/cart/add")
def add_cart(req: CartAddReq):
    try:
        clean = clean_email(req.email)
        if not clean: return JSONResponse({"error":"email required"}, status_code=400)
        conn = get_conn()
        if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
        cur = conn.cursor()
        ensure_cart_table(cur)
        # prevent duplicate
        cur.execute("SELECT id FROM carts WHERE LOWER(email)=%s AND product_id=%s", (clean, req.product_id))
        if not cur.fetchone():
            cur.execute("INSERT INTO carts (email, product_id) VALUES (%s,%s)", (clean, req.product_id))
            conn.commit()
        cur.execute("""
            SELECT p.* FROM carts c
            JOIN products p ON p.id = c.product_id
            WHERE LOWER(c.email)=%s
        """, (clean,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {"ok": True, "items": rows}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.api_route("/api/cart/clear", methods=["POST","DELETE","OPTIONS"])
def clear_cart(request: Request, email: str = ""):
    # support both JSON body and query param
    try:
        clean = clean_email(email)
        if not clean:
            try:
                body = request.json() if hasattr(request, 'json') else None
            except:
                body = None
            # try pydantic parse from raw
            import json
            try:
                raw = request._body if hasattr(request, '_body') else b''
                if raw:
                    j = json.loads(raw)
                    clean = clean_email(j.get('email',''))
            except:
                pass
        if not clean:
            # fallback to query param email in body dict
            qp_email = request.query_params.get('email','')
            clean = clean_email(qp_email)
        if not clean:
            return JSONResponse({"error":"email required"}, status_code=400)
        conn = get_conn()
        if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
        cur = conn.cursor()
        ensure_cart_table(cur)
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s", (clean,))
        conn.commit(); cur.close(); conn.close()
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.delete("/api/cart")
def delete_one_cart_item(email: str = "", product_id: int = 0):
    try:
        clean = clean_email(email)
        conn = get_conn()
        if not conn: return {"error":"DB not connected"}
        cur = conn.cursor()
        ensure_cart_table(cur)
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s AND product_id=%s", (clean, product_id))
        conn.commit(); cur.close(); conn.close()
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}

# --- ORDERS PRO ---
@app.post("/api/orders")
def create_order(req: OrderReq):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS state TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS lga TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT")
        cur.execute("INSERT INTO orders (email,items,total,address,phone,state,lga,delivery_date,delivery_time) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id", (clean_email(req.email), req.items, req.total, req.address, req.phone, req.state, req.lga, req.delivery_date, req.delivery_time))
        nid = cur.fetchone()['id']; conn.commit(); cur.close(); conn.close()
        return {"ok": True, "order_id": nid}
    except Exception as e: return {"error": str(e)}

@app.get("/api/orders")
def get_orders(email: str = "", all: str = ""):
    try:
        conn = get_conn()
        if not conn: return []
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS state TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS lga TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TEXT")
        cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time TEXT")
        clean = clean_email(email)
        if all == "true" and is_admin(email):
            cur.execute("SELECT * FROM orders ORDER BY id DESC")
        else:
            cur.execute("SELECT * FROM orders WHERE email=%s ORDER BY id DESC", (clean,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return rows
    except Exception as e: return {"error": str(e)}

@app.delete("/api/orders")
def delete_order(id: int, email: str = ""):
    try:
        conn = get_conn()
        if not conn: return {"error": "DB not connected"}
        cur = conn.cursor()
        clean = clean_email(email)
        if is_admin(email):
            cur.execute("DELETE FROM orders WHERE id=%s", (id,))
        else:
            cur.execute("DELETE FROM orders WHERE id=%s AND email=%s", (id, clean))
        conn.commit(); cur.close(); conn.close()
        return {"ok": True}
    except Exception as e: return {"error": str(e)}

@app.api_route("/api/orders/clear", methods=["POST","DELETE"])
def clear_orders(email: str = ""):
    try:
        conn = get_conn()
        if not conn: return {"error": "DB not connected"}
        cur = conn.cursor()
        if is_admin(email):
            cur.execute("DELETE FROM orders")
        else:
            cur.execute("DELETE FROM orders WHERE email=%s", (clean_email(email),))
        conn.commit(); cur.close(); conn.close()
        return {"ok": True}
    except Exception as e: return {"error": str(e)}

@app.get("/admin")
def admin_page():
    if ADMIN_HTML: return FileResponse(ADMIN_HTML)
    return HTMLResponse("<h1>Admin</h1>")

@app.get("/")
def root_page():
    if INDEX_HTML: return FileResponse(INDEX_HTML)
    return HTMLResponse("<h1>Success Fits Running</h1>")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    # serve frontend static files including script.js, manifest.json etc
    fp = find_frontend_file(full_path)
    if fp: return FileResponse(fp)
    # also check for /script.js -> frontend/script.js
    if full_path in ["script.js","manifest.json","style.css"]:
        fp2 = find_frontend_file(full_path)
        if fp2: return FileResponse(fp2)
    if INDEX_HTML: return FileResponse(INDEX_HTML)
    return JSONResponse({"detail": f"Not found: {full_path}"}, status_code=404)