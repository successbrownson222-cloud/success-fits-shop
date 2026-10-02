from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os, json

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PRODUCTS = [
    {"id":1,"name":"Running Shoes","category":"Shoes","price":89,"image":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"},
    {"id":2,"name":"Denim Jacket","category":"Clothes","price":120,"image":"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500"},
    {"id":3,"name":"Gold Necklace","category":"Jewelry","price":250,"image":"https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500"},
    {"id":4,"name":"Leather Bag","category":"Accessories","price":75,"image":"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500"},
    {"id":5,"name":"White Sneakers","category":"Shoes","price":95,"image":"https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=500"},
    {"id":6,"name":"Black T-Shirt","category":"Clothes","price":35,"image":"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500"},
]
DB_FILE = "/tmp/success_fits_db.json"

def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE,"r") as f: return json.load(f)
        except: pass
    return {"carts":{}, "users":{}}
def save_db(db):
    try:
        with open(DB_FILE,"w") as f: json.dump(db,f)
    except: pass

class LoginReq(BaseModel):
    email: str
class CartReq(BaseModel):
    email: str
    product_id: int

@app.get("/api/products")
def get_products(): return PRODUCTS

@app.post("/api/login")
def login(r: LoginReq):
    db=load_db()
    db["users"][r.email]=True
    if r.email not in db["carts"]: db["carts"][r.email]=[]
    save_db(db)
    return {"email":r.email,"cart":db["carts"][r.email]}

@app.get("/api/cart/{email}")
def get_cart(email: str):
    db=load_db()
    return {"cart": db["carts"].get(email,[])}

@app.post("/api/cart/add")
def add_cart(r: CartReq):
    db=load_db()
    if r.email not in db["carts"]: db["carts"][r.email]=[]
    db["carts"][r.email].append(r.product_id)
    save_db(db)
    return {"cart":db["carts"][r.email]}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    db=load_db()
    db["carts"][r.email]=[]
    save_db(db)
    return {"cart":[]}

@app.get("/")
def root():
    for p in ["frontend/index.html","../frontend/index.html"]:
        if os.path.exists(p): return FileResponse(p)
    return HTMLResponse("<h1>Success Fits API Running</h1>")

@app.get("/{full_path:path}")
def serve_front(full_path: str):
    if full_path.startswith("api/"): return {"detail":"Not Found API"}
    for p in ["frontend/index.html","../frontend/index.html"]:
        if os.path.exists(p): return FileResponse(p)
    return HTMLResponse("<h1>Success Fits</h1>")