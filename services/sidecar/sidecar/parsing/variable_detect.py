import re
from uuid import uuid4

from rapidfuzz import process, fuzz

from sidecar.models.template import TemplateVariable
from sidecar.parsing.pdf_extract import PdfLine
from sidecar.parsing.text_utils import normalize_for_match, slugify, title_case_label

LABEL_VALUE_RE = re.compile(r"^([A-ZÀ-Ú][^:]{0,40}):\s*(.*)$")

KNOWN_VARIABLES: dict[str, str] = {
    # Perito / assinatura
    "perito": "Perito",
    "perito criminal": "Perito Criminal",
    "rep": "Número da REP",
    "cargo": "Cargo",
    "matricula": "Matrícula",
    # Identificação do laudo
    "numero do laudo": "Número do Laudo",
    "laudo pericial": "Laudo Pericial",
    "laudo": "Laudo",
    "natureza do exame": "Natureza do Exame",
    "tipo": "Tipo",
    "data de conclusao do laudo": "Data de Conclusão do Laudo",
    "data de conclusao": "Data de Conclusão",
    "data": "Data",
    # Partes
    "envolvidos": "Envolvidos",
    "investigado": "Investigado",
    "indiciado": "Indiciado",
    "vitima": "Vítima",
    "destinatario": "Destinatário",
    "requisitante": "Requisitante",
    "autoridade requisitante": "Autoridade Requisitante",
    "delegacia requisitante": "Delegacia Requisitante",
    "delegacia": "Delegacia",
    # Processo / solicitação
    "processo": "Processo nº",
    "numero do processo": "Número do Processo",
    "oficio": "Ofício",
    "sei": "SEI nº",
    "origem da solicitacao": "Origem da Solicitação",
    # Dispositivo / vestígio
    "vestigio": "Vestígio",
    "vestigios periciados": "Vestígios Periciados",
    "objeto": "Objeto",
    "material": "Material",
    "marca": "Marca",
    "modelo": "Modelo",
    "marca modelo": "Marca/Modelo",
    "dispositivo": "Dispositivo",
    "imei": "IMEI",
    "lacre": "Lacre nº",
    "numero lacre": "Nº do Lacre",
    # Localização
    "local": "Local",
    "orgao": "Órgão",
    "unidade": "Unidade",
    "cidade": "Cidade",
}

# Normalized phrases that are part of the institutional letterhead — never variables.
INSTITUTIONAL_BLOCKLIST: set[str] = {
    "secretaria de defesa social",
    "secretaria de defesa social de pernambuco",
    "gerencia geral de policia cientifica",
    "gerencia de policia cientifica do interior",
    "gerencia de policia cientifica",
    "unidade regional de policia cientifica",
    "governo do estado de pernambuco",
    "policia cientifica",
    "instituto de criminalistica",
    "professor armando samico",
    "rua joaquim sampaio",
    "nossa senhora das gracas",
    "fone",
    "e-mail",
    "urpoc",
    "ggpoc",
    "sds",
    "atenciosamente",
    "perito a criminal",
}

# Patterns for variables that appear inline in narrative text (not label:value).
# Group 1 captures the value detected from the template PDF (used as example/hint).
INLINE_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    # SEI nº 3900000825.000159/2026-68
    (re.compile(r'\bSEI\s+n[°º]\s*([\d./-]{10,})', re.IGNORECASE), "sei", "SEI nº"),
    # Ofício 11 (86414402) or Ofício 85219959/2026 — capture "num (num)" as one value
    (re.compile(r'\bOf[íi]cio\s+(\d[\w./-]*(?:\s*\(\s*\w+\s*\))?)', re.IGNORECASE), "oficio", "Ofício"),
    # Vestígio 74C5AC5E-4 or B3A4274B-2 — must be hex chars with a dash (rules out words like "lacrado")
    (re.compile(r'\bVest[íi]gio\s+([A-F0-9]{4,}-[A-F0-9-]+)', re.IGNORECASE), "vestigio", "Vestígio"),
    # Processo nº 0000152-35.2026.8.17.2250
    (re.compile(r'\b[Pp]rocesso\s+n[°º\.?\s]*([\d./-]{10,})', re.IGNORECASE), "processo", "Processo nº"),
    # marca Apple / marca Samsung
    (re.compile(r'\bmarca\s+((?:Apple|Samsung|Motorola|Xiaomi|LG|Huawei|Nokia|Sony)\b)', re.IGNORECASE), "marca", "Marca"),
    # REP 28203/2026 ou REP 28203_2026
    (re.compile(r'\bREP\s+(\d{4,6}[/_]\d{4})', re.IGNORECASE), "rep", "REP"),
    # lacre nº 1343769
    (re.compile(r'\blacre\s+n[°º]?\s*(\d{5,})', re.IGNORECASE), "lacre", "Lacre nº"),
    # Nome do Perito Criminal: "designou o Perito Criminal Fulano De Tal para"
    (re.compile(
        r'\bPerito\s+Criminal\s+((?:[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇÜ]\w+)(?:\s+[A-Za-záéíóúâêîôûãõàçü]\w*){2,6})\s+para\b',
        re.UNICODE,
    ), "nome_perito", "Nome do Perito"),
    # Circunscrição: "170ª CIRCUNSCRIÇÃO - ITAPETIM - PCPE"
    (re.compile(
        r'(\d+\s*[ªº]\s*CIRCUNSCRI[CÇ][ÃA]O\s*[-–]\s*[\w\s]+[-–]\s*\w+)',
        re.IGNORECASE | re.UNICODE,
    ), "delegacia_requisitante", "Delegacia Requisitante"),
]

