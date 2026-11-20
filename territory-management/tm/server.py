"""JSON API and static UI on the standard-library HTTP server."""

from __future__ import annotations

import json
import re
import threading
import webbrowser
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from urllib.parse import parse_qs, urlparse

from . import __version__
from .store import Invalid, NotFound, Store

# Loaded through importlib.resources so it also works from a .pyz or a frozen executable.
STATIC_FILES = {"/": "index.html", "/index.html": "index.html"}
ROUTES: list[tuple[str, re.Pattern, callable]] = []


def route(method: str, pattern: str):
    def wrap(fn):
        ROUTES.append((method, re.compile(f"^{pattern}$"), fn))
        return fn
    return wrap


S = r"(?P<sid>\d+)"


@route("GET", "/api/field-forces")
def _ff(st, q, b): return st.field_forces()

@route("POST", "/api/field-forces")
def _ff_new(st, q, b):
    code = (b.get("code") or "").strip()
    if not code or not b.get("name"):
        raise Invalid("field force needs code and name")
    st.upsert_field_force(code, b["name"], b.get("target_conditions") or [])
    return {"ok": True}

@route("GET", "/api/info")
def _info(st, q, b): return {"version": __version__, "database": st.path}

@route("GET", "/api/scenarios")
def _scen(st, q, b): return st.scenarios()

@route("POST", "/api/scenarios")
def _scen_new(st, q, b): return st.create_scenario(b.get("name") or "Untitled scenario", int(b.get("base_id") or 1))

@route("DELETE", f"/api/scenarios/{S}")
def _scen_del(st, q, b, sid): st.delete_scenario(int(sid)); return {"ok": True}

@route("POST", f"/api/scenarios/{S}/publish")
def _publish(st, q, b, sid): return {"changes": [asdict(c) for c in st.publish_scenario(int(sid))]}

@route("GET", f"/api/scenarios/{S}/territories")
def _terr(st, q, b, sid): return st.territory_summary(int(sid))

@route("POST", f"/api/scenarios/{S}/territories")
def _terr_new(st, q, b, sid):
    st.add_territory(int(sid), b.get("code"), b.get("name"), b.get("field_force"), b.get("parent") or None)
    return {"ok": True}

@route("DELETE", f"/api/scenarios/{S}/territories/(?P<code>[^/]+)")
def _terr_del(st, q, b, sid, code): st.delete_territory(int(sid), code); return {"ok": True}

@route("GET", f"/api/scenarios/{S}/rules")
def _rules(st, q, b, sid): return st.rules(int(sid))

@route("POST", f"/api/scenarios/{S}/rules/account")
def _rule_acct(st, q, b, sid):
    return {"id": st.add_account_rule(int(sid), b.get("territory"), b.get("conditions"), b.get("priority", 100), b.get("name", ""))}

@route("POST", f"/api/scenarios/{S}/rules/geo")
def _rule_geo(st, q, b, sid): return {"id": st.add_geo_rule(int(sid), b.get("territory"), b.get("postal_prefix"))}

@route("POST", f"/api/scenarios/{S}/rules/manual")
def _rule_man(st, q, b, sid):
    return {"id": st.add_manual(int(sid), b.get("account"), b.get("territory"), b.get("action"), b.get("note", ""))}

@route("DELETE", f"/api/scenarios/{S}/rules/(?P<kind>account|geo|manual)/(?P<rid>\\d+)")
def _rule_del(st, q, b, sid, kind, rid): st.delete_rule(int(sid), kind, int(rid)); return {"ok": True}

@route("GET", f"/api/scenarios/{S}/accounts")
def _accounts(st, q, b, sid):
    by_acct: dict[str, list] = {}
    for a in st.align(int(sid)):
        by_acct.setdefault(a.account, []).append(asdict(a))
    term = (q.get("q") or [""])[0].lower()
    out = []
    for acct in st.accounts():
        if term and term not in " ".join(str(v) for v in acct.values()).lower():
            continue
        out.append({**acct, "assignments": by_acct.get(acct["id"], [])})
    return out

