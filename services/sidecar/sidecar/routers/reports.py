import zipfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from sidecar import repo
from sidecar.config import EXPORTS_DIR
from sidecar.generation.docx_render import render_docx
from sidecar.models.generated_report import GeneratedReport, GeneratedSection
from sidecar.models.report_input import ReportInput, ReportInputCreate

router = APIRouter(prefix="/reports", tags=["reports"])


class GenerateBatchRequest(BaseModel):
    template_id: str
    batch_name: str
    rows: list[ReportInputCreate]


class GenerateBatchResponse(BaseModel):
    batch_id: str
    reports: list[GeneratedReport]
    errors: list[dict]


@router.post("/generate", response_model=GenerateBatchResponse)
async def generate_batch(payload: GenerateBatchRequest):
    template = repo.get_template(payload.template_id)
    if not template:
        raise HTTPException(404, "Template não encontrado.")
    if template.status != "confirmed":
        raise HTTPException(400, "Confirme o template antes de gerar laudos.")
    if not payload.rows:
        raise HTTPException(400, "Informe ao menos uma linha de dados.")

    batch_id = str(uuid4())
    reports: list[GeneratedReport] = []
    errors: list[dict] = []

    for row in payload.rows:
        report_input = ReportInput(
            id=str(uuid4()),
            batch_id=batch_id,
            template_id=template.id,
            row_label=row.row_label,
            variables=row.variables,
            sections=row.sections,
            images=row.images,
            created_at=datetime.now(timezone.utc),
        )
        try:
            output_path = EXPORTS_DIR / batch_id / f"{report_input.id}.docx"
            render_docx(template, report_input, output_path)
        except Exception as exc:  # noqa: BLE001 - surface per-row, don't abort the batch
            errors.append({"row_label": row.row_label, "error": str(exc)})
            continue

        repo.save_report_input(report_input)

        generated = GeneratedReport(
            id=str(uuid4()),
            batch_id=batch_id,
            report_input_id=report_input.id,
            template_id=template.id,
            row_label=row.row_label,
            docx_path=str(output_path),
            sections=[
                GeneratedSection(
                    section_id=s.id,
                    original_text=next(
                        (rs.text for rs in report_input.sections if rs.section_id == s.id), ""
                    ),
                )
                for s in template.sections
            ],
            status="generated",
            generated_at=datetime.now(timezone.utc),
        )
        repo.save_generated_report(generated)
        reports.append(generated)

    return GenerateBatchResponse(batch_id=batch_id, reports=reports, errors=errors)


@router.get("/batch/{batch_id}", response_model=list[GeneratedReport])
async def list_batch_reports(batch_id: str):
    return repo.list_generated_reports_by_batch(batch_id)


@router.get("/{report_id}/docx")
async def download_report_docx(report_id: str):
    report = repo.get_generated_report(report_id)
    if not report:
        raise HTTPException(404, "Laudo não encontrado.")

    accepted_overrides = {
        s.section_id: s.ai_text
        for s in report.sections
        if s.accepted and s.ai_text is not None
    }

    if accepted_overrides:
        template = repo.get_template(report.template_id)
        report_input = repo.get_report_input(report.report_input_id)
        if not template or not report_input:
            raise HTTPException(500, "Dados do template ou laudo não encontrados.")
        from sidecar.generation.docx_render import render_docx
        out = Path(report.docx_path).with_suffix(".ai.docx")
        render_docx(template, report_input, out, section_overrides=accepted_overrides)
        path = out
    else:
        path = Path(report.docx_path)
        if not path.exists():
            raise HTTPException(410, "Arquivo do laudo não está mais disponível em disco.")

    label = report.row_label or report.id
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"{label}.docx",
    )


@router.get("/batch/{batch_id}/zip")
async def download_batch_zip(batch_id: str):
    reports = repo.list_generated_reports_by_batch(batch_id)
    if not reports:
        raise HTTPException(404, "Nenhum laudo encontrado para esse batch.")

    zip_path = EXPORTS_DIR / batch_id / "laudos.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for report in reports:
            docx_path = Path(report.docx_path)
            if docx_path.exists():
                report_input = repo.get_report_input(report.report_input_id)
                arcname = f"{report_input.row_label}.docx" if report_input else docx_path.name
                zf.write(docx_path, arcname=arcname)

    return FileResponse(zip_path, media_type="application/zip", filename="laudos.zip")
