import re
from typing import Protocol, runtime_checkable

# ─── Prompt builder ────────────────────────────────────────────────────────────

# Core mandate — placed FIRST in the system prompt so weak models read it before anything else.
# Philosophy: the AI is a SURGICAL ADAPTER, not an improver. The template text is already
# correct; the only job is to reflect case-specific details where they apply.
_CORE_MANDATE = (
    "Você é um adaptador cirúrgico de laudos periciais. "
    "Sua ÚNICA tarefa: reproduzir o TEXTO BASE fornecido com alterações MÍNIMAS e CIRÚRGICAS "
    "apenas onde as PARTICULARIDADES DO CASO o exigirem. "
    "NÃO melhore estilo. NÃO melhore gramática. NÃO melhore fluência. "
    "NÃO resuma. NÃO expanda. NÃO reestruture. "
    "O texto base já está correto — preserve-o integralmente, alterando somente o que "
    "as particularidades informadas tornam necessário."
)

_BASE_RULES = (
    "REGRAS ABSOLUTAS:\n"
    "1. Onde nenhuma particularidade se aplicar, reproduza o parágrafo SEM QUALQUER ALTERAÇÃO.\n"
    "2. NÃO invente fatos — use somente o que está nas particularidades fornecidas.\n"
    "3. Preserve integralmente: nomes, matrículas, REP, IMEI, hashes, datas, caminhos e todas "
    "as variáveis {{chave}}. Não as traduza, não as remova, não as altere.\n"
    "4. NÃO use markdown: sem **, *, __, #, `. Texto corrido, idêntico ao estilo do original.\n"
    "5. NÃO escreva prefixos ('Aqui está:', 'Segue:', 'Certamente:', etc.). "
    "Comece DIRETAMENTE com o texto adaptado.\n"
    "6. Retorne APENAS o texto — sem comentários, sem explicações das mudanças feitas.\n"
)

# Expertise context gives the model vocabulary knowledge but is NOT the framing identity.
_EXPERTISE_CONTEXT: dict[str, str] = {
    "informatica_extracao_completa": (
        "Vocabulário do domínio: extração lógica, física, chip-off; Cellebrite UFED, MSAB XRY, "
        "Oxygen Forensic; hash MD5/SHA-256; cadeia de custódia digital; IMEI, ICCID."
    ),
    "informatica_extracao": (
        "Vocabulário do domínio: extração forense de dispositivos digitais; ferramentas forenses "
        "homologadas; cadeia de custódia; hash de integridade."
    ),
    "informatica_multiplos": (
        "Vocabulário do domínio: múltiplos vestígios (Vestígio 01, Vestígio 02...); "
        "extração forense individual por dispositivo; hash por vestígio."
    ),
    "homicidio": (
        "Vocabulário do domínio: local de crime; tanatologia forense; balística; "
        "manchas de sangue; projétil; estojos; numeração de vestígios."
    ),
    "transito": (
        "Vocabulário do domínio: dinâmica veicular; marcas de frenagem; danos estruturais; "
        "ponto de impacto; análise de sinistro."
    ),
}

_DEFAULT_EXPERTISE_CONTEXT = (
    "Vocabulário do domínio: laudos periciais técnico-jurídicos; terminologia forense formal."
)

# Section guidance tells the model WHAT can legitimately change in each section type.
_SECTION_GUIDANCE: dict[str, str] = {
    "historia": (
        "SEÇÃO: Histórico. O que PODE mudar: referências à delegacia requisitante, ofício, "
        "data de recebimento e trecho de solicitação específico deste caso. "
        "O restante permanece idêntico."
    ),
    "descricao": (
        "SEÇÃO: Descrição do Material / Condições do Aparelho. O que PODE mudar: estado físico "
        "específico do vestígio (ex.: conector quebrado/danificado, tela trincada, lacre ausente, "
        "número de chips, marca, modelo, IMEI, cor, condições de conservação). "
        "Descreva fielmente a condição real informada nas particularidades. "
        "O restante permanece idêntico."
    ),
    "analise": (
        "SEÇÃO: Análise Pericial / Aquisição de Dados. O que PODE mudar: o que foi ou não "
        "possível realizar neste caso específico. Se o vestígio tinha impedimento físico "
        "(ex.: conector quebrado, tela inoperante, dispositivo sem energia), descreva o "
        "impedimento e o que foi tentado ou impossível. Se a extração foi bem-sucedida, "
        "descreva o método usado. Adapte o texto inteiro desta seção para refletir o que "
        "realmente ocorreu — não apenas palavras isoladas."
    ),
    "conclusao": (
        "SEÇÃO: Conclusão. O que PODE mudar: afirmações que dependem do resultado específico "
        "deste caso (ex.: dispositivo devolvido à delegacia por impossibilidade técnica; "
        "extração parcial realizada; dados preservados em hash). Se a perícia foi impossível, "
        "a conclusão deve refletir isso sem mencionar extração bem-sucedida. "
        "Adapte integralmente o que depender do resultado real."
    ),
    "custom": (
        "Adapte APENAS o que for diretamente mencionado nas particularidades do caso. "
        "O restante permanece idêntico."
    ),
}