@route("GET", "/api/diff")
def _diff(st, q, b):
    base, target = int(q.get("base", ["1"])[0]), int(q["target"][0])
    return [asdict(c) for c in st.diff(base, target)]

@route("GET", "/api/roster")
def _roster(st, q, b): return st.roster()

@route("POST", "/api/roster")
def _roster_new(st, q, b):
    return {"id": st.add_roster(b.get("territory"), b.get("person"), b.get("email", ""), b.get("role", "rep"))}

@route("GET", "/api/feedback")
def _fb(st, q, b): return st.feedback((q.get("status") or [None])[0])

@route("POST", "/api/feedback")
def _fb_new(st, q, b):
    return {"id": st.submit_feedback(b.get("account"), b.get("territory"), b.get("action"), b.get("requested_by"), b.get("comment", ""))}

@route("POST", "/api/feedback/(?P<fid>\\d+)/(?P<decision>approve|reject)")
def _fb_resolve(st, q, b, fid, decision):
    st.resolve_feedback(int(fid), decision == "approve", b.get("resolved_by") or "manager")
    return {"ok": True}

@route("POST", "/api/accounts/import")
def _import(st, q, b): return {"imported": st.import_accounts_csv(b.get("csv", ""))}


def make_handler(store: Store):
    lock = threading.Lock()  # one shared SQLite connection

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass

        def _send(self, code, body: bytes, ctype="application/json", extra=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code, obj):
            self._send(code, json.dumps(obj, ensure_ascii=False).encode())

        def _dispatch(self, method):
            url = urlparse(self.path)
            q = parse_qs(url.query)
            if method == "GET" and not url.path.startswith("/api/"):
                return self._static(url.path)
            m = re.fullmatch(rf"/api/scenarios/{S}/export\.csv", url.path)
            if method == "GET" and m:
                with lock:
                    data = "\ufeff".encode() + store.export_csv(int(m["sid"])).encode()
                return self._send(200, data, "text/csv; charset=utf-8",
                                  {"Content-Disposition": f'attachment; filename="alignment-{m["sid"]}.csv"'})
            body = {}
            if method in ("POST", "PUT"):
                n = int(self.headers.get("Content-Length") or 0)
                try:
                    body = json.loads(self.rfile.read(n) or b"{}")
                except json.JSONDecodeError:
                    return self._json(400, {"error": "invalid JSON body"})
            for meth, pat, fn in ROUTES:
                if meth != method:
                    continue
                m = pat.match(url.path)
                if m:
                    try:
                        with lock:
                            return self._json(200, fn(store, q, body, **m.groupdict()))
                    except NotFound as e:
                        return self._json(404, {"error": f"not found: {e}"})
                    except (Invalid, ValueError, KeyError) as e:
                        return self._json(400, {"error": str(e)})
            self._json(404, {"error": "no such endpoint"})

        def _static(self, path):
            name = STATIC_FILES.get(path)
            if not name:
                return self._send(404, b"not found", "text/plain")
            body = files("tm").joinpath("static", name).read_bytes()
            self._send(200, body, "text/html; charset=utf-8", {"Cache-Control": "no-store"})

        def do_GET(self): self._dispatch("GET")
        def do_POST(self): self._dispatch("POST")
        def do_DELETE(self): self._dispatch("DELETE")

    return Handler


def serve(store: Store, host="127.0.0.1", port=8765, open_browser=False):
    try:
        httpd = ThreadingHTTPServer((host, port), make_handler(store))
    except OSError:
        httpd = ThreadingHTTPServer((host, 0), make_handler(store))  # port busy: take any free one
    url = f"http://{host}:{httpd.server_address[1]}/"
    print(f"Territory Manager {__version__}")
    print(f"  Open:     {url}")
    print(f"  Database: {store.path}")
    print("  Close this window (or press Ctrl+C) to stop.")
    if open_browser:
        threading.Timer(0.5, webbrowser.open, (url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
