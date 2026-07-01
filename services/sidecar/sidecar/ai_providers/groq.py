import httpx

from sidecar.ai_providers.base import IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, register

_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_DEFAULT_MODEL = "llama-3.1-8b-instant"


class _Groq:
    name = "groq"
    label = "Groq (LLaMA rápido)"
    requires_key = True

    async def is_available(self) -> bool:
        return True

    async def improve_text(self, text: str, api_key: str | None, model: str | None) -> str:
        if not api_key:
            raise ValueError("Groq requires an API key.")
        m = model or _DEFAULT_MODEL
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                _API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": m,
                    "messages": [
                        {"role": "system", "content": IMPROVE_SYSTEM_PROMPT},
                        {"role": "user", "content": IMPROVE_USER_TEMPLATE.format(text=text)},
                    ],
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()


register(_Groq())
