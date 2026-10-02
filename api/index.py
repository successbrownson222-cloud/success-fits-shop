
from fastapi.responses import FileResponse, HTMLResponse
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- FAKE DB (for HNG demo video, this is enough. For production you would use Supabase table) ---
USERS_DB = {}  # email -> logged_in bool
CARTS_DB = {}  # email -> [product_ids]

PRODUCTS = [
  {"id":1, "name":"Air Max Sneaker", "price":45000, "category":"Shoes", "image":"https://images.unsplash.com/photo-1542291026-7eec264c27ff"},
  {"id":2, "name":"Vintage Denim Jacket", "price":32000, "category":"Clothes", "image":"https://images.unsplash.com/photo-1551537482-f2075a1d41f2"},
  {"id":3, "name":"Gold Layered Necklace", "price":15000, "category":"Jewelry", "image":"https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f"},
  {"id":4, "name":"Leather Cross Bag", "price":28000, "category":"Accessories", "image":"https://images.unsplash.com/photo-1548036328-c9fa89d128fa"},
]

class LoginRequest(BaseModel):
    email: str

class CartRequest(BaseModel):
    email: str
    product_id: int

# 1. LOGIN - same for web and mobile
@app.post("/api/login")
def login(req: LoginRequest):
    USERS_DB[req.email] = True
    if req.email not in CARTS_DB:
        CARTS_DB[req.email] = []
    return {"message": "Logged in", "email": req.email, "cart": CARTS_DB[req.email]}

# 2. LOGOUT
@app.post("/api/logout")
def logout(req: LoginRequest):
    USERS_DB[req.email] = False
    return {"message": "Logged out"}

# 3. PRODUCTS - same endpoint for both
@app.get("/api/products")
def get_products():
    return PRODUCTS

# 4. GET CART - for sync check
@app.get("/api/cart/{email}")
def get_cart(email: str):
    return {"email": email, "items": CARTS_DB.get(email, [])}

# 5. ADD TO CART - this is where INSTANT sync happens
@app.post("/api/cart/add")
def add_to_cart(req: CartRequest):
    if req.email not in CARTS_DB:
        CARTS_DB[req.email] = []
    CARTS_DB[req.email].append(req.product_id)
    return {"email": req.email, "items": CARTS_DB[req.email]}

@app.delete("/api/cart/clear")
def clear_cart(req: LoginRequest):
    CARTS_DB[req.email] = []
    return {"message": "Cart cleared"}

@app.get("/")
def root():
    # Try to find frontend file
    for p in ["frontend/index.html", "../frontend/index.html", "./frontend/index.html"]:
        if os.path.exists(p):
            return FileResponse(p)
    return HTMLResponse("<h1>Success Fits Shop API is running! Frontend missing - check vercel.json</h1>")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if full_path.startswith("api/"):
        return {"detail":"Not Found"}
    for p in ["frontend/index.html", "../frontend/index.html"]:
        if os.path.exists(p):
            return FileResponse(p)
    return FileResponse(p) if os.path.exists(p) else HTMLResponse("<h1>Success Fits</h1>")