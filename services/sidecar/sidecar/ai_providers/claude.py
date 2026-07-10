import httpx

from sidecar.ai_providers.base import build_system_prompt, build_user_message, register
from sidecar.config import get_env_key

_API_URL = "https://api.anthropic.com/v1/messages"
_DEFAULT_MODEL = "claude-haiku-4-5-20251001"


class _Claude:
    name = "claude"
    label = "Claude (Anthropic)"
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
        effective_key = api_key or get_env_key("claude")
        if not effective_key:
            raise ValueError("Claude requires an API key. Configure ANTHROPIC_API_KEY no .env ou cole a chave na interface.")
        m = model or _DEFAULT_MODEL
        system_prompt = build_system_prompt(section_type, expertise_type)
        user_msg = build_user_message(text, case_context)
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                _API_URL,
                headers={
                    "x-api-key": effective_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": m,
                    "max_tokens": 4096,
                    "temperature": 0,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_msg}],
                },
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"].strip()


register(_Claude())
