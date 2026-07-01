from typing import Protocol, runtime_checkable

IMPROVE_SYSTEM_PROMPT = (
    "Você é um especialista em redação de documentos periciais. "
    "Melhore a clareza, gramática e fluência do texto fornecido, "
    "preservando todos os fatos, nomes, datas, números e termos técnicos sem alterações. "
    "Retorne APENAS o texto melhorado, sem introduções, comentários ou marcações."
)

IMPROVE_USER_TEMPLATE = "TEXTO ORIGINAL:\n{text}"


@runtime_checkable
class AiProvider(Protocol):
    name: str
    label: str
    requires_key: bool

    async def is_available(self) -> bool: ...

    async def improve_text(self, text: str, api_key: str | None, model: str | None) -> str: ...


# Registry populated by each provider module on import
_registry: dict[str, "AiProvider"] = {}


def register(provider: "AiProvider") -> None:
    _registry[provider.name] = provider


def get_provider(name: str) -> "AiProvider | None":
    return _registry.get(name)


def all_providers() -> list["AiProvider"]:
    return list(_registry.values())
