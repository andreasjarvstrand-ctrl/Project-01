"""Pure alignment engine. No I/O: takes plain data, returns assignments.

Alignment precedence, evaluated per field force and per account:

1. Eligibility  - the field force's target conditions must match, otherwise the
                  account is not aligned in that field force at all
                  (manual includes still apply).
2. Manual include - explicit account -> territory assignment, always wins.
3. Account rules  - attribute conditions -> territory. Every matching rule with
                    the best (lowest) priority number assigns, which allows
                    shared accounts. If any account rule matches, geo rules are
                    skipped for that field force.
4. Geo rules      - postal-code prefix -> territory. Longest matching prefix
                    wins; several territories on the same prefix share it.
5. Manual exclude - removes a territory from the result, whatever assigned it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

OPS = ("eq", "ne", "in", "not_in", "starts_with", "contains", "gte", "lte")


@dataclass(frozen=True)
class Condition:
    field: str
    op: str
    value: Any

    def __post_init__(self) -> None:
        if self.op not in OPS:
            raise ValueError(f"unknown operator {self.op!r}; expected one of {OPS}")
        if self.op in ("in", "not_in") and not isinstance(self.value, (list, tuple)):
            raise ValueError(f"operator {self.op!r} needs a list value")

    def matches(self, account: dict) -> bool:
        actual = account.get(self.field)
        op, expected = self.op, self.value
        if op == "eq":
            return _norm(actual) == _norm(expected)
        if op == "ne":
            return _norm(actual) != _norm(expected)
        if op == "in":
            return _norm(actual) in {_norm(v) for v in expected}
        if op == "not_in":
            return _norm(actual) not in {_norm(v) for v in expected}
        if actual is None:
            return False
        if op == "starts_with":
            return str(actual).lower().startswith(str(expected).lower())
        if op == "contains":
            return str(expected).lower() in str(actual).lower()
        try:
            a, e = float(actual), float(expected)
        except (TypeError, ValueError):
            return False
        return a >= e if op == "gte" else a <= e


def _norm(v: Any) -> Any:
    return v.strip().lower() if isinstance(v, str) else v


def all_match(conditions: Iterable[Condition], account: dict) -> bool:
    return all(c.matches(account) for c in conditions)


@dataclass(frozen=True)
class FieldForce:
    code: str
    name: str
    target_conditions: tuple[Condition, ...] = ()


@dataclass(frozen=True)
class Territory:
    code: str
    name: str
    field_force: str
    parent: str | None = None


@dataclass(frozen=True)
class AccountRule:
    id: int
    territory: str
    conditions: tuple[Condition, ...]
    priority: int = 100
    name: str = ""


@dataclass(frozen=True)
class GeoRule:
    id: int
    territory: str
    postal_prefix: str


@dataclass(frozen=True)
class ManualAssignment:
    id: int
    account: str
    territory: str
    action: str  # "include" | "exclude"
    note: str = ""


@dataclass(frozen=True)
class Assignment:
    account: str
    field_force: str
    territory: str
    source: str  # "manual" | "account_rule" | "geo_rule"
    rule_id: int | None = None
    detail: str = ""


@dataclass
class AlignmentInput:
    field_forces: list[FieldForce]
    territories: list[Territory]
    accounts: list[dict]  # each needs "id"; postal code under "postal_code"
    account_rules: list[AccountRule] = field(default_factory=list)
    geo_rules: list[GeoRule] = field(default_factory=list)
    manual: list[ManualAssignment] = field(default_factory=list)


def run_alignment(data: AlignmentInput) -> list[Assignment]:
    terr_ff = {t.code: t.field_force for t in data.territories}

    rules_by_ff: dict[str, list[AccountRule]] = {}
    for r in data.account_rules:
        if r.territory in terr_ff:
            rules_by_ff.setdefault(terr_ff[r.territory], []).append(r)
    for rules in rules_by_ff.values():
        rules.sort(key=lambda r: (r.priority, r.id))

    geo_by_ff: dict[str, dict[str, list[GeoRule]]] = {}
    for g in data.geo_rules:
        if g.territory in terr_ff:
            prefix = g.postal_prefix.replace(" ", "").upper()
            geo_by_ff.setdefault(terr_ff[g.territory], {}).setdefault(prefix, []).append(g)

    includes: dict[tuple[str, str], list[ManualAssignment]] = {}
    excludes: set[tuple[str, str]] = set()
    for m in data.manual:
        if m.territory not in terr_ff:
            continue
        if m.action == "include":
            includes.setdefault((m.account, terr_ff[m.territory]), []).append(m)
        elif m.action == "exclude":
            excludes.add((m.account, m.territory))

    out: list[Assignment] = []
    for acct in data.accounts:
        aid = acct["id"]
        postal = str(acct.get("postal_code") or "").replace(" ", "").upper()
        for ff in data.field_forces:
            found: dict[str, Assignment] = {}

            for m in includes.get((aid, ff.code), []):
                found.setdefault(m.territory, Assignment(
                    aid, ff.code, m.territory, "manual", m.id, m.note or "manual include"))

            if all_match(ff.target_conditions, acct):
                best: int | None = None
                for r in rules_by_ff.get(ff.code, []):
                    if best is not None and r.priority > best:
                        break
                    if all_match(r.conditions, acct):
                        best = r.priority
                        found.setdefault(r.territory, Assignment(
                            aid, ff.code, r.territory, "account_rule", r.id,
                            r.name or f"account rule #{r.id}"))
                if best is None and postal:
                    geo = geo_by_ff.get(ff.code, {})
                    for n in range(len(postal), 0, -1):
                        hits = geo.get(postal[:n])
                        if hits:
                            for g in hits:
                                found.setdefault(g.territory, Assignment(
                                    aid, ff.code, g.territory, "geo_rule", g.id,
                                    f"postal prefix {postal[:n]}"))
                            break

            out.extend(a for t, a in found.items() if (aid, t) not in excludes)
    return out


@dataclass(frozen=True)
class Change:
    account: str
    field_force: str
    before: tuple[str, ...]
    after: tuple[str, ...]


def diff_alignments(base: list[Assignment], target: list[Assignment]) -> list[Change]:
    """Accounts whose territory set changed, per field force."""
    def index(rows: list[Assignment]) -> dict[tuple[str, str], set[str]]:
        idx: dict[tuple[str, str], set[str]] = {}
        for a in rows:
            idx.setdefault((a.account, a.field_force), set()).add(a.territory)
        return idx

    b, t = index(base), index(target)
    changes = []
    for key in sorted(set(b) | set(t)):
        before, after = b.get(key, set()), t.get(key, set())
        if before != after:
            changes.append(Change(key[0], key[1], tuple(sorted(before)), tuple(sorted(after))))
    return changes


def territory_metrics(territories: list[Territory], assignments: list[Assignment],
                      accounts: list[dict], weight_field: str = "potential") -> dict[str, dict]:
    """Account count and summed workload per territory, rolled up the hierarchy."""
    weight = {a["id"]: float(a.get(weight_field) or 0) for a in accounts}
    parent = {t.code: t.parent for t in territories}
    m = {t.code: {"accounts": set(), "direct": 0, "workload": 0.0} for t in territories}
    for a in assignments:
        if a.territory in m:
            m[a.territory]["direct"] += 1
        node, seen = a.territory, set()
        while node in m and node not in seen:
            seen.add(node)
            m[node]["accounts"].add(a.account)
            node = parent.get(node)
    return {code: {"accounts": len(v["accounts"]), "direct_accounts": v["direct"],
                   "workload": round(sum(weight.get(x, 0) for x in v["accounts"]), 2)}
            for code, v in m.items()}