# Regex to detect the solicitation block-quote: "[...]text[...]" in the Histórico section.
_SOLICITATION_RE = re.compile(
    r'\[(?:\.{3}|…)\]\s*([\s\S]{30,800}?)\s*\[(?:\.{3}|…)\]'
)

FUZZY_THRESHOLD = 80
HEADER_PAGE_LIMIT = 3  # scan first 3 pages for label:value variables


def _is_institutional(normalized: str) -> bool:
    for blocked in INSTITUTIONAL_BLOCKLIST:
        if blocked in normalized or normalized in blocked:
            return True
    return False


def detect_variables(lines: list[PdfLine]) -> list[TemplateVariable]:
    seen_keys: set[str] = set()
    variables: list[TemplateVariable] = []

    # ── Pass 1: label:value lines in the header pages ────────────────────────
    for line in lines:
        if line.page >= HEADER_PAGE_LIMIT:
            continue
        match = LABEL_VALUE_RE.match(line.text)
        if not match:
            continue
        raw_label = match.group(1).strip()
        norm_label = normalize_for_match(raw_label)

        if _is_institutional(norm_label):
            continue

        best = process.extractOne(
            norm_label, KNOWN_VARIABLES.keys(), scorer=fuzz.token_set_ratio, score_cutoff=FUZZY_THRESHOLD
        )
        if best:
            canonical_key, _score, _idx = best
            label = KNOWN_VARIABLES[canonical_key]
            key = slugify(canonical_key)
        else:
            label = title_case_label(raw_label)
            key = slugify(raw_label)

        if key in seen_keys:
            continue
        seen_keys.add(key)

        variables.append(
            TemplateVariable(
                id=str(uuid4()),
                key=key,
                label=label,
                source_label_detected=raw_label,
                source_value_detected=match.group(2).strip()[:120] or None,
            )
        )

    # ── Pass 2: inline patterns across ALL pages ─────────────────────────────
    # Always runs — even if the key already exists from Pass 1, we UPDATE
    # source_value_detected with the precise inline value (e.g. "74C5AC5E-4"
    # instead of the long colon-value description) so placeholder injection works.
    full_text = " ".join(ln.text for ln in lines)
    for pattern, key, label in INLINE_PATTERNS:
        m = pattern.search(full_text)
        if not m:
            continue
        # Collapse any embedded newlines/extra whitespace from multi-line PDF extraction
        detected_value = " ".join(m.group(1).split())

        if key in seen_keys:
            # Update source_value_detected for the already-created variable
            for var in variables:
                if var.key == key:
                    var.source_value_detected = detected_value
                    break
        else:
            seen_keys.add(key)
            variables.append(
                TemplateVariable(
                    id=str(uuid4()),
                    key=key,
                    label=label,
                    source_label_detected=detected_value,
                    source_value_detected=detected_value,
                )
            )

    # ── Pass 3: block-quote solicitation text "[...]texto[...]" ─────────────
    if "trecho_solicitacao" not in seen_keys:
        # Join lines preserving paragraph breaks for multi-line detection
        full_text_nl = "\n".join(ln.text for ln in lines)
        m = _SOLICITATION_RE.search(full_text_nl)
        if m:
            quote_text = " ".join(m.group(1).split())
            seen_keys.add("trecho_solicitacao")
            variables.append(
                TemplateVariable(
                    id=str(uuid4()),
                    key="trecho_solicitacao",
                    label="Trecho da Solicitação",
                    source_label_detected=None,
                    source_value_detected=quote_text[:600] if quote_text else None,
                )
            )

    return variables
