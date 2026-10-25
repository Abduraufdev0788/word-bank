import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings

# Configure structured application logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("aiosqlite").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger("smartvocab")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up %s in %s mode...", settings.PROJECT_NAME, settings.ENVIRONMENT)
    if "sqlite" in settings.DATABASE_URL:
        from app.core.database import async_engine, Base
        import app.models  # noqa: F401
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("SQLite database tables verified/created.")
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SmartVocab AI — Spaced Repetition vocabulary learning backend with Gemini AI & Telegram sync",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Set CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", status_code=status.HTTP_200_OK, tags=["Salomatlik"])
@app.get(f"{settings.API_V1_PREFIX}/health", status_code=status.HTTP_200_OK, tags=["Salomatlik"])
async def health_check():
    """Health check endpoint for container orchestrators and reverse proxies."""
    return JSONResponse(
        content={
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "environment": settings.ENVIRONMENT,
            "version": "1.0.0",
        }
    )
