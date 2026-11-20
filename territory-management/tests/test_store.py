import json
import threading
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from tm.seed import seed
from tm.server import make_handler
from tm.store import MASTER, Invalid, Store


@pytest.fixture
def store():
    s = Store(":memory:")
    seed(s)
    return s


def terr(store, sid, account):
    return {a.territory for a in store.align(sid) if a.account == account}


def test_seed_alignment(store):
    assert terr(store, MASTER, "A001") == {"HEM-KAM"}           # centre of excellence
    assert terr(store, MASTER, "A002") == {"HEM-EAST"}
    assert terr(store, MASTER, "A007") == {"HEM-WEST"}
    assert terr(store, MASTER, "A008") == {"IMM-NORTH"}
    assert terr(store, MASTER, "A012") == set()                  # GP: not targeted
    summary = {t["code"]: t for t in store.territory_summary(MASTER)}
    assert summary["HEM-SE"]["accounts"] == 9
    assert summary["HEM-KAM"]["roster"][0]["person"] == "Alex Berg"


def test_scenario_is_isolated_then_published(store):
    s = store.create_scenario("Split east")
    sid = s["id"]
    store.add_territory(sid, "HEM-NORTH", "Hematology North", "HEM", "HEM-SE")
    for p in ("83", "90"):
        store.add_geo_rule(sid, "HEM-NORTH", p)
    assert terr(store, sid, "A010") == {"HEM-NORTH"}
    assert terr(store, MASTER, "A010") == {"HEM-EAST"}

    changes = store.diff(MASTER, sid)
    assert [(c.account, c.before, c.after) for c in changes] == [("A010", ("HEM-EAST",), ("HEM-NORTH",))]

    store.publish_scenario(sid)
    assert terr(store, MASTER, "A010") == {"HEM-NORTH"}
    with pytest.raises(Invalid):
        store.add_geo_rule(sid, "HEM-NORTH", "7")                # published = read-only


def test_feedback_flow(store):
    fid = store.submit_feedback("A012", "HEM-EAST", "add", "Sam Lind", "treats ITP patients")
    store.resolve_feedback(fid, True, "Charlie Nyberg")
    assert terr(store, MASTER, "A012") == {"HEM-EAST"}
    fid2 = store.submit_feedback("A002", "HEM-EAST", "drop", "Sam Lind")
    store.resolve_feedback(fid2, False, "Charlie Nyberg")
    assert terr(store, MASTER, "A002") == {"HEM-EAST"}
    with pytest.raises(Invalid):
        store.resolve_feedback(fid2, True, "x")


def test_validation(store):
    with pytest.raises(Invalid):
        store.add_territory(MASTER, "X", "X", "NOPE")
    with pytest.raises(Invalid):
        store.add_territory(MASTER, "X", "X", "IMM", "HEM-SE")   # parent in other field force
    with pytest.raises(Invalid):
        store.add_account_rule(MASTER, "HEM-KAM", [{"field": "a", "op": "bad", "value": 1}])
    with pytest.raises(Invalid):
        store.delete_territory(MASTER, "HEM-SE")                 # has children
    with pytest.raises(Invalid):
        store.delete_scenario(MASTER)


def test_account_import_update_keeps_manual(store):
    store.add_manual(MASTER, "A012", "IMM-NORTH", "include")
    n = store.import_accounts_csv("id,name,specialty,postal_code,potential,tier\nA012,Meadow Practice,General practice,118 20,7,B\nA099,New Clinic,Hematology,211 50,20,A\n")
    assert n == 2
    assert terr(store, MASTER, "A012") == {"IMM-NORTH"}
    assert terr(store, MASTER, "A099") == {"HEM-WEST"}
    assert next(a for a in store.accounts() if a["id"] == "A099")["tier"] == "A"


def test_export_csv(store):
    lines = store.export_csv(MASTER).splitlines()
    assert lines[0].startswith("account_id,account_name,field_force,territory")
    assert any(l.startswith("A001,Northgate University Hospital,HEM,HEM-KAM,account_rule") for l in lines)


def test_http_api(store):
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(store))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    def call(method, path, body=None):
        req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    try:
        code, body = call("GET", "/")
        assert code == 200 and b"Territory Manager" in body
        code, body = call("POST", "/api/scenarios", {"name": "Test"})
        sid = json.loads(body)["id"]
        code, _ = call("POST", f"/api/scenarios/{sid}/rules/geo", {"territory": "HEM-WEST", "postal_prefix": "90"})
        assert code == 200
        code, body = call("GET", f"/api/diff?base=1&target={sid}")
        assert [c["account"] for c in json.loads(body)] == ["A010"]
        code, body = call("POST", f"/api/scenarios/{sid}/rules/geo", {"territory": "NOPE", "postal_prefix": "1"})
        assert code == 400 and "does not exist" in json.loads(body)["error"]
        code, body = call("GET", f"/api/scenarios/{sid}/accounts?q=" + urllib.parse.quote("umeå"))
        assert [a["id"] for a in json.loads(body)] == ["A010"]
        code, body = call("GET", f"/api/scenarios/{sid}/export.csv")
        assert code == 200 and body.startswith(b"account_id")
        assert call("GET", "/../store.py")[0] == 404
    finally:
        httpd.shutdown()
