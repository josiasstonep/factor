from typing import Protocol, runtime_checkable

# ─── Prompt builder ────────────────────────────────────────────────────────────

_BASE_RULES = (
    "Regras obrigatórias:\n"
    "1. Não invente fatos, pessoas, datas, números ou locais — use somente o que está no texto original.\n"
    "2. Se faltar informação essencial, sinalize com [DADO AUSENTE] no local correspondente.\n"
    "3. Preserve integralmente: nomes próprios, matrículas, números de processo/REP/vestígio, "
    "CEPs, coordenadas GPS, hashes MD5/SHA, caminhos de arquivo, IDs de dispositivo (IMEI, ICCID), "
    "valores monetários, datas e horas.\n"
    "4. Mantenha o tom técnico-jurídico formal, voz passiva, terceira pessoa.\n"
    "5. Retorne APENAS o texto melhorado, sem introduções, comentários ou marcações extra.\n"
)

_EXPERTISE_CONTEXT: dict[str, str] = {
    "informatica_extracao_completa": (
        "Você é Perito Criminal especialista em Informática Forense. "
        "Domina análise de dispositivos móveis, extração de dados com ferramentas forenses "
        "(Cellebrite UFED, MSAB XRY, Oxygen Forensic) e verificação de integridade por hash. "
        "Use vocabulário técnico forense computacional (extração lógica, física, chip-off, "
        "hash de verificação, cadeia de custódia digital).\n"
    ),
    "informatica_extracao": (
        "Você é Perito Criminal especialista em Informática Forense. "
        "Domina extração de dados de dispositivos digitais e documentação técnica pericial. "
        "Use vocabulário forense computacional preciso.\n"
    ),
    "informatica_multiplos": (
        "Você é Perito Criminal especialista em Informática Forense com experiência em "
        "perícias envolvendo múltiplos dispositivos. Mantenha rigor na identificação de cada "
        "vestígio (Vestígio 01, Vestígio 02, etc.) e nos seus respectivos resultados.\n"
    ),
    "homicidio": (
        "Você é Perito Criminal especialista em Local de Crime (homicídio). "
        "Domina criminalística, tanatologia forense, balística e documentação de vestígios. "
        "Use terminologia técnica pericial (posição do corpo, padrão de manchas de sangue, "
        "projétil, estojos, numeração de vestígios).\n"
    ),
    "transito": (
        "Você é Perito Criminal especialista em Acidentes de Trânsito. "
        "Domina dinâmica veicular, análise de danos, marcas de frenagem e documentação "
        "técnica de sinistros. Use terminologia técnica de engenharia veicular e criminalística.\n"
    ),
}

_DEFAULT_EXPERTISE_CONTEXT = (
    "Você é Perito Criminal especialista em elaboração de laudos periciais. "
    "Use vocabulário técnico-jurídico formal e preciso.\n"
)

_SECTION_GUIDANCE: dict[str, str] = {
    "historia": (
        "Esta seção é o Histórico/Relato. Melhore a fluência narrativa mantendo a "
        "ordem cronológica dos fatos e todas as referências a autoridades, ofícios e requisições.\n"
    ),
    "descricao": (
        "Esta seção é a Descrição do Material. Melhore a clareza descritiva. "
        "Preserve todas as características físicas (marca, modelo, cor, estado de conservação, "
        "número de série, lacres) exatamente como constam no original.\n"
    ),
    "analise": (
        "Esta seção é a Análise Pericial. Melhore o encadeamento lógico entre evidências e "
        "conclusões parciais. Não acrescente interpretações além das explicitamente presentes "
        "no texto original.\n"
    ),
    "conclusao": (
        "Esta seção é a Conclusão. Melhore a precisão e clareza das afirmações conclusivas. "
        "Não acrescente conclusões além do que as evidências descritas nas seções anteriores sustentam. "
        "Mantenha linguagem afirmativa técnica ('constata-se', 'verifica-se', 'concluiu-se').\n"
    ),
    "custom": (
        "Melhore a clareza e fluência do texto pericial preservando todos os fatos e dados técnicos.\n"
    ),
}

IMPROVE_USER_TEMPLATE = "TEXTO ORIGINAL:\n{text}"


def build_system_prompt(
    section_type: str = "custom",
    expertise_type: str | None = None,
) -> str:
    expertise_ctx = _EXPERTISE_CONTEXT.get(expertise_type or "", _DEFAULT_EXPERTISE_CONTEXT)
    section_guidance = _SECTION_GUIDANCE.get(section_type, _SECTION_GUIDANCE["custom"])
    return f"{expertise_ctx}{section_guidance}\n{_BASE_RULES}"


# Legacy constant kept for backward compat — points to generic prompt
IMPROVE_SYSTEM_PROMPT = build_system_prompt()


# ─── Provider protocol ─────────────────────────────────────────────────────────


@runtime_checkable
class AiProvider(Protocol):
    name: str
    label: str
    requires_key: bool

    async def is_available(self) -> bool: ...

    async def improve_text(
        self,
        text: str,
        api_key: str | None,
        model: str | None,
        section_type: str = "custom",
        expertise_type: str | None = None,
    ) -> str: ...


# Registry populated by each provider module on import
_registry: dict[str, "AiProvider"] = {}


def register(provider: "AiProvider") -> None:
    _registry[provider.name] = provider


def get_provider(name: str) -> "AiProvider | None":
    return _registry.get(name)


def all_providers() -> list["AiProvider"]:
    return list(_registry.values())
