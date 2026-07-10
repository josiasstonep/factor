from fastapi import APIRouter
from pydantic import BaseModel

from sidecar.config import get_env_key, save_env_key

router = APIRouter(prefix="/config", tags=["config"])

_PROVIDERS = ["groq", "openai", "claude", "gemini"]


class KeysStatus(BaseModel):
    groq: bool
    openai: bool
    claude: bool
    gemini: bool


class SaveKeysRequest(BaseModel):
    groq: str | None = None
    openai: str | None = None
    claude: str | None = None
    gemini: str | None = None


@router.get("/keys", response_model=KeysStatus)
async def get_keys_status():
    """Returns which providers have API keys configured. Never returns actual key values."""
    return KeysStatus(
        groq=bool(get_env_key("groq")),
        openai=bool(get_env_key("openai")),
        claude=bool(get_env_key("claude")),
        gemini=bool(get_env_key("gemini")),
    )


@router.put("/keys")
async def save_keys(payload: SaveKeysRequest):
    """Saves provided API keys to the .env file. Empty strings are ignored."""
    saved = []
    for provider in _PROVIDERS:
        value = getattr(payload, provider, None)
        if value and value.strip():
            save_env_key(provider, value.strip())
            saved.append(provider)
    return {"ok": True, "saved": saved}
