import os
from pathlib import Path

from dotenv import load_dotenv


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

# Load API keys from .env files.
# Priority (first wins): DATA_DIR/.env → sidecar dir/.env → project root/.env
_SIDECAR_DIR = Path(__file__).resolve().parent.parent
load_dotenv(DATA_DIR / ".env", override=False)
load_dotenv(_SIDECAR_DIR / ".env", override=False)
load_dotenv(_SIDECAR_DIR.parent.parent / ".env", override=False)

# Map provider name → env var name
_KEY_ENV_VARS: dict[str, str] = {
    "groq": "GROQ_API_KEY",
    "openai": "OPENAI_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


def get_env_key(provider_name: str) -> str | None:
    """Return the pre-configured API key for a provider from env vars, or None."""
    env_var = _KEY_ENV_VARS.get(provider_name)
    if not env_var:
        return None
    val = os.environ.get(env_var, "").strip()
    return val or None
