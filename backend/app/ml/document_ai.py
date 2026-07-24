import re
from collections.abc import Iterable

from app.core.config import Settings
from app.schemas.extraction import DocumentType, ExtractedField, ExtractionWarning, PageExtraction


class DocumentUnderstandingService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._classifier = None
        self._classifier_failed = False

    def classify_and_extract(
        self,
        *,
        pages: list[PageExtraction],
        raw_text_preview: str,
        use_layout_model: bool,
        summarize: bool = False,
    ) -> tuple[DocumentType, float, list[ExtractedField], list[ExtractionWarning], str | None]:
        warnings: list[ExtractionWarning] = []
        if summarize:
            warnings.append(
                ExtractionWarning(
                    code="summarization_unsupported",
                    message="Summarization was requested, but is not supported by the local rule-based extraction model.",
                )
            )

        document_type, confidence = self._heuristic_classification(raw_text_preview)

        if use_layout_model and self._settings.document_ai_model_name:
            classifier_result = self._run_optional_transformer(raw_text_preview)
            if classifier_result is None:
                warnings.append(
                    ExtractionWarning(
                        code="transformer_fallback",
                        message=(
                            "The configured transformer model could not run, so "
                            "heuristic document classification was used."
                        ),
                    )
                )
            else:
                document_type, confidence = classifier_result
        elif use_layout_model:
            warnings.append(
                ExtractionWarning(
                    code="layout_model_not_configured",
                    message=(
                        "No Hugging Face layout model is configured yet. The API "
                        "used rule-based classification and extraction instead."
                    ),
                )
            )

        extracted_fields = self._extract_fields(document_type, pages, raw_text_preview)
        return document_type, confidence, extracted_fields, warnings, None

    def _run_optional_transformer(
        self, raw_text_preview: str
    ) -> tuple[DocumentType, float] | None:
        if self._classifier_failed:
            return None

        if self._classifier is None:
            try:
                # pyrefly: ignore [missing-import]
                from transformers import pipeline
            except ImportError:
                self._classifier_failed = True
                return None

            try:
                self._classifier = pipeline(
                    self._settings.hf_pipeline_task,
                    model=self._settings.document_ai_model_name,
                    device=self._settings.hf_device,
                )
            except Exception:
                return None

        try:
            result = self._classifier(raw_text_preview[:1500])
        except Exception:
            return None

        if isinstance(result, list) and result:
            top_result = result[0]
            label = str(top_result.get("label", "")).strip().lower().replace(" ", "_")
            score = float(top_result.get("score", 0.0))
            normalized_type = self._normalize_document_type(label)
            return normalized_type, score

        return None

    def _heuristic_classification(self, raw_text_preview: str) -> tuple[DocumentType, float]:
        text = raw_text_preview.lower()

        invoice_hits = sum(
            keyword in text
            for keyword in ("invoice", "bill to", "amount due", "due date", "total")
        )
        identity_hits = sum(
            keyword in text
            for keyword in ("date of birth", "id number", "issuing authority", "driver")
        )
        form_hits = sum(keyword in text for keyword in ("signature", "applicant", "section", "checkbox"))
        receipt_hits = sum(keyword in text for keyword in ("receipt", "change", "cashier", "subtotal"))

        scores = {
            DocumentType.invoice: invoice_hits,
            DocumentType.identity_document: identity_hits,
            DocumentType.form: form_hits,
            DocumentType.receipt: receipt_hits,
        }

        document_type = max(scores, key=scores.get)
        strongest_score = scores[document_type]

        if strongest_score == 0:
            return DocumentType.unknown, 0.35

        return document_type, min(0.55 + strongest_score * 0.1, 0.95)

    def _extract_fields(
        self,
        document_type: DocumentType,
        pages: list[PageExtraction],
        raw_text_preview: str,
    ) -> list[ExtractedField]:
        text = raw_text_preview or "\n".join(page.text_excerpt for page in pages)
        matches: list[ExtractedField] = []

        if document_type == DocumentType.invoice:
            matches.extend(
                self._extract_pattern_fields(
                    text=text,
                    pages=pages,
                    patterns={
                        "invoice_number": [
                            r"(?:invoice(?:\s+number)?|inv(?:\.|oice)?\s*#?)\s*[:\-]?\s*([A-Z0-9\-\/]+)",
                        ],
                        "invoice_date": [
                            r"(?:invoice date|date)\s*[:\-]?\s*([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                        ],
                        "due_date": [
                            r"(?:due date)\s*[:\-]?\s*([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                        ],
                        "subtotal_amount": [
                            r"\bsubtotal\b\s*[:\-]?\s*([$€£]?\s?\d[\d,]*(?:\.\d{2})?)",
                        ],
                        "total_amount": [
                            r"\b(?:total(?: amount)?|amount due|balance due)\b\s*[:\-]?\s*([$€£]?\s?\d[\d,]*(?:\.\d{2})?)",
                        ],
                        "tax_amount": [
                            r"\b(?:tax|vat)\b\s*[:\-]?\s*([$€£]?\s?\d[\d,]*(?:\.\d{2})?)",
                        ],
                    },
                )
            )

            vendor_name = self._extract_vendor_name(pages)
            if vendor_name:
                matches.append(
                    ExtractedField(
                        name="vendor_name",
                        value=vendor_name,
                        confidence=0.58,
                        page_number=1,
                    )
                )
        elif document_type == DocumentType.identity_document:
            matches.extend(
                self._extract_pattern_fields(
                    text=text,
                    pages=pages,
                    patterns={
                        "full_name": [r"(?:name)\s*[:\-]?\s*([A-Z][A-Z\s]+)"],
                        "id_number": [r"(?:id(?: number)?|document number)\s*[:\-]?\s*([A-Z0-9\-]+)"],
                        "date_of_birth": [
                            r"(?:date of birth|dob)\s*[:\-]?\s*([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                        ],
                    },
                )
            )
        else:
            matches.extend(self._extract_label_value_pairs(pages))

        deduped: list[ExtractedField] = []
        seen: set[tuple[str, str]] = set()
        for field in matches:
            key = (field.name, field.value)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(field)

        return deduped

    def _extract_pattern_fields(
        self,
        *,
        text: str,
        pages: list[PageExtraction],
        patterns: dict[str, Iterable[str]],
    ) -> list[ExtractedField]:
        fields: list[ExtractedField] = []

        for field_name, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, text, flags=re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    page_number = self._find_page_number(pages, value)
                    fields.append(
                        ExtractedField(
                            name=field_name,
                            value=value,
                            confidence=0.72,
                            page_number=page_number,
                        )
                    )
                    break

        return fields

    def _extract_label_value_pairs(self, pages: list[PageExtraction]) -> list[ExtractedField]:
        fields: list[ExtractedField] = []

        for page in pages:
            for line in page.text_excerpt.splitlines():
                if ":" not in line:
                    continue

                label, value = line.split(":", 1)
                normalized_label = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
                cleaned_value = value.strip()

                if not normalized_label or not cleaned_value:
                    continue

                fields.append(
                    ExtractedField(
                        name=normalized_label[:50],
                        value=cleaned_value[:250],
                        confidence=0.55,
                        page_number=page.page_number,
                    )
                )

                if len(fields) >= 10:
                    return fields

        return fields

    def _extract_vendor_name(self, pages: list[PageExtraction]) -> str | None:
        if not pages:
            return None

        for line in pages[0].text_excerpt.splitlines():
            stripped = line.strip()
            if not stripped:
                continue

            if any(
                keyword in stripped.lower()
                for keyword in ("invoice", "bill to", "ship to", "date", "total")
            ):
                continue

            return stripped[:120]

        return None

    def _find_page_number(self, pages: list[PageExtraction], needle: str) -> int | None:
        lowered_needle = needle.lower()

        for page in pages:
            if lowered_needle in page.text_excerpt.lower():
                return page.page_number

        return None

    def _normalize_document_type(self, label: str) -> DocumentType:
        if "invoice" in label:
            return DocumentType.invoice
        if "identity" in label or "passport" in label or "license" in label:
            return DocumentType.identity_document
        if "receipt" in label:
            return DocumentType.receipt
        if "form" in label:
            return DocumentType.form
        return DocumentType.unknown
