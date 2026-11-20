"""Command line: python -m tm <command>"""

import argparse
import sys
from pathlib import Path

from .seed import seed
from .server import serve
from .store import Invalid, NotFound, Store


def main(argv=None):
    p = argparse.ArgumentParser(prog="tm", description="Territory Manager")
    p.add_argument("--db", default="territory.db", help="SQLite file (default: territory.db)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("seed", help="create the database with fictional demo data")
    s = sub.add_parser("serve", help="run the web UI and API")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8765)
    i = sub.add_parser("import-accounts", help="import or update accounts from a CSV file")
    i.add_argument("csv")
    e = sub.add_parser("export", help="print the alignment of a scenario as CSV")
    e.add_argument("--scenario", type=int, default=1)
    d = sub.add_parser("diff", help="show accounts whose territories differ between two scenarios")
    d.add_argument("target", type=int)
    d.add_argument("--base", type=int, default=1)
    args = p.parse_args(argv)

    if args.cmd == "seed" and Path(args.db).exists():
        sys.exit(f"{args.db} already exists; delete it first or pass --db")
    store = Store(args.db)
    try:
        if args.cmd == "seed":
            seed(store)
            print(f"Seeded {args.db}")
        elif args.cmd == "serve":
            serve(store, args.host, args.port)
        elif args.cmd == "import-accounts":
            print(f"Imported {store.import_accounts_csv(Path(args.csv).read_text(encoding='utf-8'))} accounts")
        elif args.cmd == "export":
            sys.stdout.write(store.export_csv(args.scenario))
        elif args.cmd == "diff":
            changes = store.diff(args.base, args.target)
            for c in changes:
                print(f"{c.account:10} {c.field_force:6} {','.join(c.before) or '-':20} -> {','.join(c.after) or '-'}")
            print(f"{len(changes)} change(s)")
    except (Invalid, NotFound) as err:
        sys.exit(f"error: {err}")


if __name__ == "__main__":
    main()
