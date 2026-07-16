import httpx

from sidecar.ai_providers.base import build_system_prompt, build_user_message, register
from sidecar.config import get_env_key

_DEFAULT_MODEL = "gemini-2.5-flash-lite"
_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class _Gemini:
    name = "gemini"
    label = "Google Gemini"
    requires_key = True

    async def is_available(self) -> bool:
        return True

    async def improve_text(
        self,
        text: str,
        api_key: str | None,
        model: str | None,
        section_type: str = "custom",
        expertise_type: str | None = None,
        case_context: str | None = None,
    ) -> str:
        effective_key = api_key or get_env_key("gemini")
        if not effective_key:
            raise ValueError("Gemini requires an API key. Configure GEMINI_API_KEY no .env ou cole a chave na interface.")
        m = model or _DEFAULT_MODEL
        system_prompt = build_system_prompt(section_type, expertise_type)
        url = f"{_API_BASE}/{m}:generateContent?key={effective_key}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                url,
                json={
                    "system_instruction": {"parts": [{"text": system_prompt}]},
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": build_user_message(text, case_context)}],
                        }
                    ],
                    "generationConfig": {"temperature": 0},
                },
            )
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


register(_Gemini())
