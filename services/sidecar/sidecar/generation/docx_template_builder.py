from pathlib import Path

from docx import Document

from sidecar.generation.context_keys import image_key, section_key
from sidecar.models.template import Template


def build_skeleton(template: Template, output_path: Path) -> Path:
    """Build an app-controlled DOCX skeleton with docxtpl/Jinja2 tags, derived
    from a confirmed Template. This is generated once per Template (at confirm
    time) and reused as the render source for every row of every batch under
    that template."""

    doc = Document()
    doc.add_heading("LAUDO PERICIAL", level=0)

    if template.variables:
        table = doc.add_table(rows=0, cols=2)
        table.style = "Table Grid"
        for var in template.variables:
            cells = table.add_row().cells
            cells[0].text = var.label
            cells[1].text = "{{ " + var.key + " }}"
        doc.add_paragraph("")

    for section in sorted(template.sections, key=lambda s: s.order):
        doc.add_heading(section.label, level=1)
        doc.add_paragraph("{{ " + section_key(section) + " }}")

    if template.image_placeholders:
        doc.add_heading("Imagens", level=1)
        for placeholder in sorted(template.image_placeholders, key=lambda p: p.order):
            doc.add_paragraph(placeholder.label)
            doc.add_paragraph("{{ " + image_key(placeholder) + " }}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    return output_path
