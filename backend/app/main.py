from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
load_dotenv()

from app.api.routes import extraction, health, storage, tools
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.auth import get_api_key
from fastapi import Depends
from app.core.rate_limit import limiter, _rate_limit_exceeded_handler, RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from contextlib import asynccontextmanager
from arq import create_pool
from arq.connections import RedisSettings

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    yield
    await app.state.redis.close()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    summary="Hybrid PDF API for presigned upload and document extraction.",
    docs_url=None,
    openapi_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)

register_exception_handlers(app)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(
    storage.router,
    prefix=settings.api_prefix,
    dependencies=[Depends(get_api_key)],
)
app.include_router(
    extraction.router,
    prefix=settings.api_prefix,
    dependencies=[Depends(get_api_key)],
)
app.include_router(
    tools.router,
    prefix=f"{settings.api_prefix}/tools",
    dependencies=[Depends(get_api_key)],
)

from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

@app.get("/docs", include_in_schema=False, dependencies=[Depends(get_api_key)])
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=app.title + " - Swagger UI",
    )

@app.get("/openapi.json", include_in_schema=False, dependencies=[Depends(get_api_key)])
async def get_custom_openapi():
    return get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
    )
