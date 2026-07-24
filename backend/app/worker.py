import json
import asyncio
from typing import Any
from arq.connections import RedisSettings
from app.core.config import get_settings
from app.schemas.extraction import ExtractionRequest, JobStatus
from app.core.dependencies import get_extraction_service

async def extract_task(ctx: dict[str, Any], job_id: str, payload_dict: dict[str, Any]) -> dict[str, Any]:
    redis = ctx['redis']
    
    # Send an initial progress update
    await redis.publish(
        f"job_updates:{job_id}", 
        json.dumps({
            "status": JobStatus.processing.value,
            "message": "Initializing background task..."
        })
    )
    
    # Capture the event loop *before* entering the executor thread,
    # because asyncio.get_running_loop() is unavailable inside threads.
    loop = asyncio.get_running_loop()

    def progress_callback(message: str):
        # Fire-and-forget from the synchronous extraction code running in the executor.
        asyncio.run_coroutine_threadsafe(
            redis.publish(
                f"job_updates:{job_id}",
                json.dumps({
                    "status": JobStatus.processing.value,
                    "message": message
                })
            ),
            loop
        )

    try:
        service = get_extraction_service()
        payload = ExtractionRequest(**payload_dict)
        
        result = await loop.run_in_executor(
            None,
            lambda: service.extract_from_object(payload, progress_callback=progress_callback)
        )
        
        result_dict = result.model_dump(mode="json")
        await redis.publish(
            f"job_updates:{job_id}",
            json.dumps({
                "status": JobStatus.completed.value,
                "message": "Extraction complete",
                "result": result_dict
            })
        )
        return result_dict
    except Exception as exc:
        error_msg = str(exc)
        await redis.publish(
            f"job_updates:{job_id}",
            json.dumps({
                "status": JobStatus.failed.value,
                "message": "Extraction failed",
                "error": error_msg
            })
        )
        raise

async def startup(ctx: dict[str, Any]) -> None:
    pass

async def shutdown(ctx: dict[str, Any]) -> None:
    pass

settings = get_settings()

class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [extract_task]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 4 # Concurrency limit replacement for Semaphore
