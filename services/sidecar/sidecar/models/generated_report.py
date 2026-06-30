from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SectionDiffOp(BaseModel):
    op: Literal["equal", "insert", "delete", "replace"]
    original: str
    revised: str


class GeneratedSection(BaseModel):
    section_id: str
    original_text: str
    ai_text: Optional[str] = None
    diff: Optional[list[SectionDiffOp]] = None
    accepted: bool = False
    ai_provider_used: Optional[str] = None


class GeneratedReport(BaseModel):
    id: str
    batch_id: str
    report_input_id: str
    template_id: str
    docx_path: str
    sections: list[GeneratedSection] = Field(default_factory=list)
    status: Literal["generated", "ai_pending", "ai_reviewed", "exported"] = "generated"
    generated_at: datetime
