"""Shared Jinja2/docxtpl context-key helpers, used by both DOCX rendering and
HTML preview rendering so the two stay in sync (see preview_render.py)."""

from sidecar.models.template import TemplateImagePlaceholder, TemplateSection


def section_key(section: TemplateSection) -> str:
    return f"section_{section.id.replace('-', '_')}"


def image_key(placeholder: TemplateImagePlaceholder) -> str:
    return f"image_{placeholder.id.replace('-', '_')}"


def caption_key(placeholder: TemplateImagePlaceholder) -> str:
    return f"caption_{placeholder.id.replace('-', '_')}"
