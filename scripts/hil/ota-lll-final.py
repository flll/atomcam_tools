#!/usr/bin/env python3
import json, subprocess, time, urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading

HOST, IP, PORT = "10.0.0.228", "10.0.0.249", 8877
ZIP = "/tmp/webui-fix2.zip"
URL = f"http://{IP}:{PORT}/webui-fix2.zip"
seen = threading.Event()

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory="/tmp", **kw)
    def log_message(self, fmt, *args):
        msg = fmt % args
        print(self.client_address[0], msg)
        if self.client_address[0] == HOST and "200" in msg:
            seen.set()

def wait_cam():
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://{HOST}/", timeout=5)
            return
        except Exception:
            time.sleep(5)
    raise SystemExit("camera down")

def main():
    wait_cam()
    httpd = ThreadingHTTPServer((IP, PORT), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    cfg = {}
    with urllib.request.urlopen(f"http://{HOST}/cgi-bin/hack_ini.cgi", timeout=20) as r:
        for line in r.read().decode().splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    cfg["CUSTOM_ZIP"] = "on"
    cfg["CUSTOM_ZIP_URL"] = URL
    req = urllib.request.Request(
        f"http://{HOST}/cgi-bin/hack_ini.cgi",
        json.dumps(cfg).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=60)
    print("hack_ini", URL)
    req2 = urllib.request.Request(
        f"http://{HOST}/cgi-bin/cmd.cgi",
        json.dumps({"exec": "update"}).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req2, timeout=15) as r:
            print(r.read().decode())
    except Exception as e:
        print("update", e)
    for i in range(120):
        if seen.is_set():
            print("download ok")
            break
        time.sleep(5)
    else:
        print("no download from camera")
    time.sleep(90)
    httpd.shutdown()
    # verify
    html = urllib.request.urlopen(f"http://{HOST}/", timeout=10).read().decode()
    print("index snippet:", "css.gz" in html, html[html.find("stylesheet")-20:html.find("stylesheet")+80] if "stylesheet" in html else "")
    css = "./assets/index-DE5SR0at.css.gz" if "css.gz" in html else "./assets/index-DE5SR0at.css"
    css = css.replace("./", "/")
    try:
        st = urllib.request.urlopen(f"http://{HOST}{css}", timeout=10).status
        print("css status", st)
    except Exception as e:
        print("css fail", e)

if __name__ == "__main__":
    main()
