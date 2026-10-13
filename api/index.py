import os, pathlib
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL","successbrown222@gmail.com").strip().lower()
ADMIN_EMAILS = [e.strip().lower() for e in ADMIN_EMAIL.split(",") if e.strip()] if "," in ADMIN_EMAIL else [ADMIN_EMAIL] if ADMIN_EMAIL else ["successbrown222@gmail.com"]

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not url:
        print("No DATABASE_URL env")
        return None
    try:
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode="require")
        conn.autocommit = True
        return conn
    except Exception as e:
        print("DB connect fail", e)
        return None

def clean_email(e): 
    return e.strip().lower() if e else ""
def is_admin(email):
    return clean_email(email) in ADMIN_EMAILS

def ensure_tables(conn):
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
    cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT)")
    cur.execute("CREATE TABLE IF NOT EXISTS carts (id SERIAL PRIMARY KEY, email TEXT NOT NULL, product_id INT NOT NULL, qty INT DEFAULT 1, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(email, product_id))")
    cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
    cur.close()

@app.get("/api/health")
def health():
    conn = get_conn()
    return {"ok": True, "db": bool(conn), "admin": ADMIN_EMAILS, "bcrypt": True}

@app.get("/api/products")
def get_products():
    conn = get_conn()
    if not conn:
        return []
    try:
        ensure_tables(conn)
        cur = conn.cursor()
        cur.execute("SELECT id, name, price, image, category FROM products ORDER BY id DESC")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return rows
    except Exception as e:
        print(e)
        return []

@app.post("/api/auth/signup")
async def signup(req: Request):
    data = await req.json()
    email = clean_email(data.get("email",""))
    pw = data.get("password","")
    name = data.get("name","")
    if not email or len(pw)<4:
        return JSONResponse({"error":"Invalid"}, status_code=400)
    conn = get_conn()
    if not conn:
        return JSONResponse({"error":"DB not connected"}, status_code=500)
    ensure_tables(conn)
    cur = conn.cursor()
    try:
        role = "admin" if is_admin(email) else "user"
        cur.execute("INSERT INTO users (email, password, name, role) VALUES (%s,%s,%s,%s) ON CONFLICT (email) DO NOTHING", (email, pw, name, role))
        cur.close(); conn.close()
        return {"ok": True}
    except Exception as e:
        cur.close(); conn.close()
        return JSONResponse({"error": str(e)}, status_code=400)

@app.post("/api/auth/login")
async def login(req: Request):
    data = await req.json()
    email = clean_email(data.get("email",""))
    pw = data.get("password","")
    conn = get_conn()
    if not conn:
        return JSONResponse({"error":"DB not connected"}, status_code=500)
    ensure_tables(conn)
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE LOWER(email)=%s", (email,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row or row["password"] != pw:
        return JSONResponse({"error":"Wrong email or password"}, status_code=401)
    return {"ok": True, "user": {"email": row["email"], "name": row.get("name",""), "role": row.get("role","user")}}

@app.post("/api/admin/add-product")
async def add_product(req: Request):
    data = await req.json()
    admin_email = clean_email(data.get("admin_email") or req.headers.get("x-admin-email",""))
    if not is_admin(admin_email):
        return JSONResponse({"error":"Not authorized"}, status_code=401)
    conn = get_conn()
    ensure_tables(conn)
    cur = conn.cursor()
    cur.execute("INSERT INTO products (name, price, image, category) VALUES (%s,%s,%s,%s) RETURNING id", (data.get("name"), int(data.get("price",0)), data.get("image",""), data.get("category","")))
    nid = cur.fetchone()["id"]
    cur.close(); conn.close()
    return {"success": True, "id": nid}

@app.post("/api/admin/delete-product")
async def delete_product(req: Request):
    data = await req.json()
    pid = data.get("id")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id=%s", (int(pid),))
    cur.close(); conn.close()
    return {"ok": True}

@app.get("/api/cart")
def get_cart(email: str = ""):
    email = clean_email(email)
    conn = get_conn()
    if not conn: return {"ok": True, "items": []}
    ensure_tables(conn)
    cur = conn.cursor()
    cur.execute("SELECT p.id, p.name, p.price, p.image, c.qty FROM carts c JOIN products p ON p.id=c.product_id WHERE LOWER(c.email)=%s", (email,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return {"ok": True, "items": rows}

@app.post("/api/cart/add")
async def cart_add(req: Request):
    data = await req.json()
    email = clean_email(data.get("email",""))
    pid = int(data.get("product_id",0))
    conn = get_conn()
    ensure_tables(conn)
    cur = conn.cursor()
    cur.execute("INSERT INTO carts (email, product_id, qty) VALUES (%s,%s,1) ON CONFLICT (email, product_id) DO UPDATE SET qty = carts.qty+1", (email, pid))
    cur.close(); conn.close()
    return {"ok": True}

@app.post("/api/cart/clear")
async def cart_clear(req: Request):
    data = await req.json()
    email = clean_email(data.get("email",""))
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM carts WHERE LOWER(email)=%s", (email,))
    cur.close(); conn.close()
    return {"ok": True}

@app.get("/api/orders")
def get_orders(email: str = ""):
    email = clean_email(email)
    conn = get_conn()
    if not conn: return []
    ensure_tables(conn)
    cur = conn.cursor()
    if is_admin(email):
        cur.execute("SELECT * FROM orders ORDER BY id DESC")
    else:
        cur.execute("SELECT * FROM orders WHERE LOWER(email)=%s ORDER BY id DESC", (email,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@app.post("/api/orders")
async def create_order(req: Request):
    data = await req.json()
    conn = get_conn()
    ensure_tables(conn)
    cur = conn.cursor()
    cur.execute("INSERT INTO orders (email, items, total, address, phone, state, lga, delivery_date, delivery_time) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id", (clean_email(data.get("email","")), data.get("items",""), int(data.get("total",0)), data.get("address",""), data.get("phone",""), data.get("state",""), data.get("lga",""), data.get("delivery_date",""), data.get("delivery_time","")))
    nid = cur.fetchone()["id"]
    cur.execute("DELETE FROM carts WHERE LOWER(email)=%s", (clean_email(data.get("email","")),))
    cur.close(); conn.close()
    return {"ok": True, "order_id": nid}

@app.delete("/api/orders")
def delete_order(id: int, email: str = ""):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM orders WHERE id=%s", (id,))
    cur.close(); conn.close()
    return {"ok": True}

# serve frontend index/admin if needed
def find_file(name):
    for p in [pathlib.Path(__file__).parent.parent / "frontend" / name, pathlib.Path(__file__).parent / "frontend" / name]:
        if p.exists():
            return p
    return None

@app.get("/admin")
def admin_page():
    f = find_file("admin.html")
    return HTMLResponse(f.read_text()) if f else HTMLResponse("<h1>Admin</h1>")

@app.get("/")
def root_page():
    f = find_file("index.html")
    return HTMLResponse(f.read_text()) if f else HTMLResponse("<h1>Success Fits Running</h1>")