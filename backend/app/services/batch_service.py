import uuid
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.vocabulary import Word, WordBatch


async def get_or_create_destination_batch(
    user_id: uuid.UUID,
    db: AsyncSession,
    fill_incomplete: bool = True,
    source_file_name: Optional[str] = None,
) -> WordBatch:
    """Finds the latest incomplete batch (< MAX_WORDS_PER_BATCH) or creates a new one."""
    if fill_incomplete:
        stmt = (
            select(WordBatch)
            .where(
                WordBatch.user_id == user_id,
                WordBatch.is_complete == False,
                WordBatch.word_count < settings.MAX_WORDS_PER_BATCH,
            )
            .order_by(WordBatch.batch_number.desc())
            .limit(1)
        )
        existing_batch = (await db.execute(stmt)).scalar_one_or_none()
        if existing_batch:
            return existing_batch

    # Calculate next batch number for user
    max_stmt = select(func.max(WordBatch.batch_number)).where(WordBatch.user_id == user_id)
    max_num = (await db.execute(max_stmt)).scalar() or 0
    next_batch_num = max_num + 1

    new_batch = WordBatch(
        user_id=user_id,
        batch_number=next_batch_num,
        title=f"{next_batch_num}-to'plam",
        source_file_name=source_file_name,
        status="new",
        word_count=0,
        is_complete=False,
    )
    db.add(new_batch)
    await db.flush()
    return new_batch


async def recalculate_batch_status(batch_id: uuid.UUID, db: AsyncSession) -> None:
    """Recalculates word_count and is_complete flag for a batch."""
    batch_stmt = select(WordBatch).where(WordBatch.id == batch_id)
    batch = (await db.execute(batch_stmt)).scalar_one_or_none()
    if not batch:
        return

    count_stmt = select(func.count(Word.id)).where(Word.batch_id == batch_id)
    actual_count = (await db.execute(count_stmt)).scalar() or 0

    batch.word_count = actual_count
    batch.is_complete = actual_count >= settings.MAX_WORDS_PER_BATCH
    if actual_count > 0 and batch.status == "new":
        batch.status = "learning"
    elif actual_count == 0:
        batch.status = "new"

    await db.flush()
