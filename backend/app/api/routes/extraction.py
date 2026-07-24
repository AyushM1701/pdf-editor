
from uuid import uuid4
import asyncio
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse
import json

from app.core.rate_limit import limiter
from app.core.dependencies import get_extraction_service
from app.schemas.extraction import ExtractionRequest, ExtractionJobResponse, JobStatus
from app.services.extraction_service import DocumentExtractionService
from app.core.auth import get_api_key
from app.core.config import get_settings

router = APIRouter(prefix="/extraction", tags=["extraction"])

@router.post("/run", response_model=ExtractionJobResponse)
@limiter.limit("5/minute")
async def run_extraction(
    request: Request,
    payload: ExtractionRequest,
    api_key: str | None = Depends(get_api_key),
) -> ExtractionJobResponse:
    job_id = str(uuid4())
    redis = request.app.state.redis
    
    if api_key:
        await redis.set(f"job_owner:{job_id}", api_key, ex=3600)
        
    await redis.enqueue_job("extract_task", job_id, payload.model_dump(), _job_id=job_id)

    return ExtractionJobResponse(job_id=job_id, status=JobStatus.processing, message="Initializing background task...")


@router.get("/status/{job_id}", response_model=ExtractionJobResponse)
async def get_extraction_status(job_id: str, request: Request, api_key: str | None = Depends(get_api_key)) -> ExtractionJobResponse:
    # Since we are using Redis Pub/Sub for streams, we don't store the current state persistently
    # other than what arq stores. Let's get the job from arq.
    from arq.jobs import Job
    redis = request.app.state.redis
    
    owner = await redis.get(f"job_owner:{job_id}")
    if owner:
        owner = owner.decode("utf-8")
    if owner and api_key and owner != api_key:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job = Job(job_id, redis)
    status = await job.status()
    from arq.constants import JobStatus as ArqJobStatus
    
    if status == ArqJobStatus.not_found:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job_status_enum = JobStatus.processing
    if status == ArqJobStatus.complete:
        job_status_enum = JobStatus.completed
    elif status == ArqJobStatus.deferred or status == ArqJobStatus.queued or status == ArqJobStatus.in_progress:
        job_status_enum = JobStatus.processing
        
    result_dict = None
    if status == ArqJobStatus.complete:
        try:
            result_data = await job.result()
            if result_data:
                result_dict = result_data
        except Exception:
            job_status_enum = JobStatus.failed

    return ExtractionJobResponse(
        job_id=job_id,
        status=job_status_enum,
        message=None,
        result=result_dict,
        error=None,
    )

@router.get("/stream/{job_id}")
async def extraction_stream(request: Request, job_id: str, api_key: str | None = Depends(get_api_key), api_key_query: str | None = None):
    redis = request.app.state.redis
    
    # EventSource cannot set custom headers, so also accept the API key from a query param.
    effective_api_key = api_key or api_key_query
    
    owner = await redis.get(f"job_owner:{job_id}")
    if owner:
        owner = owner.decode("utf-8")
    if owner and effective_api_key and owner != effective_api_key:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        yield f"data: {json.dumps({'job_id': job_id, 'status': 'processing'})}\n\n"
        
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"job_updates:{job_id}")
        
        try:
            while True:
                if await request.is_disconnected():
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if message is not None:
                    data = message["data"].decode("utf-8")
                    yield f"data: {data}\n\n"
                    
                    data_obj = json.loads(data)
                    if data_obj.get("status") in ["completed", "failed"]:
                        break
                else:
                    yield ": heartbeat\n\n"
        finally:
            await pubsub.unsubscribe(f"job_updates:{job_id}")
            await pubsub.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/batch-run", response_model=list[ExtractionJobResponse])
@limiter.limit("5/minute")
async def batch_run_extraction(
    request: Request,
    payloads: list[ExtractionRequest],
    api_key: str | None = Depends(get_api_key),
) -> list[ExtractionJobResponse]:
    if len(payloads) > 3:
        raise HTTPException(status_code=400, detail="Too many payloads in a single batch (max 3).")
    
    responses = []
    redis = request.app.state.redis
    
    for payload in payloads:
        job_id = str(uuid4())
        if api_key:
            await redis.set(f"job_owner:{job_id}", api_key, ex=3600)
            
        await redis.enqueue_job("extract_task", job_id, payload.model_dump(), _job_id=job_id)
        
        responses.append(
            ExtractionJobResponse(
                job_id=job_id, 
                status=JobStatus.processing, 
                message="Initializing background task..."
            )
        )
    return responses
