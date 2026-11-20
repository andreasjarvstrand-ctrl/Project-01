# Territory Manager

Rule-based sales territory alignment: territory hierarchies per field force, account and
geography rules, manual overrides, what-if scenarios, field feedback, and a CSV feed for a CRM.

Works fully offline: no internet, no cloud, no accounts. Data stays in one file on your computer.

## Download and run (no installation)

Get the file for your computer from the GitHub release (or the **Actions → Territory Manager
release** run's artifacts):

| Computer | File | How to start |
|---|---|---|
| Windows | `TerritoryManager-<version>-windows-amd64.exe` | Double-click. If SmartScreen warns, choose *More info → Run anyway*. |
| Mac | `…-macos-arm64.zip` (Apple silicon) or `…-macos-x86_64.zip` (Intel) | Unzip, then right-click `TerritoryManager` → *Open* the first time. |
| Linux | `…-linux-x86_64.zip` | Unzip, run `./TerritoryManager`. |
| Any, with Python 3.10+ | `territory-manager-<version>.pyz` | `python territory-manager-<version>.pyz` |

The app opens in your web browser at `http://127.0.0.1:8765` and keeps running in a small
terminal window; close that window to stop it. It only listens on your own computer.
The programs are not code-signed, which is why the system warns once. Company-managed
laptops may need IT to allow it.

**Your data** lives in one SQLite file:

- Windows: `%LOCALAPPDATA%\TerritoryManager\territory.db`
- Mac: `~/Library/Application Support/TerritoryManager/territory.db`
- Linux: `~/.local/share/territory-manager/territory.db`

The first start loads fictional demo data. To begin with your own data, use
`--db mydata.db start --empty`, add field forces on the Territories tab, and import accounts.
Set `TM_DB` to keep the database somewhere else (e.g. a shared drive).

## Command line

The same commands work with the executable, the `.pyz`, or `python -m tm`:

```bash
territory-manager                              # start and open the browser
territory-manager start --port 9000 --no-browser
territory-manager import-accounts accounts.csv # comma or semicolon CSV, Excel's UTF-8 is fine
territory-manager export -o alignment.csv      # opens correctly in Excel
territory-manager diff 2                       # scenario 2 vs master
territory-manager backup D:\Backups            # dated copy of the database
territory-manager where                        # show the database location
```

## Build it yourself

```bash
pip install pytest && python -m pytest          # 18 tests
python scripts/build.py                         # dist/territory-manager-<version>.pyz
pip install pyinstaller && python scripts/build.py --exe   # program for the current OS
pip install .                                   # installs the territory-manager command
```

PyInstaller builds only for the OS it runs on, so the GitHub workflow
`.github/workflows/territory-manager-release.yml` builds Windows, Mac and Linux. Run it from
the Actions tab, or push a tag such as `tm-v1.0.0` to publish a release with all files attached.

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
