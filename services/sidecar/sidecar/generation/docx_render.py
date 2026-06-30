from pathlib import Path

from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage

from sidecar.generation.context_keys import image_key, section_key
from sidecar.models.report_input import ReportInput
from sidecar.models.template import Template


def build_render_context(
    template: Template,
    report_input: ReportInput,
    section_overrides: dict[str, str] | None = None,
) -> dict[str, str]:
    """Builds the Jinja2 context dict shared by DOCX rendering and HTML
    preview, so both always reflect the same underlying data."""

    context: dict[str, str] = {}

    for var in template.variables:
        value = next((v.value for v in report_input.variables if v.variable_id == var.id), "")
        context[var.key] = value

    for section in template.sections:
        text = next((s.text for s in report_input.sections if s.section_id == section.id), "")
        if section_overrides and section.id in section_overrides:
            text = section_overrides[section.id]
        context[section_key(section)] = text

    return context


def render_docx(
    template: Template,
    report_input: ReportInput,
    output_path: Path,
    section_overrides: dict[str, str] | None = None,
) -> Path:
    if not template.docx_skeleton_path:
        raise ValueError("Template has no docx_skeleton_path; confirm the template first.")

    tpl = DocxTemplate(template.docx_skeleton_path)
    context = build_render_context(template, report_input, section_overrides)

    for placeholder in template.image_placeholders:
        images = [img for img in report_input.images if img.placeholder_id == placeholder.id]
        if images:
            context[image_key(placeholder)] = InlineImage(tpl, images[0].file_path, width=Mm(120))
        else:
            context[image_key(placeholder)] = ""

    tpl.render(context)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tpl.save(output_path)
    return output_path
