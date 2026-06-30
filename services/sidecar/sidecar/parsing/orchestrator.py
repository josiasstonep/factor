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


def parse_pdf(pdf_path: Path) -> ParsedStructure:
    extraction = pdf_extract.extract(pdf_path)

    if not extraction.has_text_layer:
        raise PdfHasNoTextLayerError(
            "PDF sem texto selecionável (provavelmente escaneado). "
            "OCR não é suportado nesta versão — use um PDF com texto extraível."
        )

    sections = detect_sections(extraction.lines)
    variables = detect_variables(extraction.lines)
    image_placeholders = detect_images(extraction.images, extraction.lines)

    return ParsedStructure(
        sections=sections,
        variables=variables,
        image_placeholders=image_placeholders,
    )
