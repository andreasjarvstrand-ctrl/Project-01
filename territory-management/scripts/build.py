"""Build downloadable packages into dist/.

    python scripts/build.py          # portable .pyz (needs Python 3.10+ on the target machine)
    python scripts/build.py --exe    # standalone program for this OS (needs: pip install pyinstaller)
"""
import platform
import shutil
import subprocess
import sys
import zipapp
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
sys.path.insert(0, str(ROOT))
from tm import __version__  # noqa: E402


def build_pyz() -> Path:
    stage = DIST / "_pyz"
    shutil.rmtree(stage, ignore_errors=True)
    shutil.copytree(ROOT / "tm", stage / "tm", ignore=shutil.ignore_patterns("__pycache__"))
    out = DIST / f"territory-manager-{__version__}.pyz"
    zipapp.create_archive(stage, out, interpreter="/usr/bin/env python3", main="tm.__main__:main", compressed=True)
    shutil.rmtree(stage)
    return out


def build_exe() -> Path:
    system = {"Windows": "windows", "Darwin": "macos"}.get(platform.system(), "linux")
    name = f"TerritoryManager-{__version__}-{system}-{platform.machine().lower()}"
    sep = ";" if system == "windows" else ":"
    subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--console",
                    "--name", name, "--add-data", f"{ROOT / 'tm' / 'static'}{sep}tm/static",
                    "--distpath", str(DIST), "--workpath", str(DIST / "_build"), "--specpath", str(DIST / "_build"),
                    str(ROOT / "launcher.py")], check=True)
    shutil.rmtree(DIST / "_build", ignore_errors=True)
    exe = next(DIST.glob(name + "*"))
    if system == "windows":
        return exe
    # Browsers drop the "executable" flag on plain downloads; a zip keeps it (Finder and unzip honour it).
    out = DIST / f"{name}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo("TerritoryManager", date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = (0o100755 << 16)
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, exe.read_bytes())
    exe.unlink()
    return out


if __name__ == "__main__":
    DIST.mkdir(exist_ok=True)
    print("Built", build_exe() if "--exe" in sys.argv else build_pyz())
