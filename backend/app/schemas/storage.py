from enum import Enum
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocumentKind(str, Enum):
    invoice = "invoice"
    identity_document = "identity_document"
    form = "form"
    receipt = "receipt"
    unknown = "unknown"


class PresignUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="application/pdf")
    document_kind: DocumentKind = DocumentKind.unknown

    @field_validator("file_name")
    @classmethod
    def validate_pdf_extension(cls, value: str) -> str:
        if Path(value).suffix.lower() != ".pdf":
            raise ValueError("Only PDF files are supported.")

        return value

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        if value != "application/pdf":
            raise ValueError("content_type must be application/pdf.")

        return value


class PresignUploadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upload_url: str
    object_key: str
    expires_in: int
    headers: dict[str, str] = Field(default_factory=dict)
    upload_fields: dict[str, str] = Field(default_factory=dict)
