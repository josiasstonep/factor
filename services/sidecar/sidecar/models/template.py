from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SectionType(str, Enum):
    HISTORIA = "historia"
    DESCRICAO = "descricao"
    ANALISE = "analise"
    CONCLUSAO = "conclusao"
    CUSTOM = "custom"


class TemplateSection(BaseModel):
    id: str
    type: SectionType
    label: str
    order: int
    heading_text: Optional[str] = None
    is_ai_improvable: bool = True
    default_text: Optional[str] = None


class TemplateVariable(BaseModel):
    id: str
    key: str
    label: str
    source_label_detected: Optional[str] = None
    source_value_detected: Optional[str] = None  # actual value found in PDF (for placeholder injection)
    required: bool = True
    value_type: Literal["text", "date", "number"] = "text"


class ImagePlaceholderType(str, Enum):
    VESTIGIO = "vestigio"
    LOCAL_CRIME = "local_crime"
    CUSTOM = "custom"


class TemplateImagePlaceholder(BaseModel):
    id: str
    type: ImagePlaceholderType
    label: str
    order: int
    max_count: int = 1
    page_hint: Optional[int] = None
    section_id: Optional[str] = None  # section this image belongs to; None = orphan (appended at end)
    preview_image_path: Optional[str] = None  # image extracted from the source PDF for reference


class Template(BaseModel):
    id: str
    name: str
    created_at: datetime
    source_pdf_filename: str
    status: Literal["draft_parsed", "confirmed"] = "draft_parsed"
    sections: list[TemplateSection] = Field(default_factory=list)
    variables: list[TemplateVariable] = Field(default_factory=list)
    image_placeholders: list[TemplateImagePlaceholder] = Field(default_factory=list)
    docx_skeleton_path: Optional[str] = None
    header_image_path: Optional[str] = None
    footer_image_path: Optional[str] = None


class TemplateUpdate(BaseModel):
    """Payload for confirming/correcting a parsed template (PUT /templates/{id})."""

    name: str
    sections: list[TemplateSection]
    variables: list[TemplateVariable]
    image_placeholders: list[TemplateImagePlaceholder]
    confirm: bool = False
    header_image_path: Optional[str] = None
    footer_image_path: Optional[str] = None
