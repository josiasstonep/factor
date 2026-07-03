import re
import shutil
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from sidecar import repo
from sidecar.config import TEMPLATES_DIR, UPLOADS_DIR
from sidecar.generation.docx_template_builder import build_skeleton
from sidecar.models.template import Template, TemplateUpdate, TemplateVariable
from sidecar.parsing.header_footer_extract import extract_header_footer
from sidecar.parsing.image_detect import detect_figures_from_text
from sidecar.parsing.orchestrator import PdfHasNoTextLayerError, _merge_standard_vars, parse_pdf

_REP_FROM_FILENAME = re.compile(r'\bREP[\s_-]?(\d{4,6})[_/\\-](\d{2,4})\b', re.IGNORECASE)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("/parse", response_model=Template)
async def parse_template(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Envie um arquivo PDF (.pdf).")

    template_id = str(uuid4())
    pdf_path = UPLOADS_DIR / f"{template_id}.pdf"
    with pdf_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        parsed = parse_pdf(pdf_path)
    except PdfHasNoTextLayerError as exc:
        raise HTTPException(422, str(exc)) from exc

    variables = parsed.variables

    # Inject REP number from filename if not already detected in body text
    if not any(v.key == "rep" for v in variables):
        m = _REP_FROM_FILENAME.search(file.filename)
        if m:
            rep_value = f"{m.group(1)}/{m.group(2)}"
            variables.insert(0, TemplateVariable(
                id=str(uuid4()),
                key="rep",
                label="Número da REP",
                source_label_detected=None,
                source_value_detected=rep_value,
            ))

    # Detect "Figura XX – caption" references in section text and extract preview images
    if not parsed.image_placeholders:
        try:
            parsed.image_placeholders = detect_figures_from_text(
                parsed.sections, pdf_path, TEMPLATES_DIR, template_id
            )
        except Exception:
            pass  # figure detection is best-effort

    header_image_path, footer_image_path = extract_header_footer(pdf_path, UPLOADS_DIR)

    template = Template(
        id=template_id,
        name=file.filename.rsplit(".", 1)[0],
        created_at=datetime.now(timezone.utc),
        source_pdf_filename=file.filename,
        status="draft_parsed",
        sections=parsed.sections,
        variables=variables,
        image_placeholders=parsed.image_placeholders,
        header_image_path=header_image_path,
        footer_image_path=footer_image_path,
    )
    repo.save_template(template)
    return template


@router.get("", response_model=list[Template])
async def list_templates():
    return repo.list_templates()


@router.get("/{template_id}", response_model=Template)
async def get_template(template_id: str):
    template = repo.get_template(template_id)
    if not template:
        raise HTTPException(404, "Template não encontrado.")
    return template


@router.put("/{template_id}", response_model=Template)
async def update_template(template_id: str, update: TemplateUpdate):
    existing = repo.get_template(template_id)
    if not existing:
        raise HTTPException(404, "Template não encontrado.")

    existing.name = update.name
    existing.sections = update.sections
    existing.variables = update.variables
    existing.image_placeholders = update.image_placeholders
    existing.header_image_path = update.header_image_path
    existing.footer_image_path = update.footer_image_path

    if update.confirm:
        if not existing.sections:
            raise HTTPException(400, "Confirme ao menos uma seção antes de finalizar o template.")
        existing.variables = _merge_standard_vars(existing.variables)
        skeleton_path = TEMPLATES_DIR / f"{existing.id}_skeleton.docx"
        build_skeleton(existing, skeleton_path)
        existing.docx_skeleton_path = str(skeleton_path)
        existing.status = "confirmed"

    repo.save_template(existing)
    return existing


@router.post("/ensure-standard-vars", response_model=list[str])
async def ensure_standard_vars():
    """Apply standard forensic variables to every confirmed template that is missing them."""
    from sidecar import repo as _repo
    fixed = []
    for t in _repo.list_templates():
        if t.status != "confirmed":
            continue
        before = {v.key for v in t.variables}
        t.variables = _merge_standard_vars(t.variables)
        if {v.key for v in t.variables} != before:
            _repo.save_template(t)
            fixed.append(t.id)
    return fixed


class RenamePayload(BaseModel):
    name: str


@router.patch("/{template_id}/rename", response_model=Template)
async def rename_template(template_id: str, payload: RenamePayload):
    existing = repo.get_template(template_id)
    if not existing:
        raise HTTPException(404, "Template não encontrado.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nome não pode ser vazio.")
    existing.name = name
    repo.save_template(existing)
    return existing


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str):
    deleted = repo.delete_template(template_id)
    if not deleted:
        raise HTTPException(404, "Template não encontrado.")
