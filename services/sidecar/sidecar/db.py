import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import create_engine, Column, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker

from sidecar.config import DB_PATH

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class TemplateRow(Base):
    __tablename__ = "templates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    data = Column(Text, nullable=False)  # JSON-serialized Template payload


class ReportInputRow(Base):
    __tablename__ = "report_inputs"

    id = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    batch_id = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    data = Column(Text, nullable=False)


class GeneratedReportRow(Base):
    __tablename__ = "generated_reports"

    id = Column(String, primary_key=True)
    batch_id = Column(String, nullable=False)
    report_input_id = Column(String, nullable=False)
    template_id = Column(String, nullable=False)
    status = Column(String, nullable=False)
    generated_at = Column(DateTime, nullable=False)
    data = Column(Text, nullable=False)


class PeritoRow(Base):
    __tablename__ = "peritos"

    id = Column(String, primary_key=True)
    data = Column(Text, nullable=False)  # JSON-serialized Perito


class DelegaciaRow(Base):
    __tablename__ = "delegacias"

    id = Column(String, primary_key=True)
    data = Column(Text, nullable=False)  # JSON-serialized Delegacia


def init_db() -> None:
    Base.metadata.create_all(engine)


def now() -> datetime:
    return datetime.now(timezone.utc)


def to_json(obj: Any) -> str:
    return json.dumps(obj, default=str, ensure_ascii=False)


def from_json(raw: str) -> Any:
    return json.loads(raw)
