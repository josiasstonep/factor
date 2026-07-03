import re
from dataclasses import dataclass
from pathlib import Path

from sidecar.models.template import TemplateImagePlaceholder, TemplateSection, TemplateVariable
from sidecar.parsing import pdf_extract
from sidecar.parsing.image_detect import detect_images
from sidecar.parsing.section_detect import detect_sections
from sidecar.parsing.variable_detect import detect_variables


class PdfHasNoTextLayerError(Exception):
    """Raised when the PDF appears to be a scanned image with no extractable text."""


@dataclass
class ParsedStructure:
    sections: list[TemplateSection]
    variables: list[TemplateVariable]
    image_placeholders: list[TemplateImagePlaceholder]


def _filter_repeating_lines(lines: list[pdf_extract.PdfLine], max_pages: int = 2) -> list[pdf_extract.PdfLine]:
    """Drop lines whose exact text appears on more than max_pages distinct pages.
    These are repeating headers/footers (e.g. institutional letterhead)."""
    from collections import defaultdict
    page_sets: dict[str, set[int]] = defaultdict(set)
    for line in lines:
        page_sets[line.text.strip()].add(line.page)
    repeated = {text for text, pages in page_sets.items() if len(pages) > max_pages}
    return [ln for ln in lines if ln.text.strip() not in repeated]


def _inject_placeholders(
    sections: list[TemplateSection],
    variables: list[TemplateVariable],
) -> None:
    """Replace detected variable values inside section default_texts with {{key}}.

    Only variables where source_value_detected is long enough to be unambiguous
    are substituted — short values like "Apple" risk false-positive replacements."""
    for section in sections:
        if not section.default_text:
            continue
        text = section.default_text
        for var in variables:
            val = (var.source_value_detected or "").strip()
            if len(val) < 6:
                continue
            # Match value with any whitespace between tokens (PDF extraction often
            # inserts newlines mid-value)
            escaped = re.escape(val)
            pattern = re.sub(r"\\ ", r"\\s+", escaped)
            text = re.sub(pattern, f"{{{{{var.key}}}}}", text)
        section.default_text = text


_STANDARD_FORENSIC_VARS: list[tuple[str, str]] = [
    ("modelo",      "Modelo"),
    ("imei1",       "IMEI 1"),
    ("imei2",       "IMEI 2"),
    ("nome_perito", "Nome do Perito"),
]


def _merge_standard_vars(variables: list[TemplateVariable]) -> list[TemplateVariable]:
    """Append standard forensic variables that are not already detected."""
    existing_keys = {v.key for v in variables}
    for key, label in _STANDARD_FORENSIC_VARS:
        if key not in existing_keys:
            variables.append(TemplateVariable(
                id=str(__import__("uuid").uuid4()),
                key=key,
                label=label,
                source_label_detected=None,
                source_value_detected=None,
            ))
    return variables


def parse_pdf(pdf_path: Path) -> ParsedStructure:
    extraction = pdf_extract.extract(pdf_path)

    if not extraction.has_text_layer:
        raise PdfHasNoTextLayerError(
            "PDF sem texto selecionável (provavelmente escaneado). "
            "OCR não é suportado nesta versão — use um PDF com texto extraível."
        )

    clean_lines = _filter_repeating_lines(extraction.lines)

    sections = detect_sections(clean_lines)
    variables = detect_variables(clean_lines)
    variables = _merge_standard_vars(variables)
    image_placeholders = detect_images(extraction.images, clean_lines)

    _inject_placeholders(sections, variables)

    return ParsedStructure(
        sections=sections,
        variables=variables,
        image_placeholders=image_placeholders,
    )
