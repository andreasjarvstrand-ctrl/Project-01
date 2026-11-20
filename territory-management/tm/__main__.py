"""Territory Manager launcher.

Run with no arguments (or double-click the program) to open the app in your browser.
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from . import __version__
from .seed import seed
from .server import serve
from .store import Invalid, NotFound, Store


def default_db() -> Path:
    """Per-user data folder, so the app works wherever it is installed."""
    if os.environ.get("TM_DB"):
        return Path(os.environ["TM_DB"])
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "TerritoryManager"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "TerritoryManager"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "territory-manager"
    return base / "territory.db"


def main(argv=None):
    p = argparse.ArgumentParser(prog="territory-manager", description="Territory Manager: offline territory alignment")
    p.add_argument("--version", action="version", version=__version__)
    p.add_argument("--db", type=Path, help="SQLite database file (default: your user data folder; or set TM_DB)")
    sub = p.add_subparsers(dest="cmd")
    s = sub.add_parser("start", help="open the app in your browser (the default)")
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--no-browser", action="store_true", help="don't open a browser window")
    s.add_argument("--empty", action="store_true", help="on first run, start with no data instead of the demo")
    sub.add_parser("seed", help="load the fictional demo data into an empty database")
    i = sub.add_parser("import-accounts", help="import or update accounts from a CSV file")
    i.add_argument("csv", type=Path)
    e = sub.add_parser("export", help="write the alignment of a scenario as CSV")
    e.add_argument("--scenario", type=int, default=1)
    e.add_argument("-o", "--output", type=Path, help="file to write (default: print)")
    d = sub.add_parser("diff", help="show accounts whose territories differ between two scenarios")
    d.add_argument("target", type=int)
    d.add_argument("--base", type=int, default=1)
    b = sub.add_parser("backup", help="copy the database to a dated file")
    b.add_argument("folder", type=Path, nargs="?", default=Path("."))
    sub.add_parser("where", help="print where the database is stored")
    args = p.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):  # live output and no crashes on odd console encodings
        try:
            stream.reconfigure(line_buffering=True, errors="replace")
        except (AttributeError, ValueError):
            pass
    cmd = args.cmd or "start"

    db_path = args.db or default_db()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    first_run = not db_path.exists()
    store = Store(str(db_path))
    try:
        if cmd == "start":
            if first_run and not getattr(args, "empty", False):
                seed(store)
                print("First run: loaded demo data. Start fresh with: territory-manager --db new.db start --empty")
            serve(store, port=getattr(args, "port", 8765), open_browser=not getattr(args, "no_browser", False))
        elif cmd == "seed":
            if not store.is_empty():
                sys.exit("database already has data; use --db to pick another file")
            seed(store)
            print(f"Seeded {db_path}")
        elif cmd == "import-accounts":
            print(f"Imported {store.import_accounts_csv(args.csv.read_text(encoding='utf-8-sig'))} accounts")
        elif cmd == "export":
            text = store.export_csv(args.scenario)
            if args.output:
                args.output.write_text(text, encoding="utf-8-sig")  # BOM: opens correctly in Excel
                print(f"Wrote {args.output}")
            else:
                sys.stdout.write(text)
        elif cmd == "diff":
            changes = store.diff(args.base, args.target)
            for c in changes:
                print(f"{c.account:10} {c.field_force:6} {','.join(c.before) or '-':20} -> {','.join(c.after) or '-'}")
            print(f"{len(changes)} change(s)")
        elif cmd == "backup":
            args.folder.mkdir(parents=True, exist_ok=True)
            target = args.folder / f"territory-{datetime.now():%Y%m%d-%H%M%S}.db"
            store.db.execute("VACUUM INTO ?", (str(target),))
            print(f"Backed up to {target}")
        elif cmd == "where":
            print(db_path)
    except (Invalid, NotFound) as err:
        sys.exit(f"error: {err}")


if __name__ == "__main__":
    main()
