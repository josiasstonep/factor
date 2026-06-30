from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReportInputVariableValue(BaseModel):
    variable_id: str
    value: str


class ReportInputSectionText(BaseModel):
    section_id: str
    text: str


class ReportInputImage(BaseModel):
    placeholder_id: str
    file_path: str
    order: int = 0


class ReportInput(BaseModel):
    id: str
    batch_id: str
    template_id: str
    row_label: str
    variables: list[ReportInputVariableValue] = Field(default_factory=list)
    sections: list[ReportInputSectionText] = Field(default_factory=list)
    images: list[ReportInputImage] = Field(default_factory=list)
    created_at: datetime


class ReportInputCreate(BaseModel):
    template_id: str
    batch_id: Optional[str] = None
    row_label: str
    variables: list[ReportInputVariableValue] = Field(default_factory=list)
    sections: list[ReportInputSectionText] = Field(default_factory=list)
    images: list[ReportInputImage] = Field(default_factory=list)
