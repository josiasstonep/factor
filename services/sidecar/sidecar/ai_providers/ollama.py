import httpx

from sidecar.ai_providers.base import IMPROVE_USER_TEMPLATE, build_system_prompt, register

_OLLAMA_BASE = "http://localhost:11434"
_DEFAULT_MODEL = "llama3.2"


class _Ollama:
    name = "ollama"
    label = "Ollama (local)"
    requires_key = False

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                r = await client.get(f"{_OLLAMA_BASE}/")
                return r.status_code < 500
        except Exception:
            return False

    async def improve_text(
        self,
        text: str,
        api_key: str | None,
        model: str | None,
        section_type: str = "custom",
        expertise_type: str | None = None,
    ) -> str:
        m = model or _DEFAULT_MODEL
        system_prompt = build_system_prompt(section_type, expertise_type)
        prompt = f"{system_prompt}\n\n{IMPROVE_USER_TEMPLATE.format(text=text)}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{_OLLAMA_BASE}/api/generate",
                json={
                    "model": m,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0},
                },
            )
            r.raise_for_status()
            return r.json()["response"].strip()


register(_Ollama())
