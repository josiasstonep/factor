from pydantic import BaseModel


class Perito(BaseModel):
    id: str
    nome: str
    matricula: str
    cargo: str = "Perito Criminal"


class Delegacia(BaseModel):
    id: str
    nome: str
    municipio: str = ""
