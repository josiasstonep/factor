import re
from uuid import uuid4

from rapidfuzz import process, fuzz

from sidecar.models.template import TemplateVariable
from sidecar.parsing.pdf_extract import PdfLine
from sidecar.parsing.text_utils import normalize_for_match, slugify, title_case_label

LABEL_VALUE_RE = re.compile(r"^([A-ZÀ-Ú][^:]{1,40}):\s*(.*)$")

KNOWN_VARIABLES: dict[str, str] = {
    "perito": "Perito",
    "rep": "REP",
    "cargo": "Cargo",
    "matricula": "Matrícula",
    "data": "Data",
    "local": "Local",
    "processo": "Processo",
    "requisitante": "Requisitante",
    "numero do laudo": "Número do Laudo",
    "orgao": "Órgão",
    "unidade": "Unidade",
    "cidade": "Cidade",
    "vitima": "Vítima",
    "autoridade": "Autoridade Requisitante",
}

FUZZY_THRESHOLD = 80
HEADER_PAGE_LIMIT = 2


def detect_variables(lines: list[PdfLine]) -> list[TemplateVariable]:
    seen_keys: set[str] = set()
    variables: list[TemplateVariable] = []

    for line in lines:
        if line.page >= HEADER_PAGE_LIMIT:
            continue
        match = LABEL_VALUE_RE.match(line.text)
        if not match:
            continue
        raw_label = match.group(1).strip()
        norm_label = normalize_for_match(raw_label)

        best = process.extractOne(
            norm_label, KNOWN_VARIABLES.keys(), scorer=fuzz.ratio, score_cutoff=FUZZY_THRESHOLD
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
            )
        )

    return variables
