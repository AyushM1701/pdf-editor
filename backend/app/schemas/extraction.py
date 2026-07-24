from enum import Enum
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from app.schemas.storage import DocumentKind as DocumentType

LanguageCode = Annotated[str, StringConstraints(pattern=r"^[a-z]{2,5}$")]


class BoundingBox(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x0: float
    y0: float
    x1: float
    y1: float


class OCRToken(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    confidence: float = Field(default=0.0, ge=0, le=1)
    bbox: BoundingBox
    page_number: int = Field(ge=1)


class ExtractedField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    value: str
    confidence: float = Field(ge=0, le=1)
    page_number: int | None = Field(default=None, ge=1)
    bbox: BoundingBox | None = None


class ExtractionWarning(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str


class PageExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_number: int = Field(ge=1)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    text_excerpt: str = ""
    tokens: list[OCRToken] = Field(default_factory=list)


class ExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    object_key: str = Field(min_length=3)
    file_name: str | None = Field(default=None, max_length=255)
    use_layout_model: bool = True
    summarize: bool = False
    languages: list[LanguageCode] = Field(default=["en"], max_length=10)


class ExtractionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    object_key: str
    file_name: str | None = None
    document_type: DocumentType
    classification_confidence: float = Field(ge=0, le=1)
    fields: list[ExtractedField] = Field(default_factory=list)
    pages: list[PageExtraction] = Field(default_factory=list)
    warnings: list[ExtractionWarning] = Field(default_factory=list)
    raw_text_preview: str = ""
    summary: str | None = None


class JobStatus(str, Enum):
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ExtractionJobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    status: JobStatus
    message: str | None = None
    result: ExtractionResponse | None = None
    error: str | None = None
