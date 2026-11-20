"""Entry point for the frozen (PyInstaller) build."""
import sys
import traceback

from tm.__main__ import main

if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0) and getattr(sys, "frozen", False) and len(sys.argv) == 1:
            print(e.code)
            input("Press Enter to close...")
        raise
    except Exception:
        traceback.print_exc()
        if getattr(sys, "frozen", False):
            input("Something went wrong. Press Enter to close...")
        sys.exit(1)
