from datetime import UTC, datetime
from pathlib import Path
from re import sub


def build_object_key(*, file_name: str, document_kind: str) -> str:
    """Build a unique, sanitized S3/local storage key for an uploaded document."""
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    sanitized_stem = sub(r"[^a-zA-Z0-9_-]+", "-", Path(file_name).stem).strip("-")
    safe_stem = sanitized_stem or "document"

    return f"uploads/{document_kind}/{timestamp}-{safe_stem}.pdf"
