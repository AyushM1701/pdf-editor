from functools import lru_cache

from app.core.config import get_settings
from app.ml.document_ai import DocumentUnderstandingService
from app.ml.gemini_ai import GeminiUnderstandingService
from app.ml.ocr import OCRService
from app.services.extraction_service import DocumentExtractionService
from app.services.s3_service import S3StorageService
from app.services.local_storage_service import LocalStorageService
from app.services.storage import StorageService

@lru_cache
def get_storage_service() -> StorageService:
    settings = get_settings()
    if settings.use_local_storage:
        return LocalStorageService(settings)
    return S3StorageService(settings)


@lru_cache
def get_ocr_service() -> OCRService:
    return OCRService(get_settings())


@lru_cache
def get_document_understanding_service() -> DocumentUnderstandingService:
    return DocumentUnderstandingService(get_settings())


@lru_cache
def get_gemini_understanding_service() -> GeminiUnderstandingService:
    fallback = get_document_understanding_service()
    return GeminiUnderstandingService(get_settings(), fallback_service=fallback)


@lru_cache
def get_extraction_service() -> DocumentExtractionService:
    return DocumentExtractionService(
        storage_service=get_storage_service(),
        ocr_service=get_ocr_service(),
        understanding_service=get_gemini_understanding_service(),
    )
