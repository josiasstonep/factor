import re as _re
from collections import Counter
from uuid import uuid4

from rapidfuzz import fuzz

from sidecar.models.template import SectionType, TemplateSection
from sidecar.parsing.pdf_extract import PdfLine
from sidecar.parsing.text_utils import LABEL_VALUE_RE, normalize_for_match, title_case_label

# Regex for numbered sub-sections like "4.1. " or "3) "
_SUBSECTION_RE = _re.compile(r'^\d+[\.\d]*[\.]\s|^\d+\)\s')
# Split embedded subsection markers inside an already-merged string
_SUBSECTION_SPLIT_RE = _re.compile(r'(?<=\S)\s+(?=\d+\.\d+\.\s)')
# Characters whose presence at the start of a line forces a new paragraph
_QUOTE_STARTERS = (
    '"',   # ASCII double quote
    '“',  # left curly double quote
    '”',  # right curly double quote
    '‘',  # left single quote
    '’',  # right single quote
    '[',   # bracket
    '·',  # middle dot
    '•',  # bullet
)


def normalize_paragraphs(lines: list[str]) -> str:
    # Join physical PDF lines (or already-stored text split by \n) into prose
    # paragraphs separated by \n.  Within a paragraph lines are joined with spaces.
    # Paragraph breaks: blank lines, quote starters, numbered sub-sections.
    # Also splits embedded sub-section markers in merged strings.
    paragraphs: list[list[str]] = []
    current: list[str] = []

    for line in lines:
        line = line.strip()
        if not line:
            if current:
                paragraphs.append(current)
                current = []
            continue

        starts_block = (
            line.startswith(_QUOTE_STARTERS)
            or bool(_SUBSECTION_RE.match(line))
        )

        if starts_block and current:
            paragraphs.append(current)
            current = []

        current.append(line)

    if current:
        paragraphs.append(current)

    result = '\n'.join(' '.join(p) for p in paragraphs)
    # Split any sub-section markers that ended up inline after joining
    result = _SUBSECTION_SPLIT_RE.sub('\n', result)
    return result


def normalize_paragraphs_from_pdf(lines: list[PdfLine]) -> str:
    # Detect paragraph boundaries using X-position (first-line indent) and quote starters.
    # PDFs from Word/LibreOffice often emit one text-block per visual line even within
    # the same paragraph, so block_start alone is unreliable.
    # Instead: a line that starts further right than the typical body margin is the
    # first line of a new paragraph (first-line indent in the source document).
    if not lines:
        return ""

    x0_values = [line.bbox[0] for line in lines]
    if not x0_values:
        return ' '.join(line.text.strip() for line in lines if line.text.strip())

    # Estimate left body margin: minimum x0 (with small tolerance) as most lines
    # start at the left margin (continuation lines).
    # We'll use percentile(5) to avoid outliers from bullet/quote lines.
    sorted_x = sorted(x0_values)
    p5_idx = max(0, int(0.05 * len(sorted_x)))
    left_margin = sorted_x[p5_idx]

    # A first-line indent of 1.25cm at 72pt/inch = 1.25 * 72 / 2.54 ~ 35pt.
    # If a line's x0 is more than 20pt past the left margin, treat it as a new paragraph.
    indent_threshold = left_margin + 20.0

    paragraphs: list[list[str]] = []
    current: list[str] = []

    for line in lines:
        text = line.text.strip()
        if not text:
            continue
        x0 = line.bbox[0]
        is_para_start = x0 >= indent_threshold or (
            line.block_start and (
                text.startswith(_QUOTE_STARTERS) or bool(_SUBSECTION_RE.match(text))
            )
        )
        if is_para_start and current:
            paragraphs.append(current)
            current = []
        current.append(text)

    if current:
        paragraphs.append(current)

    joined = [' '.join(p) for p in paragraphs]
    # Merge "paragraphs" that are suspiciously short (single words from table extraction)
    # into the previous paragraph by joining with a space.
    merged: list[str] = []
    for part in joined:
        if merged and len(part.split()) <= 3 and not _SUBSECTION_RE.match(part):
            merged[-1] = merged[-1].rstrip() + ' ' + part
        else:
            merged.append(part)
    return '\n'.join(merged)


