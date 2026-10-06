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

        conn = psycopg2.connect(os.environ.get('POSTGRES_URL'))
        cur = conn.cursor()
        cur.execute("SELECT email, password, name, role FROM users WHERE email=%s", (email,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            self.send_response(404)
            self.send_header('Content-type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error":"User not found"}).encode())
            return

        db_email, db_pass, db_name, db_role = row
        if bcrypt.checkpw(password.encode(), db_pass.encode()):
            self.send_response(200)
            self.send_header('Content-type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"ok":True, "user":{"email":db_email, "name":db_name, "role":db_role}}).encode())
        else:
            self.send_response(401)
            self.send_header('Content-type','application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error":"Wrong password"}).encode())