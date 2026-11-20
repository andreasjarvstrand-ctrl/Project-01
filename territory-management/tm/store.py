"""SQLite storage and the operations built on it (scenarios, feedback, export)."""

from __future__ import annotations

import csv
import io
import json
import sqlite3
from datetime import datetime, timezone

from . import engine as E

MASTER = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',      -- master | draft | published
  base_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS field_forces (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_conditions TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT, specialty TEXT, segment TEXT,
  postal_code TEXT, city TEXT,
  potential REAL DEFAULT 0,
  attrs TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS territories (
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  field_force TEXT NOT NULL REFERENCES field_forces(code),
  parent TEXT,
  PRIMARY KEY (scenario_id, code)
);
CREATE TABLE IF NOT EXISTS account_rules (
  id INTEGER PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  territory TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 100,
  conditions TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS geo_rules (
  id INTEGER PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  territory TEXT NOT NULL,
  postal_prefix TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manual_assignments (
  id INTEGER PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  account TEXT NOT NULL REFERENCES accounts(id),
  territory TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('include','exclude')),
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS roster (
  id INTEGER PRIMARY KEY,
  territory TEXT NOT NULL,
  person TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'rep',
  start_date TEXT, end_date TEXT
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  account TEXT NOT NULL REFERENCES accounts(id),
  territory TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add','drop')),
  requested_by TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  created_at TEXT NOT NULL,
  resolved_by TEXT, resolved_at TEXT
);
"""

ACCOUNT_COLS = ("id", "name", "type", "specialty", "segment", "postal_code", "city", "potential")
SCOPED = {
    "territories": "code, name, field_force, parent",
    "account_rules": "territory, name, priority, conditions",
    "geo_rules": "territory, postal_prefix",
    "manual_assignments": "account, territory, action, note",
}


class NotFound(Exception):
    pass


class Invalid(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _conditions(raw) -> tuple[E.Condition, ...]:
    items = json.loads(raw) if isinstance(raw, str) else (raw or [])
    try:
        return tuple(E.Condition(c["field"], c["op"], c["value"]) for c in items)
    except (KeyError, TypeError) as e:
        raise Invalid(f"bad condition: {e}") from e
    except ValueError as e:
        raise Invalid(str(e)) from e


class Store:
    def __init__(self, path: str = "territory.db"):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA)
        if not self.db.execute("SELECT 1 FROM scenarios WHERE id = ?", (MASTER,)).fetchone():
            self.db.execute("INSERT INTO scenarios (id, name, status, created_at) VALUES (?, 'Master', 'master', ?)",
                            (MASTER, _now()))
            self.db.commit()

    def _rows(self, sql, args=()):
        return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    # ---- reference data -------------------------------------------------
    def upsert_field_force(self, code, name, target_conditions=()):
        _conditions(list(target_conditions))
        self.db.execute("INSERT INTO field_forces VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, target_conditions = excluded.target_conditions",
                        (code, name, json.dumps(list(target_conditions))))
        self.db.commit()

    def field_forces(self):
        rows = self._rows("SELECT * FROM field_forces ORDER BY code")
        for r in rows:
            r["target_conditions"] = json.loads(r["target_conditions"])
        return rows

    def upsert_account(self, acct: dict, commit: bool = True):
        if not acct.get("id") or not acct.get("name"):
            raise Invalid("account needs id and name")
        base = {k: acct.get(k) for k in ACCOUNT_COLS}
        base["potential"] = float(base["potential"] or 0)
        extra = {k: v for k, v in acct.items() if k not in ACCOUNT_COLS}
        self.db.execute(
            f"INSERT INTO accounts ({', '.join(ACCOUNT_COLS)}, attrs) VALUES ({', '.join('?' * (len(ACCOUNT_COLS) + 1))}) "
            f"ON CONFLICT(id) DO UPDATE SET {', '.join(f'{c} = excluded.{c}' for c in ACCOUNT_COLS[1:])}, attrs = excluded.attrs",
            (*base.values(), json.dumps(extra)))
        if commit:
            self.db.commit()

    def import_accounts_csv(self, text: str) -> int:
        n = 0
        for row in csv.DictReader(io.StringIO(text)):
            self.upsert_account({k: (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}, commit=False)
            n += 1
        self.db.commit()
        return n

    def accounts(self) -> list[dict]:
        out = []
        for r in self._rows("SELECT * FROM accounts ORDER BY name"):
            attrs = json.loads(r.pop("attrs"))
            out.append({**attrs, **r})
        return out

    # ---- scenarios ------------------------------------------------------
    def scenarios(self):
        return self._rows("SELECT * FROM scenarios ORDER BY id")

    def scenario(self, sid: int):
        r = self.db.execute("SELECT * FROM scenarios WHERE id = ?", (sid,)).fetchone()
        if not r:
            raise NotFound(f"scenario {sid}")
        return dict(r)

    def _editable(self, sid: int):
        s = self.scenario(sid)
        if s["status"] == "published":
            raise Invalid("published scenarios are read-only")
        return s

    def _copy_scope(self, src: int, dst: int):
        for table, cols in SCOPED.items():
            self.db.execute(f"INSERT INTO {table} (scenario_id, {cols}) SELECT ?, {cols} FROM {table} WHERE scenario_id = ?",
                            (dst, src))

    def create_scenario(self, name: str, base_id: int = MASTER) -> dict:
        self.scenario(base_id)
        cur = self.db.execute("INSERT INTO scenarios (name, status, base_id, created_at) VALUES (?, 'draft', ?, ?)",
                              (name, base_id, _now()))
        self._copy_scope(base_id, cur.lastrowid)
        self.db.commit()
        return self.scenario(cur.lastrowid)

    def delete_scenario(self, sid: int):
        if sid == MASTER:
            raise Invalid("cannot delete the master alignment")
        self.scenario(sid)
        self.db.execute("DELETE FROM scenarios WHERE id = ?", (sid,))
        self.db.commit()

    def publish_scenario(self, sid: int) -> list[E.Change]:
        """Make a draft scenario the new master. Returns the changes applied."""
        if sid == MASTER:
            raise Invalid("master is already live")
        self._editable(sid)
        changes = self.diff(MASTER, sid)
        for table in SCOPED:
            self.db.execute(f"DELETE FROM {table} WHERE scenario_id = ?", (MASTER,))
        self._copy_scope(sid, MASTER)
        self.db.execute("UPDATE scenarios SET status = 'published' WHERE id = ?", (sid,))
        self.db.commit()
        return changes

    # ---- territories & rules -------------------------------------------
    def territories(self, sid: int):
        self.scenario(sid)
        return self._rows("SELECT code, name, field_force, parent FROM territories WHERE scenario_id = ? ORDER BY field_force, code", (sid,))

    def _territory(self, sid, code):
        r = self.db.execute("SELECT * FROM territories WHERE scenario_id = ? AND code = ?", (sid, code)).fetchone()
        if not r:
            raise Invalid(f"territory {code!r} does not exist in scenario {sid}")
        return dict(r)

    def add_territory(self, sid, code, name, field_force, parent=None):
        self._editable(sid)
        if not code or not name:
            raise Invalid("territory needs code and name")
        if not self.db.execute("SELECT 1 FROM field_forces WHERE code = ?", (field_force,)).fetchone():
            raise Invalid(f"unknown field force {field_force!r}")
        if parent:
            p = self._territory(sid, parent)
            if p["field_force"] != field_force:
                raise Invalid("parent territory belongs to another field force")
        try:
            self.db.execute("INSERT INTO territories VALUES (?, ?, ?, ?, ?)", (sid, code, name, field_force, parent or None))
        except sqlite3.IntegrityError as e:
            raise Invalid(f"territory {code!r} already exists") from e
        self.db.commit()

    def delete_territory(self, sid, code):
        self._editable(sid)
        self._territory(sid, code)
        if self.db.execute("SELECT 1 FROM territories WHERE scenario_id = ? AND parent = ?", (sid, code)).fetchone():
            raise Invalid("territory has child territories; move or delete them first")
        for table in ("account_rules", "geo_rules", "manual_assignments"):
            self.db.execute(f"DELETE FROM {table} WHERE scenario_id = ? AND territory = ?", (sid, code))
        self.db.execute("DELETE FROM territories WHERE scenario_id = ? AND code = ?", (sid, code))
        self.db.commit()

    def add_account_rule(self, sid, territory, conditions, priority=100, name="") -> int:
        self._editable(sid)
        self._territory(sid, territory)
        if not conditions:
            raise Invalid("an account rule needs at least one condition")
        _conditions(conditions)
        cur = self.db.execute("INSERT INTO account_rules (scenario_id, territory, name, priority, conditions) VALUES (?, ?, ?, ?, ?)",
                              (sid, territory, name, int(priority), json.dumps(conditions)))
        self.db.commit()
        return cur.lastrowid

    def add_geo_rule(self, sid, territory, postal_prefix) -> int:
        self._editable(sid)
        self._territory(sid, territory)
        prefix = str(postal_prefix or "").replace(" ", "").upper()
        if not prefix:
            raise Invalid("postal prefix is required")
        cur = self.db.execute("INSERT INTO geo_rules (scenario_id, territory, postal_prefix) VALUES (?, ?, ?)",
                              (sid, territory, prefix))
        self.db.commit()
        return cur.lastrowid

    def add_manual(self, sid, account, territory, action, note="") -> int:
        self._editable(sid)
        self._territory(sid, territory)
        if action not in ("include", "exclude"):
            raise Invalid("action must be include or exclude")
        if not self.db.execute("SELECT 1 FROM accounts WHERE id = ?", (account,)).fetchone():
            raise Invalid(f"unknown account {account!r}")
        self.db.execute("DELETE FROM manual_assignments WHERE scenario_id = ? AND account = ? AND territory = ?",
                        (sid, account, territory))
        cur = self.db.execute("INSERT INTO manual_assignments (scenario_id, account, territory, action, note) VALUES (?, ?, ?, ?, ?)",
                              (sid, account, territory, action, note))
        self.db.commit()
        return cur.lastrowid

    def delete_rule(self, sid, kind, rule_id):
        table = {"account": "account_rules", "geo": "geo_rules", "manual": "manual_assignments"}.get(kind)
        if not table:
            raise Invalid("kind must be account, geo or manual")
        self._editable(sid)
        cur = self.db.execute(f"DELETE FROM {table} WHERE scenario_id = ? AND id = ?", (sid, rule_id))
        if not cur.rowcount:
            raise NotFound(f"{kind} rule {rule_id}")
        self.db.commit()

    def rules(self, sid):
        self.scenario(sid)
        acct = self._rows("SELECT id, territory, name, priority, conditions FROM account_rules WHERE scenario_id = ? ORDER BY priority, id", (sid,))
        for r in acct:
            r["conditions"] = json.loads(r["conditions"])
        return {
            "account": acct,
            "geo": self._rows("SELECT id, territory, postal_prefix FROM geo_rules WHERE scenario_id = ? ORDER BY postal_prefix", (sid,)),
            "manual": self._rows("SELECT id, account, territory, action, note FROM manual_assignments WHERE scenario_id = ? ORDER BY account", (sid,)),
        }

    # ---- alignment ------------------------------------------------------
    def alignment_input(self, sid) -> E.AlignmentInput:
        rules = self.rules(sid)
        return E.AlignmentInput(
            field_forces=[E.FieldForce(f["code"], f["name"], _conditions(f["target_conditions"])) for f in self.field_forces()],
            territories=[E.Territory(**t) for t in self.territories(sid)],
            accounts=self.accounts(),
            account_rules=[E.AccountRule(r["id"], r["territory"], _conditions(r["conditions"]), r["priority"], r["name"]) for r in rules["account"]],
            geo_rules=[E.GeoRule(g["id"], g["territory"], g["postal_prefix"]) for g in rules["geo"]],
            manual=[E.ManualAssignment(m["id"], m["account"], m["territory"], m["action"], m["note"]) for m in rules["manual"]],
        )

    def align(self, sid) -> list[E.Assignment]:
        return E.run_alignment(self.alignment_input(sid))

    def diff(self, base_id, target_id) -> list[E.Change]:
        return E.diff_alignments(self.align(base_id), self.align(target_id))

    def territory_summary(self, sid):
        data = self.alignment_input(sid)
        metrics = E.territory_metrics(data.territories, E.run_alignment(data), data.accounts)
        roster = {}
        if sid == MASTER:
            for r in self.roster():
                roster.setdefault(r["territory"], []).append(r)
        return [{**t, **metrics[t["code"]], "roster": roster.get(t["code"], [])} for t in self.territories(sid)]

    # ---- roster ---------------------------------------------------------
    def roster(self):
        return self._rows("SELECT * FROM roster ORDER BY territory, role, person")

    def add_roster(self, territory, person, email="", role="rep", start_date=None, end_date=None) -> int:
        self._territory(MASTER, territory)
        if not person:
            raise Invalid("person is required")
        cur = self.db.execute("INSERT INTO roster (territory, person, email, role, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
                              (territory, person, email, role, start_date, end_date))
        self.db.commit()
        return cur.lastrowid

    # ---- feedback (field requests against master) ----------------------
    def feedback(self, status=None):
        if status:
            return self._rows("SELECT * FROM feedback WHERE status = ? ORDER BY id DESC", (status,))
        return self._rows("SELECT * FROM feedback ORDER BY id DESC")

    def submit_feedback(self, account, territory, action, requested_by, comment="") -> int:
        self._territory(MASTER, territory)
        if action not in ("add", "drop"):
            raise Invalid("action must be add or drop")
        if not requested_by:
            raise Invalid("requested_by is required")
        if not self.db.execute("SELECT 1 FROM accounts WHERE id = ?", (account,)).fetchone():
            raise Invalid(f"unknown account {account!r}")
        cur = self.db.execute(
            "INSERT INTO feedback (account, territory, action, requested_by, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (account, territory, action, requested_by, comment, _now()))
        self.db.commit()
        return cur.lastrowid

    def resolve_feedback(self, fid, approve: bool, resolved_by: str):
        r = self.db.execute("SELECT * FROM feedback WHERE id = ?", (fid,)).fetchone()
        if not r:
            raise NotFound(f"feedback {fid}")
        if r["status"] != "pending":
            raise Invalid("feedback already resolved")
        if approve:
            action = "include" if r["action"] == "add" else "exclude"
            self.add_manual(MASTER, r["account"], r["territory"], action,
                            f"feedback #{fid} from {r['requested_by']}")
        self.db.execute("UPDATE feedback SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?",
                        ("approved" if approve else "rejected", resolved_by, _now(), fid))
        self.db.commit()

    # ---- export (feed for a CRM) ----------------------------------------
    def export_csv(self, sid) -> str:
        names = {a["id"]: a["name"] for a in self.accounts()}
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["account_id", "account_name", "field_force", "territory", "source", "rule_id", "reason"])
        for a in sorted(self.align(sid), key=lambda a: (a.field_force, a.territory, a.account)):
            w.writerow([a.account, names.get(a.account, ""), a.field_force, a.territory, a.source, a.rule_id or "", a.detail])
        return buf.getvalue()
