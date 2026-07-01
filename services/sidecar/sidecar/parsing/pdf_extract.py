from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF


@dataclass
class PdfLine:
    page: int
    text: str
    size: float
    bold: bool
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1
    block_start: bool = False  # True for the first line of each PDF block (= paragraph boundary)


@dataclass
class PdfImage:
    page: int
    bbox: tuple[float, float, float, float]
    xref: int


@dataclass
class PdfExtraction:
    lines: list[PdfLine] = field(default_factory=list)
    images: list[PdfImage] = field(default_factory=list)
    has_text_layer: bool = True
    page_count: int = 0


def _is_bold(span: dict) -> bool:
    flags = span.get("flags", 0)
    font = span.get("font", "").lower()
    return bool(flags & 2**4) or "bold" in font


def extract(pdf_path: Path) -> PdfExtraction:
    doc = fitz.open(pdf_path)
    result = PdfExtraction(page_count=doc.page_count)
    total_chars = 0

    for page_index in range(doc.page_count):
        page = doc[page_index]
        page_dict = page.get_text("dict")

        for block in page_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            block_lines = block.get("lines", [])
            for line_idx, line in enumerate(block_lines):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = "".join(s.get("text", "") for s in spans).strip()
                if not text:
                    continue
                total_chars += len(text)
                # represent the line by its dominant (largest) span for size/bold
                dominant = max(spans, key=lambda s: s.get("size", 0))
                x0 = min(s["bbox"][0] for s in spans)
                y0 = min(s["bbox"][1] for s in spans)
                x1 = max(s["bbox"][2] for s in spans)
                y1 = max(s["bbox"][3] for s in spans)
                result.lines.append(
                    PdfLine(
                        page=page_index,
                        text=text,
                        size=round(dominant.get("size", 0.0), 1),
                        bold=_is_bold(dominant),
                        bbox=(x0, y0, x1, y1),
                        block_start=line_idx == 0,
                    )
                )

        for img in page.get_images(full=True):
            xref = img[0]
            try:
                rects = page.get_image_rects(xref)
            except Exception:
                rects = []
            for rect in rects:
                result.images.append(
                    PdfImage(page=page_index, bbox=(rect.x0, rect.y0, rect.x1, rect.y1), xref=xref)
                )

    result.has_text_layer = total_chars > 0
    doc.close()
    return result
