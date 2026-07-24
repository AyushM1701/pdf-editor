from __future__ import annotations
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from app.core.config import Settings
from app.schemas.extraction import DocumentType, ExtractedField, ExtractionWarning, PageExtraction


class GeminiExtractedField(BaseModel):
    name: str = Field(description="The normalized name of the extracted field, e.g., 'invoice_number' or 'vendor_name'")
    value: str = Field(description="The extracted value")
    confidence: float = Field(description="Confidence score from 0.0 to 1.0")
    page_number: int = Field(description="The page number where this field was found (1-indexed)")


class GeminiDocumentResult(BaseModel):
    document_type: str = Field(
        description="The classification of the document. Must be exactly one of: invoice, identity_document, receipt, form, unknown"
    )
    classification_confidence: float = Field(description="Confidence score from 0.0 to 1.0")
    fields: list[GeminiExtractedField] = Field(description="List of extracted fields")
    summary: str | None = Field(default=None, description="A comprehensive summary of the entire document, if requested. Keep it concise but detailed.")


if TYPE_CHECKING:
    from app.ml.document_ai import DocumentUnderstandingService

class GeminiUnderstandingService:
    def __init__(self, settings: Settings, fallback_service: "DocumentUnderstandingService") -> None:
        self._settings = settings
        self._fallback_service = fallback_service
        self._client = None
        
        if self._settings.gemini_api_key:
            try:
                # pyrefly: ignore [missing-import]
                from google import genai
                self._client = genai.Client(api_key=self._settings.gemini_api_key)
            except ImportError:
                pass

    @property
    def is_configured(self) -> bool:
        return self._client is not None

    def classify_and_extract(
        self,
        *,
        pages: list[PageExtraction],
        raw_text_preview: str,
        use_layout_model: bool,
        summarize: bool = False,
    ) -> tuple[DocumentType, float, list[ExtractedField], list[ExtractionWarning], str | None]:
        warnings: list[ExtractionWarning] = []
        
        if not self.is_configured:
            doc_type, conf, fields, fallback_warnings, _ = self._fallback_service.classify_and_extract(    
                pages=pages,
                raw_text_preview=raw_text_preview,
                use_layout_model=use_layout_model,
                summarize=summarize,
            )
            return doc_type, conf, fields, warnings + fallback_warnings, None

        text_content = raw_text_preview or "\n".join(f"--- PAGE {page.page_number} ---\n{page.text_excerpt}" for page in pages)
        
        summarize_instruction = ""
        if summarize:
            summarize_instruction = "\nAlso provide a comprehensive but concise summary of the entire document in the 'summary' field."

        prompt = f"""
        Analyze the following document text and extract all relevant key-value pairs.
        Classify the document into one of the allowed types: invoice, identity_document, receipt, form, unknown.
        Be highly accurate and extract as much structured data as possible (e.g. invoice numbers, dates, amounts, vendor names, line items as string, etc).{summarize_instruction}
        
        Document Text:
        {text_content}
        """

        try:
            # pyrefly: ignore [missing-import]
            from google.genai import types
            
            response = self._client.models.generate_content(
                model=self._settings.gemini_model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiDocumentResult,
                    temperature=0.1,
                ),
            )
            
            result = GeminiDocumentResult.model_validate_json(response.text)
            
            try:
                doc_type = DocumentType(result.document_type)
            except ValueError:
                doc_type = DocumentType.unknown
                
            extracted_fields = [
                ExtractedField(
                    name=f.name,
                    value=f.value,
                    confidence=f.confidence,
                    page_number=f.page_number,
                ) for f in result.fields
            ]
            
            return doc_type, result.classification_confidence, extracted_fields, warnings, result.summary
            
        except Exception as e:
            warnings.append(
                ExtractionWarning(
                    code="gemini_extraction_failed",
                    message=f"Gemini API extraction failed: {str(e)}",
                )
            )
            return DocumentType.unknown, 0.0, [], warnings, None
