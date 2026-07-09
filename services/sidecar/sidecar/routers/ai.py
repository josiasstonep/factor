import sidecar.ai_providers.claude  # noqa: F401 — registers provider
import sidecar.ai_providers.gemini  # noqa: F401
import sidecar.ai_providers.groq  # noqa: F401
import sidecar.ai_providers.ollama  # noqa: F401
import sidecar.ai_providers.openai_provider  # noqa: F401
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from sidecar import repo
from sidecar.ai_providers.base import all_providers, get_provider, improve_section_paragraphs
from sidecar.diffing.word_diff import word_diff

router = APIRouter(prefix="/ai", tags=["ai"])


# ─── GET /ai/providers ────────────────────────────────────────────────────────


class ProviderInfo(BaseModel):
    name: str
    label: str
    requires_key: bool
    available: bool
    default_model: str | None = None
    available_models: list[str] = []


@router.get("/providers", response_model=list[ProviderInfo])
async def list_providers():
    result = []
    for p in all_providers():
        available = await p.is_available()
        models: list[str] = []
        if available and hasattr(p, "list_models"):
            models = await p.list_models()
        result.append(
            ProviderInfo(
                name=p.name,
                label=p.label,
                requires_key=p.requires_key,
                available=available,
                available_models=models,
            )
        )
    return result


# ─── POST /ai/improve ─────────────────────────────────────────────────────────


class ImproveRequest(BaseModel):
    report_id: str
    section_id: str
    provider: str
    api_key: str | None = None
    model: str | None = None


class ImproveResponse(BaseModel):
    report_id: str
    section_id: str
    ai_text: str
    diff: list[dict]


@router.post("/improve", response_model=ImproveResponse)
async def improve_section(payload: ImproveRequest):
    report = repo.get_generated_report(payload.report_id)
    if not report:
        raise HTTPException(404, "Laudo não encontrado.")

    section = next((s for s in report.sections if s.section_id == payload.section_id), None)
    if section is None:
        raise HTTPException(404, "Seção não encontrada no laudo.")

    provider = get_provider(payload.provider)
    if provider is None:
        raise HTTPException(400, f"Provedor '{payload.provider}' não registrado.")

    if payload.api_key is None and provider.requires_key:
        raise HTTPException(400, f"Provedor '{payload.provider}' requer uma chave de API.")

    # Resolve section_type and expertise_type for specialized prompt
    template = repo.get_template(report.template_id)
    expertise_type = template.expertise_type if template else None
    template_section = next(
        (s for s in (template.sections if template else []) if s.id == payload.section_id),
        None,
    )
    section_type = template_section.type.value if template_section else "custom"

    try:
        ai_text = await provider.improve_text(
            section.original_text,
            payload.api_key,
            payload.model,
            section_type=section_type,
            expertise_type=expertise_type,
        )
    except Exception as exc:
        raise HTTPException(502, f"Erro ao chamar {payload.provider}: {exc}") from exc

    diff = word_diff(section.original_text, ai_text)

    section.ai_text = ai_text
    section.diff = diff
    section.ai_provider_used = payload.provider
    section.accepted = False
    report.status = "ai_pending"
    repo.save_generated_report(report)

    return ImproveResponse(
        report_id=payload.report_id,
        section_id=payload.section_id,
        ai_text=ai_text,
        diff=[op.model_dump() for op in diff],
    )


# ─── POST /ai/improve-text ───────────────────────────────────────────────────
# Improves raw text without needing a stored report — used pre-generation.


class ImproveTextRequest(BaseModel):
    text: str
    template_id: str | None = None
    section_id: str | None = None
    provider: str
    api_key: str | None = None
    model: str | None = None
    case_context: str | None = None
    variable_values: dict[str, str] | None = None


class ImproveTextResponse(BaseModel):
    ai_text: str
    diff: list[dict]
    warnings: list[str] = []


@router.post("/improve-text", response_model=ImproveTextResponse)
async def improve_raw_text(payload: ImproveTextRequest):
    provider = get_provider(payload.provider)
    if provider is None:
        raise HTTPException(400, f"Provedor '{payload.provider}' não registrado.")
    if payload.api_key is None and provider.requires_key:
        raise HTTPException(400, f"Provedor '{payload.provider}' requer uma chave de API.")

    template = repo.get_template(payload.template_id) if payload.template_id else None
    expertise_type = template.expertise_type if template else None
    template_section = next(
        (s for s in (template.sections if template else []) if s.id == payload.section_id),
        None,
    )
    section_type = template_section.type.value if template_section else "custom"

    # Merge variable_values into case_context so providers receive a single string
    full_context = payload.case_context or ""
    if payload.variable_values:
        var_lines = "\n".join(f"- {k}: {v}" for k, v in payload.variable_values.items() if v)
        if var_lines:
            prefix = f"DADOS DO CASO:\n{var_lines}"
            full_context = f"{prefix}\n\n{full_context}".strip() if full_context else prefix

    try:
        ai_text, warns = await improve_section_paragraphs(
            provider,
            payload.text,
            payload.api_key,
            payload.model,
            section_type=section_type,
            expertise_type=expertise_type,
            case_context=full_context or None,
        )
    except Exception as exc:
        raise HTTPException(502, f"Erro ao chamar {payload.provider}: {exc}") from exc

    diff = word_diff(payload.text, ai_text)
    return ImproveTextResponse(ai_text=ai_text, diff=[op.model_dump() for op in diff], warnings=warns)


# ─── PATCH /ai/accept ────────────────────────────────────────────────────────


class AcceptRequest(BaseModel):
    report_id: str
    section_id: str
    accept: bool


@router.patch("/accept")
async def accept_section(payload: AcceptRequest):
    report = repo.get_generated_report(payload.report_id)
    if not report:
        raise HTTPException(404, "Laudo não encontrado.")

    section = next((s for s in report.sections if s.section_id == payload.section_id), None)
    if section is None:
        raise HTTPException(404, "Seção não encontrada.")

    section.accepted = payload.accept
    if all(s.ai_text is None or s.accepted for s in report.sections):
        report.status = "ai_reviewed"
    repo.save_generated_report(report)

    return {"ok": True, "accepted": section.accepted}
