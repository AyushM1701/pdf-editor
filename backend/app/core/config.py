from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hybrid PDF API"
    api_prefix: str = "/api"
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "hybrid-pdf-documents"
    presigned_url_expiration: int = 900
    document_ai_model_name: str = ""
    hf_pipeline_task: str = "text-classification"
    hf_device: int = -1
    easyocr_gpu: bool = False
    cors_origins: list[str] = ["http://localhost:5173"]
    gemini_api_key: str = ""
    gemini_model_name: str = "gemini-2.5-flash"
    use_local_storage: bool = True
    max_upload_bytes: int = 50 * 1024 * 1024
    api_key: str = ""
    rate_limit_per_minute: int = 30
    redis_url: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            import json
            try:
                # Try to parse it as a JSON array first
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except json.JSONDecodeError:
                pass
            # Fallback to comma-separated
            return [item.strip() for item in value.split(",") if item.strip()]

        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
