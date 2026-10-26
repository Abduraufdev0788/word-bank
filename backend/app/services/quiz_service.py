import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.learning import DailyActivity, QuizAttempt, QuizQuestion
from app.models.vocabulary import Word, WordProgress


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def create_quiz_session(
    user_id: uuid.UUID,
    db: AsyncSession,
    quiz_type: str = "batch",
    batch_id: Optional[uuid.UUID] = None,
) -> Tuple[QuizAttempt, List[Dict[str, Any]]]:
    """Creates a secure anti-cheat quiz attempt where correct answers remain server-side."""
    # 1. Fetch eligible words
    stmt = select(Word).where(Word.user_id == user_id)
    if quiz_type == "batch" and batch_id:
        stmt = stmt.where(Word.batch_id == batch_id)
    elif quiz_type == "weak_words":
        stmt = stmt.join(WordProgress, Word.id == WordProgress.word_id).where(
            WordProgress.is_weak == True
        )

    words_result = await db.execute(stmt)
    words = list(words_result.scalars().all())

    # Need at least 4 user words for realistic 4-option distractors
    all_words_stmt = select(Word.uzbek_translation).where(Word.user_id == user_id)
    all_translations_res = await db.execute(all_words_stmt)
    all_translations = list(set(all_translations_res.scalars().all()))

    if len(words) < 2 or len(all_translations) < 4:
        raise ValueError("Test yaratish uchun lug'atingizda kamida 4 ta so'z bo'lishi kerak")

    # Limit to maximum 20 questions
    random.shuffle(words)
    selected_words = words[:20]

    # Create QuizAttempt
    attempt = QuizAttempt(
        user_id=user_id,
        batch_id=batch_id,
        quiz_type=quiz_type,
        total_questions=len(selected_words),
        correct_answers=0,
        score_percent=0.0,
        status="in_progress",
        started_at=utc_now(),
    )
    db.add(attempt)
    await db.flush()

    client_questions: List[Dict[str, Any]] = []

    # Build questions with server-side answers and client-side options
    for word in selected_words:
        correct_ans = word.uzbek_translation.strip()
        # Pick 3 distractors
        distractor_pool = [t.strip() for t in all_translations if t.strip().lower() != correct_ans.lower()]
        if len(distractor_pool) < 3:
            distractors = distractor_pool + ["Boshqa ma'no", "Noma'lum", "Qo'shimcha"][:3 - len(distractor_pool)]
        else:
            distractors = random.sample(distractor_pool, 3)

        options = [correct_ans] + distractors
        random.shuffle(options)

        question = QuizQuestion(
            quiz_attempt_id=attempt.id,
            word_id=word.id,
            question_text=f"'{word.english_word}' so'zining to'g'ri o'zbekcha tarjimasi qaysi?",
            options=options,
            correct_answer=correct_ans,  # Authoritative answer stored in database!
        )
        db.add(question)
        await db.flush()

        # Payload returned to client: STRICTLY WITHOUT correct_answer!
        client_questions.append({
            "id": str(question.id),
            "word_id": str(word.id),
            "english_word": word.english_word,
            "question_text": question.question_text,
            "options": question.options,
        })

    await db.commit()
    await db.refresh(attempt)
    return attempt, client_questions


async def answer_quiz_question(
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
    selected_option: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Dict[str, Any]:
    """Validates answer on backend and updates authoritative score."""
    stmt = (
        select(QuizQuestion, QuizAttempt)
        .join(QuizAttempt, QuizQuestion.quiz_attempt_id == QuizAttempt.id)
        .where(
            QuizQuestion.id == question_id,
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
        )
    )
    result = (await db.execute(stmt)).first()
    if not result:
        raise ValueError("Savol topilmadi yoki ushbu foydalanuvchiga tegishli emas")

    question, attempt = result
    if attempt.status != "in_progress":
        raise ValueError("Test yakunlangan yoki bekor qilingan")

    if question.user_selected is not None:
        raise ValueError("Ushbu savolga allaqachon javob berilgan")

    is_correct = selected_option.strip().lower() == question.correct_answer.strip().lower()
    now = utc_now()

    question.user_selected = selected_option.strip()
    question.is_correct = is_correct
    question.answered_at = now

    if is_correct:
        attempt.correct_answers += 1

    # Record review in SM-2 and WordProgress
    from app.services.srs_service import process_word_review
    await process_word_review(
        user_id=user_id,
        word_id=question.word_id,
        quality_rating=5 if is_correct else 1,
        review_type="quiz",
        review_source="web",
        user_answer=selected_option,
        time_spent_ms=0,
        db=db,
    )

    await db.commit()

    return {
        "question_id": str(question.id),
        "is_correct": is_correct,
        "selected_option": selected_option,
        "correct_answer": question.correct_answer,
    }


async def finalize_quiz_attempt(
    attempt_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> QuizAttempt:
    """Calculates final score and records quiz in daily activity."""
    stmt = (
        select(QuizAttempt)
        .options(selectinload(QuizAttempt.questions))
        .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
    )
    attempt = (await db.execute(stmt)).scalar_one_or_none()
    if not attempt:
        raise ValueError("Test sessiyasi topilmadi")

    if attempt.total_questions > 0:
        attempt.score_percent = round((attempt.correct_answers / attempt.total_questions) * 100, 1)
    else:
        attempt.score_percent = 0.0

    attempt.status = "completed"
    attempt.completed_at = utc_now()

    # Increment daily activity
    today = attempt.completed_at.date()
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
            words_reviewed=0,
            quizzes_taken=1,
            streak_day_count=1,
        )
        db.add(activity)
    else:
        activity.quizzes_taken += 1

    await db.commit()
    await db.refresh(attempt)
    return attempt
