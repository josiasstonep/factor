import httpx

from sidecar.ai_providers.base import IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, register

_API_URL = "https://api.anthropic.com/v1/messages"
_DEFAULT_MODEL = "claude-haiku-4-5-20251001"


class _Claude:
    name = "claude"
    label = "Claude (Anthropic)"
    requires_key = True

    async def is_available(self) -> bool:
        return True

    async def improve_text(self, text: str, api_key: str | None, model: str | None) -> str:
        if not api_key:
            raise ValueError("Claude requires an API key.")
        m = model or _DEFAULT_MODEL
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                _API_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": m,
                    "max_tokens": 4096,
                    "system": IMPROVE_SYSTEM_PROMPT,
                    "messages": [
                        {"role": "user", "content": IMPROVE_USER_TEMPLATE.format(text=text)}
                    ],
                },
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"].strip()


register(_Claude())
