import os
from datetime import UTC, datetime
from pathlib import Path
import re

from app.core.config import Settings
from app.core.errors import AppException
from app.schemas.storage import PresignUploadRequest, PresignUploadResponse
from app.services.object_key import build_object_key


class LocalStorageService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base_dir = Path("local_uploads")
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def create_presigned_upload(
        self, payload: PresignUploadRequest
    ) -> PresignUploadResponse:
        object_key = build_object_key(
            file_name=payload.file_name,
            document_kind=payload.document_kind.value,
        )

        upload_url = f"{self._settings.api_prefix}/storage/local-upload/{object_key}"

        return PresignUploadResponse(
            upload_url=upload_url,
            object_key=object_key,
            expires_in=self._settings.presigned_url_expiration,
            headers={"Content-Type": payload.content_type},
        )

    def _validate_object_key(self, object_key: str) -> Path:
        if ".." in object_key or "\0" in object_key or not re.match(r"^[a-zA-Z0-9_\-/\.]+$", object_key):
            raise AppException(
                status_code=400,
                code="invalid_object_key",
                message="Invalid object key format.",
            )
        base_dir = self._base_dir.resolve().absolute()
        file_path = (base_dir / object_key).resolve().absolute()
        
        if not file_path.is_relative_to(base_dir):
            raise AppException(
                status_code=400,
                code="invalid_object_key",
                message="Invalid object key path traversal.",
            )
        return file_path

    def download_object_bytes(self, object_key: str) -> bytes:
        file_path = self._validate_object_key(object_key)
        if not file_path.exists() or not file_path.is_file():
            raise AppException(
                status_code=404,
                code="local_object_not_found",
                message="Man, I couldn't find that document on your local disk. Did you delete it?",
                details={"object_key": object_key},
            )
        
        try:
            return file_path.read_bytes()
        except Exception as exc:
            raise AppException(
                status_code=500,
                code="local_object_read_error",
                message="Error reading document from local storage.",
                details={"object_key": object_key, "reason": str(exc)},
            ) from exc

    def delete_object(self, object_key: str) -> None:
        try:
            file_path = self._validate_object_key(object_key)
            file_path.unlink(missing_ok=True)
        except Exception as exc:
            import logging
            logging.getLogger("app").warning("Failed to delete local object %s", object_key, exc_info=exc)
