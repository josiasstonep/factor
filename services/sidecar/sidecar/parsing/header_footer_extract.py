"""Extract header and footer regions from a PDF's first page as PNG images.

Uses PyMuPDF to render the top (header) and bottom (footer) strips of page 1
at 2× zoom so the images look sharp inside the generated Word document.
"""
from pathlib import Path

import fitz  # PyMuPDF


# Fraction of page height used as header / footer strips
_HEADER_FRACTION = 0.11
_FOOTER_FRACTION = 0.09

# Render zoom factor (2 = ~192 DPI for a 96-DPI base)
_ZOOM = 2.0
_MATRIX = fitz.Matrix(_ZOOM, _ZOOM)

# A strip is "blank" if more than this fraction of sampled pixels are near-white
_BLANK_THRESHOLD = 0.96


def _is_mostly_white(pix: fitz.Pixmap) -> bool:
    """Return True when the pixmap is nearly all white (empty region)."""
    samples = pix.samples  # raw bytes: R G B [A] per pixel
    n = pix.n             # bytes per pixel
    total = 0
    white = 0
    # Sample at most 800 pixels evenly across the pixmap
    step = max(1, (len(samples) // n) // 800)
    for i in range(0, len(samples) - n + 1, n * step):
        r, g, b = samples[i], samples[i + 1], samples[i + 2]
        total += 1
        if r > 238 and g > 238 and b > 238:
            white += 1
    return (white / total) > _BLANK_THRESHOLD if total else True


def extract_header_footer(
    pdf_path: Path, output_dir: Path
) -> tuple[str | None, str | None]:
    """Render the header and footer strips from page 0 of *pdf_path*.

    Saves the results as PNG files under *output_dir/images/* and returns
    ``(header_image_path, footer_image_path)``.  Either value is ``None``
    when the corresponding strip appears blank or cannot be rendered.
    """
    doc = fitz.open(str(pdf_path))
    try:
        if not doc.page_count:
            return None, None

        page = doc[0]
        pw, ph = page.rect.width, page.rect.height

        images_dir = output_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        stem = pdf_path.stem

        header_path: str | None = None
        footer_path: str | None = None

        # ── Header strip ────────────────────────────────────────────────────
        h_clip = fitz.Rect(0, 0, pw, ph * _HEADER_FRACTION)
        h_pix = page.get_pixmap(matrix=_MATRIX, clip=h_clip, colorspace=fitz.csRGB)
        if not _is_mostly_white(h_pix):
            p = images_dir / f"{stem}_header.png"
            h_pix.save(str(p))
            header_path = str(p)

        # ── Footer strip ────────────────────────────────────────────────────
        f_clip = fitz.Rect(0, ph * (1 - _FOOTER_FRACTION), pw, ph)
        f_pix = page.get_pixmap(matrix=_MATRIX, clip=f_clip, colorspace=fitz.csRGB)
        if not _is_mostly_white(f_pix):
            p = images_dir / f"{stem}_footer.png"
            f_pix.save(str(p))
            footer_path = str(p)

        return header_path, footer_path
    finally:
        doc.close()
