from collections import defaultdict
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.shared import Cm, Mm, Pt

from sidecar.generation.context_keys import caption_key, image_key, section_key
from sidecar.models.template import Template, TemplateImagePlaceholder

_CONTENT_WIDTH = Mm(210) - Cm(2.0) - Cm(2.0)  # A4 minus left+right margins


def _apply_global_style(doc: Document) -> None:
    # "Normal" base style: Arial 12pt, 1.5 spacing, first-line indent 1.25cm, justified
    # All paragraph styles inherit from Normal, so this cascades automatically.
    try:
        normal = doc.styles["Normal"]
        normal.font.name = "Arial"
        normal.font.size = Pt(12)
        pf = normal.paragraph_format
        pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        pf.line_spacing = 1.5
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.first_line_indent = Cm(1.25)
    except KeyError:
        pass
    # Headings: same font but no first-line indent
    for style_name in ("Heading 1", "Heading 2", "Heading 3"):
        try:
            style = doc.styles[style_name]
            style.font.name = "Arial"
            style.font.size = Pt(12)
            pf = style.paragraph_format
            pf.first_line_indent = Pt(0)
            pf.space_before = Pt(18)
            pf.space_after = Pt(6)
        except KeyError:
            pass


def _setup_page(doc: Document) -> None:
    sec = doc.sections[0]
    sec.page_height = Mm(297)
    sec.page_width = Mm(210)
    sec.left_margin = Cm(2.0)
    sec.right_margin = Cm(2.0)
    sec.top_margin = Cm(2.8)    # body starts 2.8cm from top (below 3-col header)
    sec.bottom_margin = Cm(2.0)
    sec.header_distance = Cm(0.43)  # header starts 0.43cm from top edge
    sec.footer_distance = Cm(1.0)


def _add_header_image(doc: Document, image_path: str) -> None:
    sec = doc.sections[0]
    header = sec.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # Extend into left margin so the image spans the full A4 page width
    p.paragraph_format.left_indent = -sec.left_margin
    p.paragraph_format.right_indent = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run()
    run.add_picture(image_path, width=sec.page_width)  # full A4 width (210mm)


def _add_footer_image(doc: Document, image_path: str) -> None:
    sec = doc.sections[0]
    footer = sec.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = -sec.left_margin
    p.paragraph_format.right_indent = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run()
    run.add_picture(image_path, width=sec.page_width)  # full A4 width (210mm)


def _heading_para(doc: Document, text: str, order: int = -1) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.first_line_indent = Pt(0)
    label = f"{order + 1}.  {text.upper()}" if order >= 0 else text.upper()
    run = p.add_run(label)
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(12)


def _body_para(doc: Document, text: str) -> None:
    p = doc.add_paragraph(text)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.first_line_indent = Cm(1.25)
    for run in p.runs:
        run.font.name = "Arial"
        run.font.size = Pt(12)


def _add_image_placeholder(doc: Document, placeholder: TemplateImagePlaceholder) -> None:
    caption = doc.add_paragraph()
    caption.paragraph_format.space_before = Pt(12)
    caption.paragraph_format.space_after = Pt(4)
    caption.paragraph_format.first_line_indent = Pt(0)
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = caption.add_run("{{ " + caption_key(placeholder) + " }}")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(11)
    img_para = doc.add_paragraph("{{ " + image_key(placeholder) + " }}")
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.paragraph_format.first_line_indent = Pt(0)
    img_para.paragraph_format.space_after = Pt(12)


def build_skeleton(template: Template, output_path: Path) -> Path:
    doc = Document()
    _apply_global_style(doc)
    _setup_page(doc)

    if template.header_image_path:
        _add_header_image(doc, template.header_image_path)

    if template.footer_image_path:
        _add_footer_image(doc, template.footer_image_path)

    # Group image placeholders by section_id; images without section_id go at the end
    images_by_section: dict[str, list[TemplateImagePlaceholder]] = defaultdict(list)
    orphan_images: list[TemplateImagePlaceholder] = []
    for p in sorted(template.image_placeholders, key=lambda p: p.order):
        if p.section_id:
            images_by_section[p.section_id].append(p)
        else:
            orphan_images.append(p)

    for section in sorted(template.sections, key=lambda s: s.order):
        _heading_para(doc, section.label, section.order)
        _body_para(doc, "{{ " + section_key(section) + " }}")
        for placeholder in images_by_section.get(section.id, []):
            _add_image_placeholder(doc, placeholder)

    # Orphan placeholders (no section_id) appended at the end
    for placeholder in orphan_images:
        _add_image_placeholder(doc, placeholder)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    return output_path
