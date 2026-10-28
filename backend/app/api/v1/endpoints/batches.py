import uuid
from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import Word, WordBatch, WordProgress
from app.schemas.vocabulary import (
    WordBatchCreate,
    WordBatchDetailOut,
    WordBatchOut,
    WordBatchUpdate,
)
from app.services.batch_service import recalculate_batch_status

router = APIRouter()


@router.post(
    "",
    response_model=WordBatchOut,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi to'plam yaratish yoki mavjud nomlisini olish",
)
async def create_or_get_batch(
    batch_in: WordBatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Finds or creates a batch with the specified title (e.g. named after a story)."""
    title = batch_in.title.strip()
    if not batch_in.force_new:
        stmt = (
            select(WordBatch)
            .where(
                WordBatch.user_id == current_user.id,
                func.lower(WordBatch.title) == title.lower(),
                WordBatch.is_complete == False,
            )
            .order_by(WordBatch.batch_number.desc())
            .limit(1)
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

    max_stmt = select(func.max(WordBatch.batch_number)).where(WordBatch.user_id == current_user.id)
    max_num = (await db.execute(max_stmt)).scalar() or 0
    next_num = max_num + 1

    final_title = title if title else f"To'plam #{next_num}"

    new_batch = WordBatch(
        user_id=current_user.id,
        batch_number=next_num,
        title=final_title,
        status="new",
        word_count=0,
        is_complete=False,
    )
    db.add(new_batch)
    await db.commit()
    await db.refresh(new_batch)
    return new_batch


@router.get(
    "",
    response_model=List[WordBatchOut],
    summary="Foydalanuvchining barcha to'plamlarini olish",
)
async def list_batches(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Lists all 20-word batches for the authenticated user."""
    stmt = (
        select(WordBatch)
        .where(WordBatch.user_id == current_user.id)
        .order_by(WordBatch.batch_number.asc())
    )
    result = await db.execute(stmt)
    batches = result.scalars().all()

    now = datetime.now(timezone.utc)
    # Query due counts per batch
    due_stmt = (
        select(Word.batch_id, func.count(Word.id))
        .join(WordProgress, Word.id == WordProgress.word_id)
        .where(
            Word.user_id == current_user.id,
            WordProgress.due_date <= now,
        )
        .group_by(Word.batch_id)
    )
    due_result = await db.execute(due_stmt)
    due_map = {b_id: count for b_id, count in due_result.all()}

    output = []
    for b in batches:
        b_dict = WordBatchOut.model_validate(b)
        b_dict.due_count = due_map.get(b.id, 0)
        output.append(b_dict)

    return output


@router.get(
    "/{batch_id}",
    response_model=WordBatchDetailOut,
    summary="To'plam tafsilotlari va so'zlarini olish",
)
async def get_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Gets batch detail including all its words (enforcing user ownership)."""
    stmt = (
        select(WordBatch)
        .options(selectinload(WordBatch.words).selectinload(Word.progress))
        .where(
            WordBatch.id == batch_id,
            WordBatch.user_id == current_user.id,
        )
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="To'plam topilmadi",
        )
    return batch


@router.put(
    "/{batch_id}",
    response_model=WordBatchOut,
    summary="To'plam nomini o'zgartirish",
)
async def update_batch(
    batch_id: uuid.UUID,
    batch_in: WordBatchUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Updates batch title."""
    stmt = select(WordBatch).where(
        WordBatch.id == batch_id,
        WordBatch.user_id == current_user.id,
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="To'plam topilmadi",
        )

    if batch_in.title is not None and batch_in.title.strip():
        batch.title = batch_in.title.strip()

    if batch_in.is_complete is not None:
        batch.is_complete = batch_in.is_complete

    await db.commit()
    await db.refresh(batch)
    return batch


@router.delete(
    "/{batch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="To'plamni o'chirish",
)
async def delete_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deletes a batch and cascades to contained words."""
    stmt = select(WordBatch).where(
        WordBatch.id == batch_id,
        WordBatch.user_id == current_user.id,
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="To'plam topilmadi",
        )

    await db.delete(batch)
    await db.commit()
