import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning import DailyActivity, WordReview
from app.models.vocabulary import Word, WordProgress


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def calculate_sm2(
    quality: int,
    repetition_number: int,
    ease_factor: float,
    interval_days: int,
) -> Tuple[int, float, int]:
    """Calculates updated repetition_number, ease_factor, and interval_days using SM-2 algorithm.

    quality: 0 (complete failure) to 5 (perfect recall)
    """
    quality = max(0, min(5, quality))

    # Calculate new Ease Factor
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, round(new_ef, 2))

    if quality < 3:
        # Failure: restart interval
        new_repetition = 0
        new_interval = 1
    else:
        # Success: increment interval
        if repetition_number == 0:
            new_interval = 1
        elif repetition_number == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(interval_days * new_ef))
        new_repetition = repetition_number + 1

    return new_repetition, new_ef, new_interval


async def process_word_review(
    user_id: uuid.UUID,
    word_id: uuid.UUID,
    quality_rating: int,
    review_source: str,
    review_type: str,
    db: AsyncSession,
    user_answer: Optional[str] = None,
    time_spent_ms: int = 0,
) -> Tuple[WordProgress, WordReview]:
    """Submits a review result, updates word progress via SM-2, and logs an immutable review record."""
    # Find word and progress
    stmt = (
        select(Word, WordProgress)
        .join(WordProgress, Word.id == WordProgress.word_id)
        .where(Word.id == word_id, Word.user_id == user_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise ValueError("So'z topilmadi yoki foydalanuvchiga tegishli emas")

    word, progress = row
    is_correct = quality_rating >= 3
    now = utc_now()

    # Calculate SM-2 update
    new_rep, new_ef, new_interval = calculate_sm2(
        quality=quality_rating,
        repetition_number=progress.repetition_number,
        ease_factor=progress.ease_factor,
        interval_days=progress.interval_days,
    )

    # Update progress
    progress.repetition_number = new_rep
    progress.ease_factor = new_ef
    progress.interval_days = new_interval
    progress.due_date = now + timedelta(days=new_interval)
    progress.last_reviewed_at = now
    progress.times_reviewed += 1
    if is_correct:
        progress.times_correct += 1
    else:
        progress.times_incorrect += 1

    # Check mastery & weakness
    if progress.repetition_number >= 5 and (progress.times_correct / progress.times_reviewed) >= 0.8:
        progress.is_mastered = True
    else:
        progress.is_mastered = False

    if progress.times_incorrect >= 2 and (progress.times_incorrect / progress.times_reviewed) >= 0.4:
        progress.is_weak = True
    elif (progress.times_correct / max(1, progress.times_reviewed)) >= 0.7:
        progress.is_weak = False

    # Create immutable review record
    review = WordReview(
        user_id=user_id,
        word_id=word_id,
        review_source=review_source,
        review_type=review_type,
        quality_rating=quality_rating,
        is_correct=is_correct,
        user_answer=user_answer,
        time_spent_ms=time_spent_ms,
        created_at=now,
    )
    db.add(review)

    # Update or create DailyActivity
    today = now.date()
    act_stmt = select(DailyActivity).where(
        DailyActivity.user_id == user_id,
        DailyActivity.activity_date == today,
    )
    activity = (await db.execute(act_stmt)).scalar_one_or_none()
    if not activity:
        activity = DailyActivity(
            user_id=user_id,
            activity_date=today,
            total_active_seconds=0,
            words_learned=0,
            words_reviewed=1,
            quizzes_taken=0,
            streak_day_count=1,
        )
        db.add(activity)
    else:
        activity.words_reviewed += 1

    await db.commit()
    await db.refresh(progress)
    await db.refresh(review)
    return progress, review
