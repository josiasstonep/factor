import os
from pathlib import Path


def get_data_dir() -> Path:
    """Resolve the local app data directory, mirroring Electron's userData path.

    In dev (no env var set), falls back to a .data folder next to the sidecar
    package so the backend is runnable standalone without Electron.
    """
    override = os.environ.get("FACTOR_DATA_DIR")
    if override:
        base = Path(override)
    else:
        base = Path(__file__).resolve().parent.parent / ".data"

    base.mkdir(parents=True, exist_ok=True)
    for sub in ("templates", "uploads", "exports"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return base


DATA_DIR = get_data_dir()
TEMPLATES_DIR = DATA_DIR / "templates"
UPLOADS_DIR = DATA_DIR / "uploads"
EXPORTS_DIR = DATA_DIR / "exports"
DB_PATH = DATA_DIR / "factor.db"
