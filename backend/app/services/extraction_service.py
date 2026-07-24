from typing import Callable

from app.core.errors import AppException
from app.ml.document_ai import DocumentUnderstandingService
from app.ml.ocr import OCRService
from app.schemas.extraction import ExtractionRequest, ExtractionResponse
from app.services.storage import StorageService


class DocumentExtractionService:
    def __init__(
        self,
        *,
        storage_service: StorageService,
        ocr_service: OCRService,
        understanding_service: DocumentUnderstandingService,
    ) -> None:
        self._storage_service = storage_service
        self._ocr_service = ocr_service
        self._understanding_service = understanding_service

    def extract_from_object(
        self, payload: ExtractionRequest, progress_callback: Callable[[str], None] = None
    ) -> ExtractionResponse:
        try:
            if progress_callback:
                progress_callback("Downloading document from secure storage...")
            pdf_bytes = self._storage_service.download_object_bytes(payload.object_key)
            
            if not pdf_bytes.startswith(b"%PDF-"):
                raise AppException(
                    status_code=400,
                    code="invalid_pdf",
                    message="The uploaded file does not appear to be a valid PDF document.",
                    details={"object_key": payload.object_key},
                )
            
            if progress_callback:
                progress_callback("Running advanced OCR to read text from pages (this may take a moment)...")
            pages, ocr_warnings, raw_text_preview = self._ocr_service.extract(pdf_bytes, payload.languages)

            if not pages:
                raise AppException(
                    status_code=422,
                    code="ocr_no_content",
                    message="Couldn't find any readable text in this PDF. Is it just images?",
                    details={"object_key": payload.object_key},
                )

            if progress_callback:
                progress_callback("Analyzing extracted text with AI to find structured fields...")
            document_type, confidence, fields, ai_warnings, summary = (
                self._understanding_service.classify_and_extract(
                    pages=pages,
                    raw_text_preview=raw_text_preview,
                    use_layout_model=payload.use_layout_model,
                    summarize=payload.summarize,
                )
            )

            return ExtractionResponse(
                object_key=payload.object_key,
                file_name=payload.file_name,
                document_type=document_type,
                classification_confidence=confidence,
                fields=fields,
                pages=pages,
                warnings=[*ocr_warnings, *ai_warnings],
                raw_text_preview=raw_text_preview,
                summary=summary,
            )
        finally:
            self._storage_service.delete_object(payload.object_key)
