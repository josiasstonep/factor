from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.shared import Cm, Mm, Pt
from docxtpl import DocxTemplate, InlineImage

from sidecar.generation.context_keys import image_key, section_key
from sidecar.models.report_input import ReportInput
from sidecar.models.template import Template

# Opening/closing quote chars built with chr() to avoid smart-quote encoding issues in source file
_Q_OPEN = {chr(0x201C), chr(0x201E), chr(0xAB), chr(0x201A), chr(0x22)}   # “ „ « ‚ “
_Q_CLOSE = {chr(0x201D), chr(0xBB), chr(0x2019), chr(0x22)}  # “ » ‘ “
_ELLIPSIS_BRACKET = chr(91) + chr(46) * 3 + chr(93)  # “[...]”


def _sanitize_text(text: str) -> str:
    """Remove characters that are invalid in XML/DOCX:
    - Lone surrogates (U+D800..U+DFFF) from corrupt PDF encoding
    - Soft hyphens (U+00AD) that end up as literal text instead of formatting hints
    """
    cleaned = []
    for ch in text:
        cp = ord(ch)
        if 0xD800 <= cp <= 0xDFFF:
            # Replace lone surrogate with the right double quote (its likely intended value)
            if cp == 0xDC9D:
                cleaned.append(chr(0x201D))  # RIGHT DOUBLE QUOTATION MARK
            # else drop it
        elif cp == 0x00AD:
            pass  # strip soft hyphens — they become literal text in DOCX
        else:
            cleaned.append(ch)
    return "".join(cleaned)


def _resolve_inline_vars(text: str, var_context: dict[str, str]) -> str:
    """Substitute {{key}} placeholders inside section text with actual variable values."""
    for key, value in var_context.items():
        text = text.replace(f"{{{{{key}}}}}", value)
    return text


def build_render_context(
    template: Template,
    report_input: ReportInput,
    section_overrides: dict[str, str] | None = None,
) -> dict[str, str]:
    """Builds the Jinja2 context dict shared by DOCX rendering and HTML
    preview, so both always reflect the same underlying data."""

    context: dict[str, str] = {}

    var_context: dict[str, str] = {}
    for var in template.variables:
        value = next((v.value for v in report_input.variables if v.variable_id == var.id), "")
        context[var.key] = value
        var_context[var.key] = value

    for section in template.sections:
        text = next((s.text for s in report_input.sections if s.section_id == section.id), "")
        if section_overrides and section.id in section_overrides:
            text = section_overrides[section.id]
        resolved = _resolve_inline_vars(_sanitize_text(text), var_context)
        # \a is docxtpl's soft line-break within a paragraph
        context[section_key(section)] = resolved.replace("\n", "\a")

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
    _postprocess_paragraphs(output_path)
    return output_path


def _is_quote_start(text: str) -> bool:
    return bool(text) and text[0] in _Q_OPEN


def _is_quote_end(text: str) -> bool:
    if not text:
        return False
    stripped = text.rstrip()
    # Last non-space char is a closing quote
    if stripped and stripped[-1] in _Q_CLOSE:
        return True
    # Ends with "[...]" (Brazilian legal truncation marker) optionally followed by 1-2 chars
    return stripped.endswith(_ELLIPSIS_BRACKET) or _ELLIPSIS_BRACKET in stripped[-8:]


def _postprocess_paragraphs(docx_path: Path) -> None:
    """Apply formatting that docxtpl cannot control per-paragraph.

    Block quotes (paragraphs starting with an opening curly quote and ending
    with a closing quote or Brazilian "[...]" truncation marker) get a left
    indent so they visually match the indented quote blocks in the source PDF.
    """
    doc = Document(str(docx_path))
    in_quote = False

    for p in doc.paragraphs:
        text = p.text.strip()

        if not in_quote and _is_quote_start(text):
            in_quote = True

        if in_quote:
            p.paragraph_format.left_indent = Cm(3.0)
            p.paragraph_format.right_indent = Cm(1.0)
            p.paragraph_format.first_line_indent = Pt(0)
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

            if _is_quote_end(text):
                in_quote = False

    doc.save(str(docx_path))
