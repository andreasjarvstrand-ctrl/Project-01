# Territory Manager

Rule-based sales territory alignment: territory hierarchies per field force, account and
geography rules, manual overrides, what-if scenarios, field feedback, and a CSV feed for a CRM.

Python 3.10+ standard library only: no packages to install.

## Run

```bash
python -m tm seed     # creates territory.db with fictional demo data
python -m tm serve    # http://127.0.0.1:8765
```

Other commands:

```bash
python -m tm import-accounts accounts.csv   # insert or update accounts
python -m tm export --scenario 1 > alignment.csv
python -m tm diff 2                         # scenario 2 vs master
python -m pytest                            # tests
```

## Concepts

| Concept | What it is |
|---|---|
| Field force | A sales team, e.g. Hematology. Has *targeting conditions* deciding which accounts it covers. |
| Territory | Node in a per-field-force hierarchy. Counts and workload roll up to parents. |
| Account rule | Conditions on account attributes → territory, with a priority. |
| Geo rule | Postal-code prefix → territory. |
| Manual assignment | Explicit include or exclude of one account in one territory. |
| Scenario | A copy of master's territories and rules to edit, compare and publish. |
| Roster | People assigned to master territories. |
| Feedback | A rep's add/drop request; approval turns it into a manual assignment on master. |

## How an account is aligned

Per field force, per account (`tm/engine.py`):

1. The account must match the field force's targeting, otherwise only manual includes apply.
2. Manual includes always apply.
3. Account rules: every matching rule at the best (lowest) priority assigns. If any account
   rule matches, geography is skipped.
4. Geo rules: the longest matching postal prefix wins. Territories sharing a prefix share the account.
5. Manual excludes remove a territory.

Every assignment records its source and reason, so "why is this account here?" is always answerable.

## Accounts CSV

Columns `id, name, type, specialty, segment, postal_code, city, potential`. Any extra
column (e.g. `tier`, `decile`) is stored and can be used in rule conditions.
Condition operators: `eq ne in not_in starts_with contains gte lte`.

## Layout

```
tm/engine.py   pure alignment logic, diff and metrics (no I/O)
tm/store.py    SQLite schema, scenarios, feedback, CSV export
tm/server.py   JSON API + static UI
tm/static/     single-page web UI
tm/seed.py     fictional demo data
```

The API has no authentication. Run it locally or put it behind your own sign-in before sharing it.
