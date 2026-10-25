from datetime import datetime, timedelta, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import Word, WordProgress
from app.schemas.learning import DueWordReviewOut, ReviewSubmission, ReviewSubmissionResponse
from app.services.srs_service import process_word_review

router = APIRouter()


@router.get(
    "/queue",
    response_model=List[DueWordReviewOut],
    summary="Bugungi takrorlash navbatidagi so'zlar ro'yxatini olish",
)
async def get_due_review_queue(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns words whose due_date is in the past or now."""
    now = datetime.now(timezone.utc) + timedelta(seconds=5)
    stmt = (
        select(
            Word.id,
            Word.english_word,
            Word.uzbek_translation,
            Word.part_of_speech,
            Word.phonetic,
            Word.batch_id,
            WordProgress.due_date,
            WordProgress.repetition_number,
            WordProgress.is_weak,
        )
        .join(WordProgress, Word.id == WordProgress.word_id)
        .where(
            Word.user_id == current_user.id,
            WordProgress.due_date <= now,
        )
        .order_by(WordProgress.due_date.asc())
        .limit(100)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        DueWordReviewOut(
            id=r.id,
            english_word=r.english_word,
            uzbek_translation=r.uzbek_translation,
            part_of_speech=r.part_of_speech,
            phonetic=r.phonetic,
            batch_id=r.batch_id,
            due_date=r.due_date,
            repetition_number=r.repetition_number,
            is_weak=r.is_weak,
        )
        for r in rows
    ]


@router.post(
    "/submit",
    response_model=ReviewSubmissionResponse,
    summary="So'z takrorlash natijasini yuborish (SM-2)",
)
async def submit_review(
    review_in: ReviewSubmission,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Processes SM-2 review rating, updates interval and schedules next review."""
    try:
        progress, review = await process_word_review(
            user_id=current_user.id,
            word_id=review_in.word_id,
            quality_rating=review_in.quality_rating,
            review_source=review_in.review_source,
            review_type=review_in.review_type,
            user_answer=review_in.user_answer,
            time_spent_ms=review_in.time_spent_ms,
            db=db,
        )
        return ReviewSubmissionResponse(
            word_id=progress.word_id,
            is_correct=review.is_correct,
            repetition_number=progress.repetition_number,
            new_interval_days=progress.interval_days,
            new_ease_factor=progress.ease_factor,
            new_due_date=progress.due_date,
            is_mastered=progress.is_mastered,
            is_weak=progress.is_weak,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
