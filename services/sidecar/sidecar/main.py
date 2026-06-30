import argparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sidecar.config import UPLOADS_DIR
from sidecar.db import init_db
from sidecar.routers import reports, templates, uploads

app = FastAPI(title="Factor Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "app://."],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(templates.router)
app.include_router(uploads.router)
app.include_router(reports.router)

# Serve uploaded images back to the renderer for previewing (e.g. <img src="/uploads/images/...">)
app.mount("/uploads-static", StaticFiles(directory=UPLOADS_DIR), name="uploads-static")


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
