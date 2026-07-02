import re
from pathlib import Path
from uuid import uuid4

from rapidfuzz import fuzz

from sidecar.models.template import ImagePlaceholderType, TemplateImagePlaceholder, TemplateSection
from sidecar.parsing.pdf_extract import PdfImage, PdfLine
from sidecar.parsing.text_utils import normalize_for_match, title_case_label

_FIGURE_RE = re.compile(r'Figura\s+(\d{1,2})\s*[–—\-]\s*([^\n]+)')

IMAGE_KEYWORDS: dict[ImagePlaceholderType, list[str]] = {
    ImagePlaceholderType.VESTIGIO: ["vestigio", "objeto", "material apreendido", "evidencia"],
    ImagePlaceholderType.LOCAL_CRIME: ["local do crime", "local", "cena", "ambiente"],
}

FUZZY_THRESHOLD = 75
CAPTION_MAX_DISTANCE = 40.0  # pt, vertical distance to consider a line a caption


def _nearest_caption(image: PdfImage, lines: list[PdfLine]) -> PdfLine | None:
    candidates = [l for l in lines if l.page == image.page]
    best: PdfLine | None = None
    best_dist = CAPTION_MAX_DISTANCE
    for line in candidates:
        # caption above the image: line bottom (y1) close to image top (y0)
        dist_above = image.bbox[1] - line.bbox[3]
        # caption below the image: line top (y0) close to image bottom (y1)
        dist_below = line.bbox[1] - image.bbox[3]
        dist = min(d for d in (dist_above, dist_below) if d >= 0) if (dist_above >= 0 or dist_below >= 0) else None
        if dist is not None and dist < best_dist:
            best_dist = dist
            best = line
    return best


def _classify(text: str) -> ImagePlaceholderType:
    norm = normalize_for_match(text)
    best_type = ImagePlaceholderType.CUSTOM
    best_score = 0.0
    for img_type, keywords in IMAGE_KEYWORDS.items():
        for kw in keywords:
            score = fuzz.partial_ratio(norm, kw)
            if score > best_score:
                best_score = score
                best_type = img_type
    return best_type if best_score >= FUZZY_THRESHOLD else ImagePlaceholderType.CUSTOM


def _build_section_page_map(sections: list[TemplateSection], doc) -> list[tuple[int, float, str]]:
    """Return (page_idx, y_top, section_id) for each section heading found in the PDF.

    Uses Y position so that a figure caption and a section heading on the same page
    are ordered correctly (figure is in the section whose heading is above it).
    """
    starts: list[tuple[int, float, str]] = []
    for page_idx in range(len(doc)):
        blocks = doc[page_idx].get_text("blocks")
        page_text = doc[page_idx].get_text().replace("\xad", "")
        for section in sections:
            heading = (section.heading_text or "").strip().replace("\xad", "")
            if not heading or heading not in page_text:
                continue
            y = 0.0
            for b in blocks:
                if b[6] == 0:
                    btext = b[4].replace("\xad", "").strip()
                    if heading in btext or btext in heading:
                        y = float(b[1])
                        break
            starts.append((page_idx, y, section.id))
    return sorted(starts, key=lambda x: (x[0], x[1]))


def _section_for_position(page_num: int, y_pos: float, section_starts: list[tuple[int, float, str]]) -> str | None:
    """Return the section whose heading appears last before (page_num, y_pos) in reading order."""
    result = None
    for p, y, sid in section_starts:
        if p < page_num or (p == page_num and y < y_pos):
            result = sid
    return result


def detect_figures_from_text(
    sections: list[TemplateSection],
    pdf_path: Path,
    output_dir: Path,
    template_id: str,
) -> list[TemplateImagePlaceholder]:
    """Detect 'Figura XX – caption' patterns and create image placeholders.

    Scans section texts first (reliable section assignment), then scans all PDF
    page text to catch figures whose captions don't appear in section body text
    (e.g. Figura 01 whose caption sits below an embedded photo, not in prose).
    """
    import fitz  # PyMuPDF — optional dependency guard

    doc = fitz.open(str(pdf_path))
    # fig_num -> (section_id, caption, preview_path)
    found: dict[str, tuple[str | None, str, Path | None]] = {}

    # Pass 1: section default_text — reliable section_id
    for section in sections:
        for m in _FIGURE_RE.finditer(section.default_text or ""):
            fig_num = m.group(1).zfill(2)
            if fig_num in found:
                continue
            caption = f"Figura {fig_num} - {m.group(2).strip()}"
            preview_path = _render_figure_region(doc, fig_num, output_dir, template_id)
            found[fig_num] = (section.id, caption, preview_path)

    # Pass 2: full PDF page text — catches captions below embedded images
    section_starts = _build_section_page_map(sections, doc)
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_text = page.get_text()
        blocks = page.get_text("blocks")
        for m in _FIGURE_RE.finditer(page_text):
            fig_num = m.group(1).zfill(2)
            if fig_num in found:
                continue
            # Find Y position of this caption block for accurate section assignment
            caption_y = 9999.0
            fig_needle = f"Figura {m.group(1)}"
            for b in blocks:
                if b[6] == 0 and fig_needle in b[4]:
                    caption_y = float(b[1])
                    break
            caption = f"Figura {fig_num} - {m.group(2).strip()}"
            section_id = _section_for_position(page_idx, caption_y, section_starts)
            preview_path = _render_figure_region(doc, fig_num, output_dir, template_id)
            found[fig_num] = (section_id, caption, preview_path)

    doc.close()
    return sorted(
        [
            TemplateImagePlaceholder(
                id=str(uuid4()),
                type=ImagePlaceholderType.CUSTOM,
                label=caption,
                order=int(fig_num),
                max_count=1,
                section_id=section_id,
                preview_image_path=str(preview_path) if preview_path else None,
            )
            for fig_num, (section_id, caption, preview_path) in found.items()
        ],
        key=lambda p: p.order,
    )


def _render_figure_region(doc, fig_num_str: str, output_dir: Path, template_id: str) -> Path | None:
    needle = f"Figura {fig_num_str}"
    for page in doc:
        blocks = sorted(page.get_text("blocks"), key=lambda b: b[1])
        caption_y = None
        for b in blocks:
            if b[6] == 0 and b[4].lstrip().startswith(needle):
                caption_y = b[1]
                break
        if caption_y is None:
            continue
        prev_bottom = max((b[3] for b in blocks if b[6] == 0 and b[3] < caption_y - 5), default=0)
        if caption_y - prev_bottom < 20:
            continue
        import fitz
        rect = fitz.Rect(50, prev_bottom + 2, 550, caption_y - 2)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect)
        out_path = output_dir / f"{template_id}_figure_{fig_num_str}.png"
        pix.save(str(out_path))
        return out_path
    return None


def detect_images(images: list[PdfImage], lines: list[PdfLine]) -> list[TemplateImagePlaceholder]:
    placeholders: list[TemplateImagePlaceholder] = []
    for order, image in enumerate(images):
        caption = _nearest_caption(image, lines)
        if caption:
            img_type = _classify(caption.text)
            label = title_case_label(caption.text) if img_type == ImagePlaceholderType.CUSTOM else {
                ImagePlaceholderType.VESTIGIO: "Foto de Vestígio",
                ImagePlaceholderType.LOCAL_CRIME: "Foto do Local",
            }[img_type]
        else:
            img_type = ImagePlaceholderType.CUSTOM
            label = f"Imagem {order + 1}"

        placeholders.append(
            TemplateImagePlaceholder(
                id=str(uuid4()),
                type=img_type,
                label=label,
                order=order,
                page_hint=image.page,
            )
        )
    return placeholders
