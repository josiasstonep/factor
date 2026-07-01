import httpx

from sidecar.ai_providers.base import IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, register

_DEFAULT_MODEL = "gemini-2.0-flash"
_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class _Gemini:
    name = "gemini"
    label = "Google Gemini"
    requires_key = True

    async def is_available(self) -> bool:
        return True

    async def improve_text(self, text: str, api_key: str | None, model: str | None) -> str:
        if not api_key:
            raise ValueError("Gemini requires an API key.")
        m = model or _DEFAULT_MODEL
        url = f"{_API_BASE}/{m}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                url,
                json={
                    "system_instruction": {"parts": [{"text": IMPROVE_SYSTEM_PROMPT}]},
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": IMPROVE_USER_TEMPLATE.format(text=text)}],
                        }
                    ],
                },
            )
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


register(_Gemini())
