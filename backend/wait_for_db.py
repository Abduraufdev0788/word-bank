import asyncio
import logging
import os
import sys

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wait_for_db")


async def wait_for_database(max_retries: int = 45, delay_seconds: float = 2.0) -> None:
    """
    Polls the database until it is accepting queries and ready for migrations.
    Prevents crash-loops on container/server reboot when PostgreSQL is initializing.
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        from app.core.config import settings
        db_url = settings.DATABASE_URL

    logger.info("Checking database availability (max %d retries)...", max_retries)

    for attempt in range(1, max_retries + 1):
        try:
            engine = create_async_engine(db_url, pool_pre_ping=True)
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            logger.info("Database is ready! Connection verified on attempt %d.", attempt)
            return
        except Exception as exc:
            logger.warning(
                "Database not ready yet (attempt %d/%d): %s. Retrying in %.1fs...",
                attempt,
                max_retries,
                exc,
                delay_seconds,
            )
            await asyncio.sleep(delay_seconds)

    logger.error("Failed to connect to database after %d attempts.", max_retries)
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(wait_for_database())