IMPROVE_USER_TEMPLATE = "TEXTO ORIGINAL:\n{text}"


def build_user_message(
    text: str,
    case_context: str | None = None,
    variable_values: dict[str, str] | None = None,
) -> str:
    """
    Build the user-turn message for the LLM.
    Text BASE comes first (grounds the model on what to preserve).
    Context is wrapped in explicit delimiters so weak models don't echo it.
    """
    # Text base always first — this is what the model must output (adapted)
    parts = [f"=== TEXTO BASE (reproduza este texto com adaptações mínimas) ===\n{text}\n=== FIM DO TEXTO BASE ==="]

    context_lines: list[str] = []

    if case_context and case_context.strip():
        context_lines.append(f"Particularidades: {case_context.strip()}")

    if variable_values:
        vals = "; ".join(f"{k}={v}" for k, v in variable_values.items() if v)
        if vals:
            context_lines.append(f"Valores disponíveis: {vals}")

    if context_lines:
        ctx_block = "\n".join(context_lines)
        parts.append(
            f"=== CONTEXTO DE ADAPTAÇÃO (NÃO reproduza este bloco — use apenas para guiar mudanças) ===\n"
            f"{ctx_block}\n"
            f"=== FIM DO CONTEXTO ==="
        )
        parts.append(
            "Reproduza o TEXTO BASE acima com adaptações CIRÚRGICAS apenas onde o CONTEXTO "
            "exige mudança. Onde não houver correspondência, copie o texto EXATAMENTE. "
            "NÃO inclua o bloco CONTEXTO no output."
        )
    else:
        parts.append("Reproduza o TEXTO BASE acima sem alterações.")

    return "\n\n".join(parts)


def build_system_prompt(
    section_type: str = "custom",
    expertise_type: str | None = None,
) -> str:
    expertise_ctx = _EXPERTISE_CONTEXT.get(expertise_type or "", _DEFAULT_EXPERTISE_CONTEXT)
    section_hint = _SECTION_GUIDANCE.get(section_type, _SECTION_GUIDANCE["custom"])
    # Core mandate first (most important for weak models), then domain context, then hard rules
    return f"{_CORE_MANDATE}\n\n{section_hint}\n\n{expertise_ctx}\n\n{_BASE_RULES}"


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
# Patterns that indicate the model echoed the context block instead of adapting the text
_ECHOED_CONTEXT_RE = re.compile(
    r"(DADOS DO CASO|CONTEXTO DE ADAPTAÇÃO|TEXTO BASE|FIM DO TEXTO BASE|"
    r"Valores disponíveis:|Particularidades:|=== FIM DO CONTEXTO)",
    re.IGNORECASE,
)


def sanitize_ai_output(
    ai_text: str,
    original_text: str,
    has_context: bool = False,
) -> tuple[str, list[str]]:
    """
    Strip AI formatting artifacts and detect quality issues.
    Returns (cleaned_text, warnings). On critical failure, returns (original_text, warnings).

    has_context=True relaxes length and word-overlap checks because the AI is legitimately
    rewriting content to reflect case-specific facts (e.g. broken connector → no extraction).
    Without context the model should return near-identical text, so stricter thresholds apply.
    """
    warnings: list[str] = []
    text = ai_text.strip()

    # Detect context echo BEFORE any stripping — model reproduced the prompt structure
    if _ECHOED_CONTEXT_RE.search(text):
        warnings.append("echoed_context")
        return original_text, warnings

    # Detect context echo by length: output > 3× original means model echoed context blocks
    if len(text) > len(original_text) * 3:
        warnings.append("echoed_context")
        return original_text, warnings

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

    # Length check.
    # With context: the AI may legitimately produce a much shorter text
    # (e.g. "conector quebrado — sem extração" replaces a long brute-force paragraph).
    # Without context: the output should be close in length to the original.
    length_threshold = 0.30 if has_context else 0.72
    if len(cleaned) < len(original_text) * length_threshold:
        warnings.append("summarized")
        return original_text, warnings

    # Word-overlap / hallucination check.
    # Skip when case context is provided: the AI is expected to legitimately change
    # the narrative (different facts → different words). Applying this check with
    # context would silently revert correct adaptations.
    if not has_context:
        _WORD_RE = re.compile(r"\b\w{4,}\b")  # words ≥4 chars to skip stopwords
        orig_words = set(w.lower() for w in _WORD_RE.findall(original_text))
        out_words = set(w.lower() for w in _WORD_RE.findall(cleaned))
        if orig_words:
            overlap = len(orig_words & out_words) / len(orig_words)
            if overlap < 0.40:
                warnings.append("hallucinated")
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
            cleaned, warns = sanitize_ai_output(raw, para, has_context=bool(case_context))
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
