from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import bcrypt,os, pathlib
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/api/auth/signup")
def signup(data: dict):
    email = data.get("email","").lower().strip()
    password = data.get("password","")
    name = data.get("name","")
    conn = psycopg2.connect(os.environ.get("POSTGRES_URL"))
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        cur.execute("INSERT INTO users (email,password,name) VALUES (%s,%s,%s)", (email, hashed, name))
        conn.commit()
        return {"ok":True}
    except:
        return {"error":"Email already exists"}
    finally:
        cur.close(); conn.close()

@app.post("/api/auth/login")
def login(data: dict):
    email = data.get("email","").lower().strip()
    password = data.get("password","")
    conn = psycopg2.connect(os.environ.get("POSTGRES_URL"))
    cur = conn.cursor()
    cur.execute("SELECT password, name, role FROM users WHERE email=%s", (email,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return {"error":"User not found"}
    if bcrypt.checkpw(password.encode(), row[0].encode()):
        return {"ok":True, "user":{"email":email, "name":row[1], "role":row[2]}}
    return {"error":"Wrong password"}

def get_conn():
    url = os.getenv("POSTGRES_URL_NON_POOLING") or os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
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

def find_frontend_file(name: str):
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
    if not email:
        return {"cart": [], "items": []}
    try:
        conn=get_conn()
        if not conn: return {"cart": [], "items": []}
        cur=conn.cursor()
        # Return FULL product details for mobile sync
        cur.execute("""
            SELECT p.id, p.name, p.price, p.image, p.category
            FROM carts c
            JOIN products p ON p.id = c.product_id
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
def login(r: LoginReq):
    return get_cart(r.email)

@app.post("/api/cart/add")
def add_cart(r: CartAddReq):
    email=clean_email(r.email)
    try:
        conn=get_conn()
        cur=conn.cursor()
        # FIXED: always use cleaned email
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s AND product_id=%s;", (email, r.product_id))
        cur.execute("INSERT INTO carts (email,product_id) VALUES (%s,%s);", (email, r.product_id))
        conn.commit()
        # Return updated full cart for instant sync
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
        print(f"add_cart error: {e}")
        return {"cart":[], "items": [], "error": str(e)}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    try:
        email=clean_email(r.email); conn=get_conn(); cur=conn.cursor()
        cur.execute("DELETE FROM carts WHERE LOWER(email)=%s;", (email,))
        conn.commit(); cur.close(); conn.close()
    except Exception as e: print(e)
    return {"cart":[], "items": []}

@app.post("/api/admin/add-product")
def add_product(r: ProductReq):
    if not check_admin(r.secret): return JSONResponse({"error":"wrong admin secret"}, status_code=401)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("INSERT INTO products (name,price,image,category) VALUES (%s,%s,%s,%s) RETURNING id;", (r.name, r.price, r.image, r.category))
        nid=cur.fetchone()['id']; conn.commit(); cur.close(); conn.close()
        return {"success":True,"id":nid}
    except Exception as e: return {"error": str(e)}

@app.post("/api/admin/delete-product")
def del_product(product_id: int, secret: str = ""):
    if not check_admin(secret): return JSONResponse({"error":"wrong admin secret"}, status_code=401)
    try:
        conn=get_conn(); cur=conn.cursor()
        cur.execute("DELETE FROM products WHERE id=%s;", (product_id,)); conn.commit(); cur.close(); conn.close()
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