from uuid import uuid4

from rapidfuzz import fuzz

from sidecar.models.template import ImagePlaceholderType, TemplateImagePlaceholder
from sidecar.parsing.pdf_extract import PdfImage, PdfLine
from sidecar.parsing.text_utils import normalize_for_match, title_case_label

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
