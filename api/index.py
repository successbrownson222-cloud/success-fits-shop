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
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False)

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "successbrown222@gmail.com").strip().lower()
ADMIN_EMAILS = [e.strip().lower() for e in ADMIN_EMAIL.split(",") if e.strip()] or ["successbrown222@gmail.com"]

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not url: return None
    try:
        if "sslmode" in url: conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        else: conn = psycopg2.connect(url, cursor_factory=RealDictCursor, sslmode='require')
        conn.autocommit = True
        return conn
    except Exception as e:
        print("DB connect fail:", e)
        return None

def clean_email(e): return e.strip().lower() if e else ""
def is_admin(email: str):
    email = clean_email(email)
    if not email: return False
    if email in ADMIN_EMAILS: return True
    conn = None
    try:
        conn = get_conn()
        if not conn: return False
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM users WHERE LOWER(email)=%s", (email,))
            row = cur.fetchone()
            return bool(row and row.get('role') == 'admin')
    except: return False
    finally:
        if conn:
            try: conn.close()
            except: pass

def hash_pw(pw: str):
    if HAS_BCRYPT: return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    import hashlib; return hashlib.sha256(pw.encode()).hexdigest()
def check_pw(pw: str, hashed: str):
    if HAS_BCRYPT:
        try: return bcrypt.checkpw(pw.encode(), hashed.encode())
        except: return False
    import hashlib; return hashlib.sha256(pw.encode()).hexdigest() == hashed

class AuthReq(BaseModel): email: str; password: str; name: str = ""
class ProductReq(BaseModel): name: str; price: int; image: str = ""; category: str = "General"; secret: str = ""; admin_email: str = ""; adminEmail: str = ""
class ProductUpdateReq(BaseModel): id: int; name: str = ""; price: int = 0; image: str = ""; category: str = ""; admin_email: str = ""; adminEmail: str = ""; secret: str = ""
class OrderReq(BaseModel): email: str; items: str = ""; total: int = 0; address: str = ""; phone: str = ""; state: str = ""; lga: str = ""; delivery_date: str = ""; delivery_time: str = ""
class CartAddReq(BaseModel): email: str; product_id: int; qty: int = 1; size: str = "M"; color: str = ""
class CartClearReq(BaseModel): email: str
class SimpleLogin(BaseModel): email: str

def find_frontend_file(name: str):
    roots = [pathlib.Path(__file__).parent.parent / "frontend", pathlib.Path.cwd() / "frontend", pathlib.Path("/vercel/path0/frontend"), pathlib.Path("frontend")]
    for r in roots:
        p = r / name
        if p.exists(): return str(p)
    return None

ADMIN_HTML = find_frontend_file("admin.html")
INDEX_HTML = find_frontend_file("index.html")

@app.get("/api/health")
def health():
    conn = get_conn(); db_ok = bool(conn)
    if conn:
        try: conn.close()
        except: pass
    return {"ok": True, "db": db_ok, "bcrypt": HAS_BCRYPT, "admin": ADMIN_EMAILS}

def ensure_cart_table(cur):
    cur.execute("CREATE TABLE IF NOT EXISTS carts (id SERIAL PRIMARY KEY, email TEXT NOT NULL, product_id INT NOT NULL, qty INT DEFAULT 1, created_at TIMESTAMP DEFAULT NOW());")
    cur.execute("ALTER TABLE carts ADD COLUMN IF NOT EXISTS id SERIAL;")
    cur.execute("ALTER TABLE carts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();")
    cur.execute("ALTER TABLE carts ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'M';")
    cur.execute("ALTER TABLE carts ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '';")
    cur.execute("DROP INDEX IF EXISTS idx_carts_email_product_simple;")
    try: cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_email_product_full ON carts(LOWER(email), product_id, size, color);")
    except: pass

@app.post("/api/login")
def simple_login(req: SimpleLogin):
    clean = clean_email(req.email); conn = None
    try:
        conn = get_conn()
        if not conn: return {"ok": True, "items": [], "email": clean}
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            cur.execute("SELECT p.*, COALESCE(c.qty,1) as qty, COALESCE(c.size,'M') as size, COALESCE(c.color,'') as color, c.product_id FROM carts c JOIN products p ON p.id=c.product_id WHERE LOWER(c.email)=LOWER(%s) ORDER BY c.created_at DESC", (clean,))
            rows = cur.fetchall()
        return {"ok": True, "items": rows or [], "email": clean}
    except Exception as e: print("login err", e); return {"ok": True, "items": [], "email": clean}
    finally:
        if conn:
            try: conn.close()
            except: pass

