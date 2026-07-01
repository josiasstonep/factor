from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.shared import Cm, Mm, Pt

from sidecar.generation.context_keys import image_key, section_key
from sidecar.models.template import Template

_CONTENT_WIDTH = Mm(210) - Cm(3.0) - Cm(2.0)  # A4 minus margins


def _apply_global_style(doc: Document) -> None:
    for style_name in ("Normal", "Body Text", "Heading 1", "Heading 2", "Heading 3"):
        try:
            style = doc.styles[style_name]
            style.font.name = "Arial"
            style.font.size = Pt(12)
            pf = style.paragraph_format
            pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
            pf.line_spacing = 1.5
            pf.space_before = Pt(0)
            pf.space_after = Pt(6)
        except KeyError:
            pass


def _setup_page(doc: Document) -> None:
    sec = doc.sections[0]
    sec.page_height = Mm(297)
    sec.page_width = Mm(210)
    sec.left_margin = Cm(3.0)
    sec.right_margin = Cm(2.0)
    sec.top_margin = Cm(3.0)
    sec.bottom_margin = Cm(2.5)
    sec.header_distance = Cm(1.0)
    sec.footer_distance = Cm(1.0)


def _add_header_image(doc: Document, image_path: str) -> None:
    sec = doc.sections[0]
    header = sec.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(image_path, width=_CONTENT_WIDTH)


def _add_footer_image(doc: Document, image_path: str) -> None:
    sec = doc.sections[0]
    footer = sec.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(image_path, width=_CONTENT_WIDTH)


def _heading_para(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = 1.5
    run = p.add_run(text.upper())
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(12)


def _body_para(doc: Document, text: str) -> None:
    p = doc.add_paragraph(text)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    for run in p.runs:
        run.font.name = "Arial"
        run.font.size = Pt(12)


def build_skeleton(template: Template, output_path: Path) -> Path:
    doc = Document()
    _apply_global_style(doc)
    _setup_page(doc)

    if template.header_image_path:
        _add_header_image(doc, template.header_image_path)

    if template.footer_image_path:
        _add_footer_image(doc, template.footer_image_path)

    # Identification variables table
    if template.variables:
        table = doc.add_table(rows=0, cols=2)
        table.style = "Table Grid"
        for var in template.variables:
            cells = table.add_row().cells
            label_run = cells[0].paragraphs[0].add_run(var.label)
            label_run.bold = True
            label_run.font.name = "Arial"
            label_run.font.size = Pt(12)
            value_run = cells[1].paragraphs[0].add_run("{{ " + var.key + " }}")
            value_run.font.name = "Arial"
            value_run.font.size = Pt(12)
        doc.add_paragraph()

    # Sections — start from HISTÓRICO (no leading title heading)
    for section in sorted(template.sections, key=lambda s: s.order):
        _heading_para(doc, section.label)
        _body_para(doc, "{{ " + section_key(section) + " }}")

    # Image placeholders inline within document flow
    for placeholder in sorted(template.image_placeholders, key=lambda p: p.order):
        caption = doc.add_paragraph()
        caption.paragraph_format.space_before = Pt(12)
        r = caption.add_run(placeholder.label)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(10)
        _body_para(doc, "{{ " + image_key(placeholder) + " }}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    return output_path