SECTION_KEYWORDS: dict[SectionType, list[str]] = {
    SectionType.HISTORIA: ["historico", "historia", "relato", "narrativa"],
    SectionType.DESCRICAO: [
        "descricao",
        "exame pericial",
        "material examinado",
        "vestigios examinados",
        "objeto do exame",
        "material recebido",
        "material para analise",
        "vestigio recebido",
        "objeto periciado",
        "material recebido para analise",
    ],
    SectionType.ANALISE: [
        "analise",
        "discussao",
        "comentarios",
        "fundamentacao",
        "analise forense",
        "dados extraidos",
        "aquisicao",
        "preservacao",
        "verificacao de integridade",
        "integridade dos arquivos",
        "aquisicao e preservacao",
        "analise forense dos dados",
        "verificacao de integridade dos arquivos",
    ],
    SectionType.CONCLUSAO: ["conclusao", "conclusoes", "considerac"],
}

# Only skip lines that are PURE institutional boilerplate (letterhead/footer).
# Real laudo sections like "OBJETIVO" and "CONDIÇÕES GERAIS" must NOT be here.
IGNORED_HEADING_FRAGMENTS: list[str] = [
    "secretaria de defesa",
    "gerencia geral de policia",
    "gerencia de policia cientifica",
    "unidade regional de policia",
    "governo do estado",
    "instituto de criminalistica",
    "assinado eletronicamente",
    "documento assinado",
    # Figure captions ("Figura 01 -", "Figure 01 -") are not sections
    "figura ",
    "figure ",
    # Forensic tool names that appear in bold but are NOT chapter headings
    "cellebrite",
    "ufed",
    "physical analyzer",
    "inseyets",
    "oxygen forensic",
    "magnet axiom",
    "ufdr",
]

FUZZY_THRESHOLD = 78
MAX_HEADING_WORDS = 8


def _body_size(lines: list[PdfLine]) -> float:
    if not lines:
        return 10.0
    weighted = Counter()
    for line in lines:
        weighted[round(line.size)] += len(line.text)
    return float(weighted.most_common(1)[0][0])


def _classify(text: str) -> SectionType | None:
    norm = normalize_for_match(text)
    best_type: SectionType | None = None
    best_score = 0.0
    for sec_type, keywords in SECTION_KEYWORDS.items():
        for kw in keywords:
            score = fuzz.partial_ratio(norm, kw)
            if score > best_score:
                best_score = score
                best_type = sec_type
    if best_score >= FUZZY_THRESHOLD:
        return best_type
    return None


def _looks_like_heading(line: PdfLine, body_size: float) -> bool:
    word_count = len(line.text.split())
    if word_count == 0 or word_count > MAX_HEADING_WORDS:
        return False
    if line.text.endswith((".", ",", ";")):
        return False
    is_larger = line.size >= body_size + 1.0
    is_caps = line.text.upper() == line.text and any(c.isalpha() for c in line.text)
    return is_larger or line.bold or is_caps


def detect_sections(lines: list[PdfLine]) -> list[TemplateSection]:
    body_size = _body_size(lines)
    sections: list[TemplateSection] = []
    body_buffer: dict[int, list[PdfLine]] = {}
    current_idx: int | None = None

    for line in lines:
        # Label:value lines (e.g. "Perito: xxx") belong to variable detection.
        # Skip them as heading candidates unconditionally — font heuristics can
        # misfire on header rows that happen to be 1pt above body size.
        if LABEL_VALUE_RE.match(line.text):
            if current_idx is not None:
                body_buffer[current_idx].append(line)
            continue

        # Font/style heuristics decide whether a line is a heading; THEN we
        # classify its type. This order prevents body-text sentences that happen
        # to contain section keywords from being wrongly promoted to headings.
        if _looks_like_heading(line, body_size):
            norm = normalize_for_match(line.text)
            if any(frag in norm for frag in IGNORED_HEADING_FRAGMENTS):
                continue
            sec_type = _classify(line.text) or SectionType.CUSTOM
            # Strip leading "N." / "N) " number prefix (e.g. "3. Objetivo" -> "Objetivo")
            clean_text = _re.sub(r'^\d+[\.\)]\s*', '', line.text).strip()
            # Use the actual heading text (title-cased) as label so each section has
            # a unique, meaningful name — avoids three sections all labeled "Análise".
            label = title_case_label(clean_text)
            sections.append(
                TemplateSection(
                    id=str(uuid4()),
                    type=sec_type,
                    label=label,
                    order=len(sections),
                    heading_text=line.text,
                    default_text=None,
                )
            )
            current_idx = len(sections) - 1
            body_buffer[current_idx] = []
        elif current_idx is not None:
            body_buffer[current_idx].append(line)

    for idx, section in enumerate(sections):
        raw_lines = body_buffer.get(idx, [])
        section.default_text = normalize_paragraphs_from_pdf(raw_lines) or None

    return sections