@app.post("/api/auth/signup")
def signup(data: AuthReq):
    email = clean_email(data.email)
    if len(data.password) < 6: return JSONResponse({"error": "Password min 6 chars"}, status_code=400)
    conn = get_conn()
    if not conn: return JSONResponse({"error": "DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
            cur.execute("SELECT COUNT(*) as c FROM users WHERE role='admin'")
            count = cur.fetchone()['c']
            role = "admin" if count == 0 else "user"
            cur.execute("INSERT INTO users (email,password,name,role) VALUES (%s,%s,%s,%s)", (email, hash_pw(data.password), data.name, role))
        return {"ok": True, "role": role}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower(): return JSONResponse({"error": "Email already exists"}, status_code=400)
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.post("/api/auth/login")
def auth_login(data: AuthReq):
    conn = None
    try:
        email = clean_email(data.email); conn = get_conn()
        if not conn: return JSONResponse({"error": "DB not connected"}, status_code=500)
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
            cur.execute("SELECT password, name, role FROM users WHERE LOWER(email)=%s", (email,))
            row = cur.fetchone()
        if not row: return JSONResponse({"error": "User not found"}, status_code=404)
        if not check_pw(data.password, row.get('password') or ""): return JSONResponse({"error": "Wrong password"}, status_code=401)
        return {"ok": True, "user": {"email": email, "name": row.get('name'), "role": row.get('role')}}
    except Exception as e: return JSONResponse({"error": f"Server error: {e}"}, status_code=500)
    finally:
        if conn:
            try: conn.close()
            except: pass

@app.get("/api/products")
def get_products():
    conn = None
    try:
        conn = get_conn()
        if conn:
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT)")
                cur.execute("SELECT id,name,price,image,category FROM products ORDER BY id DESC")
                rows = cur.fetchall()
                return rows or []
    except Exception as e: print("products error", e)
    finally:
        if conn:
            try: conn.close()
            except: pass
    return []

@app.post("/api/admin/add-product")
def add_product(req: ProductReq, request: Request):
    a_email = clean_email(req.admin_email or req.adminEmail or request.headers.get("x-admin-email","") or req.secret)
    if not is_admin(a_email): return JSONResponse({"error": f"Not authorized"}, status_code=401)
    conn = get_conn()
    if not conn: return JSONResponse({"error": "DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price INT, image TEXT, category TEXT)")
            cur.execute("INSERT INTO products (name,price,image,category) VALUES (%s,%s,%s,%s) RETURNING id", (req.name, int(req.price), req.image, req.category))
            nid = cur.fetchone()['id']
        return {"success": True, "id": nid}
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.post("/api/admin/update-product")
def update_product(req: ProductUpdateReq, request: Request):
    a_email = clean_email(req.admin_email or req.adminEmail or request.headers.get("x-admin-email","") or req.secret)
    if not is_admin(a_email): return JSONResponse({"error": "Not authorized"}, status_code=401)
    conn = get_conn()
    if not conn: return JSONResponse({"error": "DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT name, price, image, category FROM products WHERE id=%s", (int(req.id),))
            existing = cur.fetchone()
            if not existing: return JSONResponse({"error": "Product not found"}, status_code=404)
            new_name = req.name if req.name else existing['name']
            new_price = int(req.price) if req.price else existing['price']
            new_image = req.image if req.image else existing['image']
            new_category = req.category if req.category else existing['category']
            cur.execute("UPDATE products SET name=%s, price=%s, image=%s, category=%s WHERE id=%s", (new_name, new_price, new_image, new_category, int(req.id)))
        return {"success": True, "id": req.id}
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.api_route("/api/admin/delete-product", methods=["GET","POST","DELETE"])
def del_product(request: Request):
    qp = request.query_params; pid = qp.get("product_id"); a_email = clean_email(qp.get("admin_email") or request.headers.get("x-admin-email",""))
    if not pid: return JSONResponse({"error":"product_id required"}, status_code=400)
    if not is_admin(a_email): return JSONResponse({"error":"Not authorized"}, status_code=401)
    conn = get_conn()
    if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur: cur.execute("DELETE FROM products WHERE id=%s", (int(pid),))
        return {"success": True}
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.get("/api/cart")
def get_cart(email: str = ""):
    clean = clean_email(email)
    if not clean: return {"items": [], "ok": True}
    conn = get_conn()
    if not conn: return {"items": [], "ok": False}
    try:
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            cur.execute("SELECT p.*, COALESCE(c.qty,1) as qty, COALESCE(c.size,'M') as size, COALESCE(c.color,'') as color, c.product_id FROM carts c JOIN products p ON p.id=c.product_id WHERE LOWER(c.email)=LOWER(%s) ORDER BY c.created_at DESC", (clean,))
            rows = cur.fetchall()
        return {"items": rows or [], "ok": True}
    except Exception as e: return {"items": [], "error": str(e), "ok": False}
    finally:
        try: conn.close()
        except: pass

def _add_cart_logic(email: str, product_id: int, qty: int = 1, size: str = "M", color: str = ""):
    clean = clean_email(email); conn = get_conn()
    if not conn: raise Exception("DB not connected")
    try:
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            cur.execute("SELECT id, qty FROM carts WHERE LOWER(email)=LOWER(%s) AND product_id=%s AND size=%s AND color=%s", (clean, int(product_id), size, color))
            row = cur.fetchone()
            if row: cur.execute("UPDATE carts SET qty = COALESCE(qty,0)+%s WHERE id=%s", (qty, row['id']))
            else: cur.execute("INSERT INTO carts (email, product_id, qty, size, color) VALUES (%s,%s,%s,%s,%s)", (clean, int(product_id), qty, size, color))
            cur.execute("SELECT p.*, COALESCE(c.qty,1) as qty, COALESCE(c.size,'M') as size, COALESCE(c.color,'') as color, c.product_id FROM carts c JOIN products p ON p.id=c.product_id WHERE LOWER(c.email)=LOWER(%s) ORDER BY c.created_at DESC", (clean,))
            rows = cur.fetchall()
        return {"ok": True, "items": rows}
    finally:
        try: conn.close()
        except: pass

@app.post("/api/cart/add")
def add_cart(req: CartAddReq):
    try: return _add_cart_logic(req.email, req.product_id, req.qty, req.size, req.color)
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/cart")
def add_cart_alias(req: CartAddReq):
    try: return _add_cart_logic(req.email, req.product_id, req.qty, req.size, req.color)
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/cart/clear")
def clear_cart_post(req: CartClearReq):
    clean = clean_email(req.email); conn = get_conn()
    if not conn: return JSONResponse({"ok": False}, status_code=500)
    try:
        with conn.cursor() as cur: ensure_cart_table(cur); cur.execute("DELETE FROM carts WHERE LOWER(email)=LOWER(%s)", (clean,))
        return {"ok": True}
    except Exception as e: return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.delete("/api/cart")
def delete_one_cart_item(email: str = "", product_id: int = 0, size: str = "", color: str = ""):
    clean = clean_email(email); conn = get_conn()
    if not conn: return JSONResponse({"ok": False}, status_code=500)
    try:
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            if size or color:
                cur.execute("DELETE FROM carts WHERE LOWER(email)=LOWER(%s) AND product_id=%s AND size=%s AND color=%s", (clean, int(product_id), size, color))
            else:
                cur.execute("DELETE FROM carts WHERE LOWER(email)=LOWER(%s) AND product_id=%s", (clean, int(product_id)))
        return {"ok": True}
    except Exception as e: return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.post("/api/orders")
def create_order(req: OrderReq):
    conn = get_conn()
    if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
            cur.execute("INSERT INTO orders (email,items,total,address,phone,state,lga,delivery_date,delivery_time) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id", (clean_email(req.email), req.items, req.total, req.address, req.phone, req.state, req.lga, req.delivery_date, req.delivery_time))
            nid = cur.fetchone()['id']
        conn2 = get_conn()
        if conn2:
            try:
                with conn2.cursor() as cur2:
                    ensure_cart_table(cur2)
                    cur2.execute("DELETE FROM carts WHERE LOWER(email)=LOWER(%s)", (clean_email(req.email),))
            finally:
                try: conn2.close()
                except: pass
        return {"ok": True, "order_id": nid}
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.get("/api/orders")
def get_orders(email: str = "", all: str = ""):
    conn = get_conn()
    if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
            clean = clean_email(email)
            if all == "true" and is_admin(email): cur.execute("SELECT * FROM orders ORDER BY id DESC")
            else: cur.execute("SELECT * FROM orders WHERE LOWER(email)=LOWER(%s) ORDER BY id DESC", (clean,))
            rows = cur.fetchall()
        return rows
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.delete("/api/orders")
def delete_order(id: int, email: str = ""):
    conn = get_conn()
    if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
    try:
        clean = clean_email(email)
        with conn.cursor() as cur:
            if is_admin(email): cur.execute("DELETE FROM orders WHERE id=%s", (id,))
            else: cur.execute("DELETE FROM orders WHERE id=%s AND LOWER(email)=LOWER(%s)", (id, clean))
        return {"ok": True}
    finally:
        try: conn.close()
        except: pass

# === NEW FEATURES - CART BADGE + ORDER STATUS + ADMIN NOTIFICATIONS ===
@app.get("/api/cart/count")
def cart_count(email: str = ""):
    clean = clean_email(email)
    if not clean: return {"count": 0, "ok": True}
    conn = get_conn()
    if not conn: return {"count": 0, "ok": False}
    try:
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            cur.execute("SELECT COALESCE(SUM(qty),0) as c FROM carts WHERE LOWER(email)=LOWER(%s)", (clean,))
            row = cur.fetchone()
        return {"count": int(row['c'] or 0), "ok": True}
    except Exception as e:
        return {"count": 0, "error": str(e), "ok": False}
    finally:
        try: conn.close()
        except: pass

@app.post("/api/orders/update-status")
@app.get("/api/orders/update-status")
def update_order_status(request: Request):
    qp = request.query_params
    oid = qp.get("id")
    status = qp.get("status", "delivered")
    a_email = clean_email(qp.get("admin_email") or request.headers.get("x-admin-email","") or qp.get("email",""))
    if not oid: return JSONResponse({"error":"id required"}, status_code=400)
    if not is_admin(a_email): return JSONResponse({"error":"Not authorized"}, status_code=401)
    conn = get_conn()
    if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, email TEXT, items TEXT, total INT, address TEXT, phone TEXT, state TEXT, lga TEXT, delivery_date TEXT, delivery_time TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())")
            cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';")
            cur.execute("UPDATE orders SET status=%s WHERE id=%s", (status, int(oid)))
        return {"ok": True, "id": int(oid), "status": status}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.get("/api/orders/stats")
def order_stats(email: str = ""):
    if not is_admin(email): return JSONResponse({"error":"Not authorized"}, status_code=401)
    conn = get_conn()
    if not conn: return JSONResponse({"error":"DB not connected"}, status_code=500)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT status, COUNT(*) as c FROM orders GROUP BY status")
            rows = cur.fetchall()
            total_pending = sum(r['c'] for r in rows if r['status']=='pending')
            total_delivered = sum(r['c'] for r in rows if r['status']=='delivered')
        return {"pending": total_pending, "delivered": total_delivered, "all": rows, "ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass

@app.get("/admin")
def admin_page():
    if ADMIN_HTML: return FileResponse(ADMIN_HTML)
    return HTMLResponse("<h1>Admin not found</h1>", status_code=404)

@app.get("/")
def root_page():
    if INDEX_HTML: return FileResponse(INDEX_HTML)
    return HTMLResponse("<h1>Success Fits Running</h1>")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if full_path.startswith("api/"): return JSONResponse({"detail": f"Not found: {full_path}"}, status_code=404)
    fp = find_frontend_file(full_path)
    if fp: return FileResponse(fp)
    if INDEX_HTML: return FileResponse(INDEX_HTML)
    return JSONResponse({"detail": f"Not found: {full_path}"}, status_code=404)