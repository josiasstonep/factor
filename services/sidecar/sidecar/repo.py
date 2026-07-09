"""Thin persistence layer: each domain entity is stored as a JSON blob in its
own SQLite table (queryable by id/status), keeping the nested pydantic models
as the single source of truth for shape instead of a separate ORM schema."""

from sidecar.db import (
    DelegaciaRow,
    GeneratedReportRow,
    PeritoRow,
    ReportInputRow,
    SessionLocal,
    TemplateRow,
    from_json,
    to_json,
)
from sidecar.models.generated_report import GeneratedReport
from sidecar.models.perito import Delegacia, Perito
from sidecar.models.report_input import ReportInput
from sidecar.models.template import Template


def save_template(template: Template) -> None:
    with SessionLocal() as session:
        row = session.get(TemplateRow, template.id)
        payload = to_json(template.model_dump(mode="json"))
        if row:
            row.name = template.name
            row.status = template.status
            row.data = payload
        else:
            row = TemplateRow(
                id=template.id,
                name=template.name,
                status=template.status,
                created_at=template.created_at,
                data=payload,
            )
            session.add(row)
        session.commit()


def get_template(template_id: str) -> Template | None:
    with SessionLocal() as session:
        row = session.get(TemplateRow, template_id)
        if not row:
            return None
        return Template.model_validate(from_json(row.data))


def list_templates() -> list[Template]:
    with SessionLocal() as session:
        rows = session.query(TemplateRow).order_by(TemplateRow.created_at.desc()).all()
        return [Template.model_validate(from_json(r.data)) for r in rows]


def delete_template(template_id: str) -> bool:
    with SessionLocal() as session:
        row = session.get(TemplateRow, template_id)
        if not row:
            return False
        session.delete(row)
        session.commit()
        return True


def save_report_input(report_input: ReportInput) -> None:
    with SessionLocal() as session:
        row = session.get(ReportInputRow, report_input.id)
        payload = to_json(report_input.model_dump(mode="json"))
        if row:
            row.data = payload
        else:
            row = ReportInputRow(
                id=report_input.id,
                template_id=report_input.template_id,
                batch_id=report_input.batch_id,
                created_at=report_input.created_at,
                data=payload,
            )
            session.add(row)
        session.commit()


def get_report_input(report_input_id: str) -> ReportInput | None:
    with SessionLocal() as session:
        row = session.get(ReportInputRow, report_input_id)
        if not row:
            return None
        return ReportInput.model_validate(from_json(row.data))


def save_generated_report(report: GeneratedReport) -> None:
    with SessionLocal() as session:
        row = session.get(GeneratedReportRow, report.id)
        payload = to_json(report.model_dump(mode="json"))
        if row:
            row.status = report.status
            row.data = payload
        else:
            row = GeneratedReportRow(
                id=report.id,
                batch_id=report.batch_id,
                report_input_id=report.report_input_id,
                template_id=report.template_id,
                status=report.status,
                generated_at=report.generated_at,
                data=payload,
            )
            session.add(row)
        session.commit()


def get_generated_report(report_id: str) -> GeneratedReport | None:
    with SessionLocal() as session:
        row = session.get(GeneratedReportRow, report_id)
        if not row:
            return None
        return GeneratedReport.model_validate(from_json(row.data))


def list_generated_reports_by_batch(batch_id: str) -> list[GeneratedReport]:
    with SessionLocal() as session:
        rows = session.query(GeneratedReportRow).filter_by(batch_id=batch_id).all()
        return [GeneratedReport.model_validate(from_json(r.data)) for r in rows]


# ─── Peritos ──────────────────────────────────────────────────────────────────


def save_perito(perito: Perito) -> None:
    with SessionLocal() as session:
        row = session.get(PeritoRow, perito.id)
        payload = to_json(perito.model_dump(mode="json"))
        if row:
            row.data = payload
        else:
            session.add(PeritoRow(id=perito.id, data=payload))
        session.commit()


def list_peritos() -> list[Perito]:
    with SessionLocal() as session:
        rows = session.query(PeritoRow).all()
        return [Perito.model_validate(from_json(r.data)) for r in rows]


def delete_perito(perito_id: str) -> bool:
    with SessionLocal() as session:
        row = session.get(PeritoRow, perito_id)
        if not row:
            return False
        session.delete(row)
        session.commit()
        return True


# ─── Delegacias ───────────────────────────────────────────────────────────────


def save_delegacia(delegacia: Delegacia) -> None:
    with SessionLocal() as session:
        row = session.get(DelegaciaRow, delegacia.id)
        payload = to_json(delegacia.model_dump(mode="json"))
        if row:
            row.data = payload
        else:
            session.add(DelegaciaRow(id=delegacia.id, data=payload))
        session.commit()


def list_delegacias() -> list[Delegacia]:
    with SessionLocal() as session:
        rows = session.query(DelegaciaRow).all()
        return [Delegacia.model_validate(from_json(r.data)) for r in rows]


def delete_delegacia(delegacia_id: str) -> bool:
    with SessionLocal() as session:
        row = session.get(DelegaciaRow, delegacia_id)
        if not row:
            return False
        session.delete(row)
        session.commit()
        return True
