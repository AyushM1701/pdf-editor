import hmac
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from app.core.config import get_settings, Settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def get_api_key(
    api_key: str | None = Depends(api_key_header),
    settings: Settings = Depends(get_settings),
) -> str | None:
    if not settings.api_key:
        return None  # Auth is disabled

    if api_key is None or not hmac.compare_digest(api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    return api_key
