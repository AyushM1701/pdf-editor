import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_settings

from app.core.rate_limit import limiter
from app.core.dependencies import get_storage_service
from app.schemas.storage import PresignUploadRequest, PresignUploadResponse
from app.services.storage import StorageService

router = APIRouter(prefix="/storage", tags=["storage"])


@router.post(
    "/presign-upload",
    response_model=PresignUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
def presign_upload(
    request: Request,
    payload: PresignUploadRequest,
    storage_service: StorageService = Depends(get_storage_service),
) -> PresignUploadResponse:
    return storage_service.create_presigned_upload(payload)




@router.put("/local-upload/{object_key:path}", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def local_upload(object_key: str, request: Request):
    # Reject uploads that declare a Content-Length exceeding the limit.
    content_length = request.headers.get("content-length")
    settings = get_settings()
    max_bytes = settings.max_upload_bytes
    if content_length is not None and int(content_length) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Upload exceeds the {max_bytes // (1024 * 1024)}MB limit.",
        )

    # Strict sanitization: reject .., null bytes, and any character that isn't alphanumeric, dash, underscore, slash, or dot
    if ".." in object_key or "\0" in object_key or not re.match(r"^[a-zA-Z0-9_\-/\.]+$", object_key):
        raise HTTPException(status_code=400, detail="Invalid object key format")

    base_dir = Path("local_uploads").resolve().absolute()
    file_path = (base_dir / object_key).resolve().absolute()

    if not file_path.is_relative_to(base_dir):
        raise HTTPException(status_code=400, detail="Invalid object key path traversal")

    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Stream the body in chunks to avoid loading the entire payload into memory at once.
    total_read = 0
    with open(file_path, "wb") as f:
        async for chunk in request.stream():
            total_read += len(chunk)
            if total_read > max_bytes:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"Upload exceeds the {max_bytes // (1024 * 1024)}MB limit.",
                )
            f.write(chunk)

    return {"message": "Successfully uploaded file locally"}
