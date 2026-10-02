from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from typing import List, Dict
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

USERS_DB = {}
CARTS_DB = {}
PRODUCTS = [
    {"id":1,"name":"Running Shoes","category":"Shoes","price":89,"image":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"},
    {"id":2,"name":"Denim Jacket","category":"Clothes","price":120,"image":"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500"},
    {"id":3,"name":"Gold Necklace","category":"Jewelry","price":250,"image":"https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500"},
    {"id":4,"name":"Leather Bag","category":"Accessories","price":75,"image":"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500"},
    {"id":5,"name":"Sneakers White","category":"Shoes","price":95,"image":"https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=500"},
    {"id":6,"name":"T-Shirt Black","category":"Clothes","price":35,"image":"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500"},
]

class LoginReq(BaseModel):
    email: str
class CartReq(BaseModel):
    email: str
    product_id: int

@app.get("/api/products")
def get_products():
    return PRODUCTS

@app.post("/api/login")
def login(r: LoginReq):
    USERS_DB[r.email] = True
    if r.email not in CARTS_DB: CARTS_DB[r.email]=[]
    return {"email": r.email, "cart": CARTS_DB[r.email]}

@app.get("/api/cart/{email}")
def get_cart(email: str):
    return {"cart": CARTS_DB.get(email, [])}

@app.post("/api/cart/add")
def add_cart(r: CartReq):
    if r.email not in CARTS_DB: CARTS_DB[r.email]=[]
    CARTS_DB[r.email].append(r.product_id)
    return {"cart": CARTS_DB[r.email]}

@app.post("/api/cart/clear")
def clear_cart(r: LoginReq):
    CARTS_DB[r.email]=[]
    return {"cart": []}

@app.get("/")
def root():
    for p in ["frontend/index.html","../frontend/index.html"]:
        if os.path.exists(p): return FileResponse(p)
    return HTMLResponse("<h1>Success Fits API Running</h1>")

@app.get("/{full_path:path}")
def serve_front(full_path: str):
    # Don't interfere with api
    if full_path.startswith("api/"):
        return {"detail":"Not Found API"}
    for p in ["frontend/index.html","../frontend/index.html"]:
        if os.path.exists(p): return FileResponse(p)
    return HTMLResponse("<h1>Success Fits</h1>")