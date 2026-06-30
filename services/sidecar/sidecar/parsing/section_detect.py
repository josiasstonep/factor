from collections import Counter
from uuid import uuid4

from rapidfuzz import fuzz

from sidecar.models.template import SectionType, TemplateSection
from sidecar.parsing.pdf_extract import PdfLine
from sidecar.parsing.text_utils import LABEL_VALUE_RE, normalize_for_match, title_case_label

SECTION_KEYWORDS: dict[SectionType, list[str]] = {
    SectionType.HISTORIA: ["historico", "historia", "relato", "narrativa"],
    SectionType.DESCRICAO: [
        "descricao",
        "exame pericial",
        "material examinado",
        "vestigios examinados",
        "objeto do exame",
    ],
    SectionType.ANALISE: ["analise", "discussao", "comentarios", "fundamentacao"],
    SectionType.CONCLUSAO: ["conclusao", "conclusoes", "considerac"],
}

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
    body_buffer: dict[int, list[str]] = {}
    current_idx: int | None = None

    for line in lines:
        # Label:value lines (e.g. "Perito: xxx") belong to variable detection.
        # Skip them as heading candidates unconditionally — font heuristics can
        # misfire on header rows that happen to be 1pt above body size.
        if LABEL_VALUE_RE.match(line.text):
            if current_idx is not None:
                body_buffer[current_idx].append(line.text)
            continue

        # Font/style heuristics decide whether a line is a heading; THEN we
        # classify its type. This order prevents body-text sentences that happen
        # to contain section keywords from being wrongly promoted to headings.
        if _looks_like_heading(line, body_size):
            sec_type = _classify(line.text) or SectionType.CUSTOM
            label = title_case_label(line.text) if sec_type == SectionType.CUSTOM else {
                SectionType.HISTORIA: "História",
                SectionType.DESCRICAO: "Descrição",
                SectionType.ANALISE: "Análise",
                SectionType.CONCLUSAO: "Conclusão",
            }[sec_type]
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
            body_buffer[current_idx].append(line.text)

    for idx, section in enumerate(sections):
        paragraphs = body_buffer.get(idx, [])
        section.default_text = "\n".join(paragraphs).strip() or None

    return sections
