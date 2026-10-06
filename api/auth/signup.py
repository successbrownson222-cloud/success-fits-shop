from http.server import BaseHTTPRequestHandler
import json, os, bcrypt
import psycopg2

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len)
        data = json.loads(body)
        
        email = data.get('email','').lower().strip()
        password = data.get('password','')
        name = data.get('name','')

        if not email or not password:
            self.send_response(400)
            self.send_header('Content-type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error":"Fill all fields"}).encode())
            return

        conn = psycopg2.connect(os.environ.get('POSTGRES_URL'))
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')")

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        try:
            cur.execute("INSERT INTO users (email, password, name) VALUES (%s,%s,%s)", (email, hashed, name))
            conn.commit()
            self.send_response(200)
            self.send_header('Content-type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"ok":True, "message":"Account created"}).encode())
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error":"Email already exists"}).encode())
        finally:
            cur.close()
            conn.close()