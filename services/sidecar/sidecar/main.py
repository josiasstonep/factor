import argparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sidecar.config import UPLOADS_DIR, TEMPLATES_DIR
from sidecar.db import init_db
from sidecar import repo
from sidecar.routers import ai, peritos, reports, templates, uploads
from sidecar.parsing.orchestrator import _merge_standard_vars

app = FastAPI(title="Factor Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "app://."],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# On startup: ensure all confirmed templates have the standard forensic variables.
for _t in repo.list_templates():
    if _t.status == "confirmed":
        before = {v.key for v in _t.variables}
        _t.variables = _merge_standard_vars(_t.variables)
        if {v.key for v in _t.variables} != before:
            repo.save_template(_t)

app.include_router(templates.router)
app.include_router(uploads.router)
app.include_router(reports.router)
app.include_router(ai.router)
app.include_router(peritos.router)

# Serve uploaded images back to the renderer for previewing
app.mount("/uploads-static", StaticFiles(directory=UPLOADS_DIR), name="uploads-static")
# Serve template assets (header/footer/figure previews extracted from source PDF)
app.mount("/templates-static", StaticFiles(directory=TEMPLATES_DIR), name="templates-static")


@app.get("/health")
async def health():
    return {"status": "ok"}


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8731)
    parser.add_argument("--host", type=str, default="127.0.0.1")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
