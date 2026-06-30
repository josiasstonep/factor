import shutil
from uuid import uuid4

from fastapi import APIRouter, HTTPException, UploadFile

from sidecar.config import UPLOADS_DIR

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"}


@router.post("/image")
async def upload_image(file: UploadFile):
    if not file.filename:
        raise HTTPException(400, "Arquivo sem nome.")
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(400, f"Extensão não suportada: {ext}")

    images_dir = UPLOADS_DIR / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid4())
    dest_path = images_dir / f"{file_id}{ext}"
    with dest_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"file_path": str(dest_path)}
