from typing import Protocol

from app.schemas.storage import PresignUploadRequest, PresignUploadResponse


class StorageService(Protocol):
    def create_presigned_upload(self, payload: PresignUploadRequest) -> PresignUploadResponse:
        ...

    def download_object_bytes(self, object_key: str) -> bytes:
        ...

    def delete_object(self, object_key: str) -> None:
        ...
