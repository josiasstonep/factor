import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from sidecar import repo
from sidecar.models.perito import Delegacia, Perito

router = APIRouter(tags=["peritos"])

# ─── Peritos ──────────────────────────────────────────────────────────────────

_SEED_PERITOS = [
    Perito(id="__seed_perito_1__", nome="Josias Stone Pinheiro dos Santos", matricula="18435416-01"),
]

_SEED_DELEGACIAS = [
    Delegacia(
        id="__seed_del_1__",
        nome="DRCO - Delegacia de Repressão a Crimes contra o Patrimônio",
        municipio="Salgueiro",
    ),
    Delegacia(
        id="__seed_del_2__",
        nome="DPC - Delegacia de Polícia Civil",
        municipio="Salgueiro",
    ),
]


@router.get("/peritos", response_model=list[Perito])
async def list_peritos():
    items = repo.list_peritos()
    if not items:
        for p in _SEED_PERITOS:
            repo.save_perito(p)
        items = _SEED_PERITOS[:]
    return items


class PeritoCreate(BaseModel):
    nome: str
    matricula: str
    cargo: str = "Perito Criminal"


@router.post("/peritos", response_model=Perito, status_code=201)
async def create_perito(body: PeritoCreate):
    perito = Perito(id=str(uuid.uuid4()), **body.model_dump())
    repo.save_perito(perito)
    return perito


@router.put("/peritos/{perito_id}", response_model=Perito)
async def update_perito(perito_id: str, body: PeritoCreate):
    existing = next((p for p in repo.list_peritos() if p.id == perito_id), None)
    if not existing:
        raise HTTPException(404, "Perito não encontrado.")
    updated = Perito(id=perito_id, **body.model_dump())
    repo.save_perito(updated)
    return updated


@router.delete("/peritos/{perito_id}", status_code=204)
async def delete_perito(perito_id: str):
    if not repo.delete_perito(perito_id):
        raise HTTPException(404, "Perito não encontrado.")


# ─── Delegacias ───────────────────────────────────────────────────────────────


@router.get("/delegacias", response_model=list[Delegacia])
async def list_delegacias():
    items = repo.list_delegacias()
    if not items:
        for d in _SEED_DELEGACIAS:
            repo.save_delegacia(d)
        items = _SEED_DELEGACIAS[:]
    return items


class DelegaciaCreate(BaseModel):
    nome: str
    municipio: str = ""


@router.post("/delegacias", response_model=Delegacia, status_code=201)
async def create_delegacia(body: DelegaciaCreate):
    delegacia = Delegacia(id=str(uuid.uuid4()), **body.model_dump())
    repo.save_delegacia(delegacia)
    return delegacia


@router.put("/delegacias/{delegacia_id}", response_model=Delegacia)
async def update_delegacia(delegacia_id: str, body: DelegaciaCreate):
    existing = next((d for d in repo.list_delegacias() if d.id == delegacia_id), None)
    if not existing:
        raise HTTPException(404, "Delegacia não encontrada.")
    updated = Delegacia(id=delegacia_id, **body.model_dump())
    repo.save_delegacia(updated)
    return updated


@router.delete("/delegacias/{delegacia_id}", status_code=204)
async def delete_delegacia(delegacia_id: str):
    if not repo.delete_delegacia(delegacia_id):
        raise HTTPException(404, "Delegacia não encontrada.")
