from datetime import UTC, datetime
from pathlib import Path
from re import sub

import boto3
import botocore.exceptions

from app.core.config import Settings
from app.core.errors import AppException
from app.schemas.storage import PresignUploadRequest, PresignUploadResponse
from app.services.object_key import build_object_key


class S3StorageService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = boto3.client("s3", region_name=settings.aws_region)

    def create_presigned_upload(
        self, payload: PresignUploadRequest
    ) -> PresignUploadResponse:
        object_key = build_object_key(
            file_name=payload.file_name,
            document_kind=payload.document_kind.value,
        )

        try:
            presigned = self._client.generate_presigned_post(
                Bucket=self._settings.s3_bucket_name,
                Key=object_key,
                Fields={"Content-Type": payload.content_type},
                Conditions=[
                    {"Content-Type": payload.content_type},
                    ["content-length-range", 1, self._settings.max_upload_bytes]
                ],
                ExpiresIn=self._settings.presigned_url_expiration,
            )
            upload_url = presigned["url"]
            upload_fields = presigned["fields"]
        except (botocore.exceptions.NoCredentialsError, botocore.exceptions.ClientError, AttributeError) as exc:
            if isinstance(exc, AttributeError) and "access_key" not in str(exc):
                # Only catch AttributeError specifically related to missing credentials (NoneType has no attribute 'access_key')
                raise
            raise AppException(
                status_code=500,
                code="aws_credentials_missing",
                message="AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or set USE_LOCAL_STORAGE=True to use local disk storage instead.",
                details={"reason": str(exc)},
            ) from exc
        except Exception as exc:  # pragma: no cover - AWS credentials vary by env
            raise AppException(
                status_code=500,
                code="presign_upload_failed",
                message="The API could not create a presigned S3 upload URL.",
                details={"reason": str(exc)},
            ) from exc

        return PresignUploadResponse(
            upload_url=upload_url,
            object_key=object_key,
            expires_in=self._settings.presigned_url_expiration,
            upload_fields=upload_fields,
        )

    def download_object_bytes(self, object_key: str) -> bytes:
        try:
            response = self._client.get_object(
                Bucket=self._settings.s3_bucket_name,
                Key=object_key,
            )
        except Exception as exc:  # pragma: no cover - depends on AWS state
            raise AppException(
                status_code=404,
                code="s3_object_not_found",
                message="Oops, I couldn't find that document in S3. Did it get deleted?",
                details={"object_key": object_key, "reason": str(exc)},
            ) from exc

        return response["Body"].read()

    def delete_object(self, object_key: str) -> None:
        try:
            self._client.delete_object(
                Bucket=self._settings.s3_bucket_name,
                Key=object_key,
            )
        except Exception as exc:
            import logging
            logging.getLogger("app").warning("Failed to delete object %s from S3", object_key, exc_info=exc)
