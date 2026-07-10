import re
from typing import Protocol, runtime_checkable

# ─── Prompt builder ────────────────────────────────────────────────────────────

# Core mandate — placed FIRST in the system prompt so weak models read it before anything else.
# Philosophy: the AI is a SURGICAL ADAPTER, not an improver. The template text is already
# correct; the only job is to reflect case-specific details where they apply.
_CORE_MANDATE = (
    "Você é um perito criminal especializado em revisar laudos periciais.\n"
    "REGRA PRINCIPAL:\n"
    "  • Se há PARTICULARIDADES DO CASO: adapte a seção para refletir os fatos reais. "
    "Se os fatos diferem do texto base, REESCREVA para descrever o que ocorreu. "
    "O texto base é referência de vocabulário forense — não é conteúdo obrigatório quando os fatos divergem.\n"
    "  • Se NÃO há particularidades: reproduza o texto base sem alterações."
)

_BASE_RULES = (
    "REGRAS ABSOLUTAS:\n"
    "1. Onde nenhuma particularidade se aplicar, reproduza o parágrafo SEM QUALQUER ALTERAÇÃO.\n"
    "2. NÃO invente fatos — use somente o que está nas particularidades fornecidas.\n"
    "3. CRÍTICO — VARIÁVEIS: toda variável {{chave}} presente no texto original DEVE aparecer "
    "na sua saída, sem exceção. Mesmo que o conteúdo da seção mude completamente, "
    "inclua as variáveis do original em posição contextualmente adequada. "
    "Exemplos: se o original tem '(VESTÍGIO {{vestigio}})', sua saída deve referenciar "
    "o aparelho como '(VESTÍGIO {{vestigio}})'; se tem '{{rep}}', '{{modelo}}', '{{imei}}', "
    "preserve-os. NUNCA substitua {{chave}} por valor literal. NUNCA omita um {{chave}}.\n"
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
        "data de recebimento e trecho de solicitação específico deste caso.\n"
        "FONTE: use APENAS 'Relato:' do contexto para adaptar. "
        "Ignore 'Condições do vestígio:' — estado físico não pertence ao histórico.\n"
        "O restante permanece idêntico."
    ),
    "descricao": (
        "SEÇÃO: Descrição do Material / Condições do Aparelho. "
        "O que PODE mudar: estado físico específico do vestígio "
        "(ex.: conector quebrado/danificado, tela trincada, lacre ausente, número de chips).\n"
        "FONTE: use APENAS 'Condições do vestígio:' do contexto para adaptar. "
        "Ignore 'Relato:' — desfecho não pertence à descrição do material.\n"
        "O restante permanece idêntico."
    ),
    "analise": (
        "SEÇÃO: Análise Pericial / Aquisição de Dados.\n"
        "REGRA PRINCIPAL: se os fatos do caso (particularidades) forem DIFERENTES do que o texto base "
        "descreve, REESCREVA esta seção inteiramente para refletir o que realmente ocorreu. "
        "O texto base é referência de vocabulário forense, NÃO conteúdo a ser preservado quando "
        "os fatos divergem.\n"
        "FONTES DO CONTEXTO:\n"
        "- 'Condições do vestígio:' → use para descrever o estado físico e impedimentos técnicos.\n"
        "- 'Relato:' → use como contexto adicional se diretamente relevante para a análise.\n"
        "- Se nenhuma fonte estiver presente, reproduza o texto original SEM alterações.\n"
        "ESCOPO: descreva APENAS o que ocorreu durante o exame. "
        "NÃO mencione procedimentos não realizados. NÃO inclua desfecho (pertence à Conclusão).\n"
        "PARA IMPEDIMENTO FÍSICO: 1 parágrafo — (a) condição do dispositivo; "
        "(b) impedimento; (c) consequência técnica. Sem brute-force, Cellebrite ou extração.\n"
        "VARIÁVEIS: use '(VESTÍGIO {{vestigio}})' ao mencionar o aparelho. Preserve TODAS as {{chave}}."
    ),
    "conclusao": (
        "SEÇÃO: Conclusão.\n"
        "ESCOPO: síntese completa da perícia — do recebimento ao desfecho.\n"
        "FONTES DO CONTEXTO:\n"
        "- 'Condições do vestígio:' → inclua estado do aparelho e impedimentos técnicos.\n"
        "- 'Relato:' → inclua desfecho, devolução, nova requisição e encaminhamentos.\n"
        "- Use AMBAS para compor a conclusão completa e coesa.\n"
        "O QUE INCLUIR: objeto periciado, constatações, o que foi/não foi possível, desfecho e ressalvas.\n"
        "SUPRESSÃO: elimine afirmações de extração bem-sucedida se isso não ocorreu.\n"
        "CONSOLIDAÇÃO: texto corrido, sem repetições.\n"
        "VARIÁVEIS: preserve TODAS as {{chave}} (ex: {{vestigio}}, {{rep}}, {{modelo}}, {{imei}})."
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
            "Adapte o TEXTO BASE conforme as PARTICULARIDADES DO CASO. "
            "Se os fatos diferem do texto base, reescreva para refletir a realidade. "
            "NÃO inclua o bloco CONTEXTO no output. NÃO adicione comentários ou explicações."
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

_WORD_RE = re.compile(r"\b\w{4,}\b")

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
    length_threshold = 0.10 if has_context else 0.72
    if len(cleaned) < len(original_text) * length_threshold:
        warnings.append("summarized")
        return original_text, warnings

    # Word-overlap / hallucination check.
    # Skip when case context is provided: the AI is expected to legitimately change
    # the narrative (different facts → different words). Applying this check with
    # context would silently revert correct adaptations.
    if not has_context:
        orig_words = set(w.lower() for w in _WORD_RE.findall(original_text))
        out_words = set(w.lower() for w in _WORD_RE.findall(cleaned))
        if orig_words:
            overlap = len(orig_words & out_words) / len(orig_words)
            if overlap < 0.40:
                warnings.append("hallucinated")
                return original_text, warnings

    # Detect destroyed variables: {{key}} present in original but missing in output.
    # Without context: fatal — the model had no reason to remove variables, restore original.
    # With context: downgrade to warning — the model legitimately rewrote the section and
    # the user is already reviewing the diff; they can reject if variables are critical.
    orig_vars = set(_VAR_RE.findall(original_text))
    out_vars = set(_VAR_RE.findall(cleaned))
    missing = orig_vars - out_vars
    if missing:
        warnings.append(f"vars_destroyed:{','.join(sorted(missing))}")
        if not has_context:
            return original_text, warnings
        # has_context=True: show the AI text with a warning so the user can decide

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

# Section types where whole-section processing is used when case context is provided.
# These sections may need to suppress entire paragraphs (e.g., "portal upload" paragraph
# when the device had a broken connector and no extraction occurred).
_WHOLE_SECTION_TYPES = {"analise", "conclusao"}


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
    Improve section text for better results with cloud and local models.

    Whole-section mode (analise/conclusao + case_context):
      Sends all paragraphs at once so the model can suppress redundant ones,
      eliminate "positive setup → negative result" structures, and avoid
      repeating the same fact across multiple paragraphs.

    Per-paragraph mode (default — all other cases):
      Processes each paragraph individually, safe for weak local models (Ollama).
      Falls back to original paragraph on any quality failure.

    Both modes:
      - Preserve the signature line untouched (conclusao sections)
      - Sanitize output; fall back to original on critical quality failure
    """
    body, signature = extract_signature(text)

    # Whole-section mode: let the model see all paragraphs together so it can
    # suppress inapplicable ones and avoid inter-paragraph redundancy.
    if case_context and section_type in _WHOLE_SECTION_TYPES:
        try:
            raw = await provider.improve_text(
                body, api_key, model, section_type, expertise_type, case_context
            )
            cleaned, warns = sanitize_ai_output(raw, body, has_context=True)
            if cleaned != body:  # AI produced useful output (sanitizer accepted)
                result = cleaned
                if signature:
                    result = result.rstrip() + "\n\n" + signature
                return result, warns
            # cleaned == body means sanitizer rejected → fall through to per-paragraph
        except Exception:
            pass  # fall through to per-paragraph on any error

    # Per-paragraph mode
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
