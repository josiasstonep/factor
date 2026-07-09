import httpx

from sidecar.ai_providers.base import build_system_prompt, build_user_message, register

_API_URL = "https://api.openai.com/v1/chat/completions"
_DEFAULT_MODEL = "gpt-4o-mini"


class _OpenAI:
    name = "openai"
    label = "OpenAI (GPT)"
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
        if not api_key:
            raise ValueError("OpenAI requires an API key.")
        m = model or _DEFAULT_MODEL
        system_prompt = build_system_prompt(section_type, expertise_type)
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                _API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": m,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": build_user_message(text, case_context)},
                    ],
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()


register(_OpenAI())
