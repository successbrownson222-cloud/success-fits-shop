# COPY THESE 2 FIXES INTO api/index.py

# FIX 1 - Find def _add_cart_logic and REPLACE it with this:
def _add_cart_logic_fixed(email: str, product_id: int, qty: int = 1, size: str = "M", color: str = ""):
    clean = clean_email(email)
    conn = get_conn()
    if not conn: raise Exception("DB not connected")
    try:
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            cur.execute("SELECT id, qty FROM carts WHERE LOWER(email)=LOWER(%s) AND product_id=%s AND size=%s AND color=%s", (clean, int(product_id), size, color))
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE carts SET qty = COALESCE(qty,0)+%s WHERE id=%s", (qty, row['id']))
            else:
                cur.execute("INSERT INTO carts (email, product_id, qty, size, color) VALUES (%s,%s,%s,%s,%s)", (clean, int(product_id), qty, size, color))
            cur.execute("""
                SELECT p.*, COALESCE(c.qty,1) as qty, COALESCE(c.size,'M') as size, COALESCE(c.color,'') as color, c.product_id 
                FROM carts c JOIN products p ON p.id=c.product_id 
                WHERE LOWER(c.email)=LOWER(%s) ORDER BY c.id DESC
            """, (clean,))
            rows = cur.fetchall()
        return {"ok": True, "items": rows}
    finally:
        try: conn.close()
        except: pass

# FIX 2 - Find def delete_one_cart_item and REPLACE it with this:
def delete_one_cart_item_fixed(email: str = "", product_id: int = 0, size: str = "", color: str = ""):
    clean = clean_email(email)
    conn = get_conn()
    if not conn:
        return JSONResponse({"ok": False}, status_code=500)
    try:
        with conn.cursor() as cur:
            ensure_cart_table(cur)
            if size or color:
                cur.execute("DELETE FROM carts WHERE LOWER(email)=LOWER(%s) AND product_id=%s AND size=%s AND color=%s", (clean, int(product_id), size, color))
            else:
                cur.execute("DELETE FROM carts WHERE LOWER(email)=LOWER(%s) AND product_id=%s", (clean, int(product_id)))
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    finally:
        try: conn.close()
        except: pass