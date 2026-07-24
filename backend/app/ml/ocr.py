from io import BytesIO

# pyrefly: ignore [missing-import]
import fitz
# pyrefly: ignore [missing-import]
from PIL import Image

from app.core.errors import AppException
from app.schemas.extraction import BoundingBox, ExtractionWarning, OCRToken, PageExtraction
from app.core.config import Settings


class OCRService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._reader = None
        self._last_languages = None

    def extract(
        self, pdf_bytes: bytes, languages: list[str] = None
    ) -> tuple[list[PageExtraction], list[ExtractionWarning], str]:
        if languages is None:
            languages = ["en"]
        pages: list[PageExtraction] = []
        warnings: list[ExtractionWarning] = []
        raw_text_fragments: list[str] = []

        try:
            document = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise AppException(
                status_code=400,
                code="invalid_pdf",
                message="The uploaded file is not a readable PDF document.",
                details={"reason": str(exc)},
            ) from exc

        if document.is_encrypted:
            raise AppException(
                status_code=400,
                code="encrypted_pdf",
                message="Encrypted PDFs cannot be processed by the extraction pipeline.",
            )

        MAX_PAGES = 100
        if document.page_count > MAX_PAGES:
            raise AppException(
                status_code=400,
                code="pdf_too_large",
                message=f"The uploaded PDF has too many pages (max {MAX_PAGES}). Please split it before processing.",
            )

        easyocr_reader = self._get_reader(languages)
        if easyocr_reader is None:
            warnings.append(
                ExtractionWarning(
                    code="easyocr_unavailable",
                    message=(
                        "EasyOCR is not installed in the current environment, "
                        "so the API is falling back to the PDF text layer only."
                    ),
                )
            )

        try:
            for page_index in range(document.page_count):
                page = document.load_page(page_index)
                page_text = page.get_text("text").strip()
                raw_text_fragments.append(page_text)
                word_tokens = self._tokens_from_text_layer(page, page_number=page_index + 1)

                if not word_tokens and easyocr_reader is not None:
                    word_tokens = self._tokens_from_ocr(
                        page=page,
                        page_number=page_index + 1,
                        easyocr_reader=easyocr_reader,
                    )
                    # OCR was used, we need to populate the page text and raw fragments with the OCR results
                    # so that the AI models actually receive the extracted text!
                    if word_tokens:
                        page_text = " ".join(t.text for t in word_tokens)
                        raw_text_fragments[-1] = page_text

                pages.append(
                    PageExtraction(
                        page_number=page_index + 1,
                        width=float(page.rect.width),
                        height=float(page.rect.height),
                        text_excerpt=page_text[:1200],
                        tokens=word_tokens,
                    )
                )
        finally:
            document.close()

        raw_text_preview = "\n".join(fragment for fragment in raw_text_fragments if fragment).strip()[:4000]
        return pages, warnings, raw_text_preview

    def _get_reader(self, languages: list[str]):
        if self._reader is not None and getattr(self, "_last_languages", None) == languages:
            return self._reader

        try:
            # pyrefly: ignore [missing-import]
            import easyocr
        except ImportError:
            return None

        self._reader = easyocr.Reader(languages, gpu=self._settings.easyocr_gpu)
        self._last_languages = languages
        return self._reader

    def _tokens_from_text_layer(self, page: fitz.Page, *, page_number: int) -> list[OCRToken]:
        tokens: list[OCRToken] = []

        for word in page.get_text("words"):
            x0, y0, x1, y1, text, *_ = word
            clean_text = text.strip()
            if not clean_text:
                continue

            tokens.append(
                OCRToken(
                    text=clean_text,
                    confidence=1.0,
                    bbox=BoundingBox(x0=x0, y0=y0, x1=x1, y1=y1),
                    page_number=page_number,
                )
            )

        return tokens

    def _tokens_from_ocr(self, *, easyocr_reader, page: fitz.Page, page_number: int) -> list[OCRToken]:
        try:
            import numpy as np
        except ImportError as exc:
            raise AppException(
                status_code=500,
                code="numpy_missing",
                message="EasyOCR dependencies are incomplete in the runtime environment.",
                details={"reason": str(exc)},
            ) from exc

        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
        results = easyocr_reader.readtext(np.array(image), detail=1)
        tokens: list[OCRToken] = []

        for bbox_points, text, confidence in results:
            clean_text = text.strip()
            if not clean_text:
                continue

            xs = [point[0] for point in bbox_points]
            ys = [point[1] for point in bbox_points]
            tokens.append(
                OCRToken(
                    text=clean_text,
                    confidence=float(confidence),
                    bbox=BoundingBox(
                        x0=float(min(xs)),
                        y0=float(min(ys)),
                        x1=float(max(xs)),
                        y1=float(max(ys)),
                    ),
                    page_number=page_number,
                )
            )

        return tokens
