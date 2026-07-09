import re
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
    "5. NÃO use markdown: sem **, *, __, #, ` nem listas com - ou *. O texto de saída é parágrafo corrido.\n"
    "6. NÃO escreva prefixos como 'Aqui está:', 'Texto melhorado:', 'Certamente:', 'Claro:', 'Segue:' etc. "
    "Comece DIRETAMENTE com o texto.\n"
    "7. Preserve EXATAMENTE todas as variáveis entre chaves duplas: {{rep}}, {{modelo}}, {{nome_perito}}, etc. "
    "Não as traduza, não as remova, não as altere.\n"
    "8. Retorne APENAS o texto melhorado, sem introduções, comentários ou marcações extra.\n"
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


def build_user_message(
    text: str,
    case_context: str | None = None,
    variable_values: dict[str, str] | None = None,
) -> str:
    """Build the user-turn message for the LLM, optionally enriched with case context."""
    parts: list[str] = []
    if variable_values:
        lines = "\n".join(f"- {k}: {v}" for k, v in variable_values.items() if v)
        if lines:
            parts.append(f"DADOS DO CASO:\n{lines}")
    if case_context and case_context.strip():
        parts.append(
            "PARTICULARIDADES DESTE CASO "
            "(use para adaptar o texto — não invente fatos além destes):\n"
            + case_context.strip()
        )
    if parts:
        parts.append(
            "TEXTO ORIGINAL DA SEÇÃO (melhore mantendo a estrutura; adapte apenas o necessário "
            "para refletir as particularidades acima):\n" + text
        )
    else:
        parts.append(f"TEXTO ORIGINAL:\n{text}")
    return "\n\n".join(parts)


def build_system_prompt(
    section_type: str = "custom",
    expertise_type: str | None = None,
) -> str:
    expertise_ctx = _EXPERTISE_CONTEXT.get(expertise_type or "", _DEFAULT_EXPERTISE_CONTEXT)
    section_guidance = _SECTION_GUIDANCE.get(section_type, _SECTION_GUIDANCE["custom"])
    return f"{expertise_ctx}{section_guidance}\n{_BASE_RULES}"


# Legacy constant kept for backward compat — points to generic prompt
IMPROVE_SYSTEM_PROMPT = build_system_prompt()


# ─── Output sanitizer ──────────────────────────────────────────────────────────

_PREAMBLE_RE = re.compile(
    r"^(aqui[^\n]*?:|texto melhorado[^\n]*?:|certamente[^\n]*?:|claro[^\n]*?:|"
    r"segue[^\n]*?:|ok[^\n]*?:|pronto[^\n]*?:|com prazer[^\n]*?:|claro[^\n]*?:)\s*",
    re.IGNORECASE,
)
_MARKDOWN_RE = re.compile(r"\*{1,2}([^*\n]+)\*{1,2}|_{1,2}([^_\n]+)_{1,2}|`([^`\n]+)`")
_MD_HEADING_RE = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_VAR_RE = re.compile(r"\{\{[^}]+\}\}")


def sanitize_ai_output(ai_text: str, original_text: str) -> tuple[str, list[str]]:
    """
    Strip AI formatting artifacts and detect quality issues.
    Returns (cleaned_text, warnings). On critical failure, returns (original_text, warnings).
    """
    warnings: list[str] = []
    text = ai_text.strip()

    # Strip preamble ("Aqui está:", "Certamente:", etc.)
    cleaned = _PREAMBLE_RE.sub("", text).strip()
    if cleaned != text:
        warnings.append("preamble_stripped")

    # Strip markdown headings
    cleaned = _MD_HEADING_RE.sub("", cleaned).strip()

    # Strip inline markdown, preserving inner text
    def _demd(m: re.Match) -> str:
        return (m.group(1) or m.group(2) or m.group(3) or "").strip()

    cleaned = _MARKDOWN_RE.sub(_demd, cleaned)

    # Detect aggressive summarization (output < 50% of original length)
    if len(cleaned) < len(original_text) * 0.5:
        warnings.append("summarized")
        return original_text, warnings

    # Detect destroyed variables: {{key}} present in original but missing in output
    orig_vars = set(_VAR_RE.findall(original_text))
    out_vars = set(_VAR_RE.findall(cleaned))
    missing = orig_vars - out_vars
    if missing:
        warnings.append(f"vars_destroyed:{','.join(sorted(missing))}")
        return original_text, warnings

    return cleaned, warnings


# ─── Signature protection ──────────────────────────────────────────────────────

_SIGNATURE_LINE_RE = re.compile(
    r"\{\{nome_perito\}\}[^\n]*Perito Criminal[^\n]*\{\{matricula_perito\}\}",
    re.IGNORECASE,
)


def extract_signature(text: str) -> tuple[str, str | None]:
    """
    Split body text from the signature line (conclusao sections).
    Returns (body_text, signature_line_or_None).
    """
    lines = text.split("\n")
    sig_idx = next(
        (i for i, line in enumerate(lines) if _SIGNATURE_LINE_RE.search(line)),
        None,
    )
    if sig_idx is None:
        return text, None
    sig = lines[sig_idx]
    body = "\n".join(lines[:sig_idx]).rstrip()
    return body, sig


# ─── Paragraph-level improvement ───────────────────────────────────────────────

_SKIP_PARA_RE = re.compile(r"^\s*(\{\{[^}]+\}\}\s*)+$")
_MIN_PARA_LEN = 20


async def improve_section_paragraphs(
    provider: "AiProvider",
    text: str,
    api_key: str | None,
    model: str | None,
    section_type: str = "custom",
    expertise_type: str | None = None,
    case_context: str | None = None,
) -> tuple[str, list[str]]:
    """
    Improve section text paragraph by paragraph for better results with weak local models.
    - Preserves signature line untouched (conclusao sections)
    - Skips pure-placeholder paragraphs and very short lines
    - Sanitizes each result, falling back to original if quality check fails
    Returns (improved_text, all_warnings).
    """
    body, signature = extract_signature(text)
    paragraphs = body.split("\n")
    all_warnings: list[str] = []
    improved_paras: list[str] = []

    for para in paragraphs:
        stripped = para.strip()
        # Skip: empty, too short, or pure placeholder (e.g. "{{imagem_01}}")
        if len(stripped) < _MIN_PARA_LEN or _SKIP_PARA_RE.match(stripped):
            improved_paras.append(para)
            continue
        try:
            raw = await provider.improve_text(
                para, api_key, model, section_type, expertise_type, case_context
            )
            cleaned, warns = sanitize_ai_output(raw, para)
            all_warnings.extend(warns)
            improved_paras.append(cleaned)
        except Exception:
            # On any provider error for a single paragraph, keep original
            improved_paras.append(para)

    result = "\n".join(improved_paras)
    if signature:
        result = result.rstrip() + "\n\n" + signature
    return result, all_warnings


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
        case_context: str | None = None,
    ) -> str: ...


# Registry populated by each provider module on import
_registry: dict[str, "AiProvider"] = {}


def register(provider: "AiProvider") -> None:
    _registry[provider.name] = provider


def get_provider(name: str) -> "AiProvider | None":
    return _registry.get(name)


def all_providers() -> list["AiProvider"]:
    return list(_registry.values())
