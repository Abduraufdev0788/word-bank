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
    question_count: int = 20,
    direction: str = "en_to_uz",
) -> Tuple[QuizAttempt, List[Dict[str, Any]]]:
    """Creates a secure anti-cheat quiz attempt where correct answers remain server-side."""
    # 1. Fetch eligible words based on quiz type
    stmt = select(Word).where(Word.user_id == user_id)
    if quiz_type == "batch" and batch_id:
        stmt = stmt.where(Word.batch_id == batch_id)
    elif quiz_type in ["mastered_50", "mastered"]:
        # Known/mastered words
        stmt = (
            stmt.join(WordProgress, Word.id == WordProgress.word_id)
            .where(
                (WordProgress.is_mastered == True)
                | ((WordProgress.times_correct >= 1) & (WordProgress.is_weak == False))
            )
        )
    elif quiz_type == "weak_words":
        stmt = stmt.join(WordProgress, Word.id == WordProgress.word_id).where(
            WordProgress.is_weak == True
        )
    elif quiz_type in ["all_50", "all", "vocabulary_wide"]:
        # All words in user's dictionary
        stmt = stmt

    words_result = await db.execute(stmt)
    words = list(words_result.scalars().all())

    # If mastered_50 requested but fewer words available, supplement with all user words
    if quiz_type in ["mastered_50", "mastered"] and len(words) < question_count:
        existing_ids = [w.id for w in words]
        supplement_stmt = select(Word).where(
            Word.user_id == user_id,
            Word.id.not_in(existing_ids) if existing_ids else True,
        )
        sup_res = await db.execute(supplement_stmt)
        words.extend(sup_res.scalars().all())

    # Fetch pool for distractors
    all_words_stmt = select(Word).where(Word.user_id == user_id)
    all_words_res = await db.execute(all_words_stmt)
    all_user_words = list(all_words_res.scalars().all())

    all_translations = list(set(w.uzbek_translation.strip() for w in all_user_words if w.uzbek_translation))
    all_english_words = list(set(w.english_word.strip() for w in all_user_words if w.english_word))

    if len(words) < 2 or (len(all_translations) < 4 and len(all_english_words) < 4):
        raise ValueError("Test yaratish uchun lug'atingizda kamida 4 ta so'z bo'lishi kerak")

    # Limit to requested question_count (up to 50)
    target_count = min(question_count, len(words))
    random.shuffle(words)
    selected_words = words[:target_count]

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

    fallback_distractors_en = ["success", "experience", "development", "confidence", "patience", "courage", "knowledge"]
    fallback_distractors_uz = ["Muvaffaqiyat", "Tajriba", "Rivojlanish", "Ishonch", "Sabr", "Jasorat", "Bilim"]

    # Build questions with server-side answers and client-side options
    for word in selected_words:
        if direction == "uz_to_en":
            correct_ans = word.english_word.strip()
            prompt = word.uzbek_translation.strip()
            q_text = f"'{word.uzbek_translation}' so'zining to'g'ri inglizcha tarjimasi qaysi?"
            distractor_pool = [e for e in all_english_words if e.lower() != correct_ans.lower()]
            if len(distractor_pool) < 3:
                distractor_pool += [f for f in fallback_distractors_en if f.lower() != correct_ans.lower()]
        else:
            correct_ans = word.uzbek_translation.strip()
            prompt = word.english_word.strip()
            q_text = f"'{word.english_word}' so'zining to'g'ri o'zbekcha tarjimasi qaysi?"
            distractor_pool = [t for t in all_translations if t.lower() != correct_ans.lower()]
            if len(distractor_pool) < 3:
                distractor_pool += [f for f in fallback_distractors_uz if f.lower() != correct_ans.lower()]

        distractors = random.sample(distractor_pool, min(3, len(distractor_pool)))
        options = [correct_ans] + distractors
        random.shuffle(options)

        question = QuizQuestion(
            quiz_attempt_id=attempt.id,
            word_id=word.id,
            question_text=q_text,
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
            "prompt_text": prompt,
            "direction": direction,
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
    """Validates answer on backend with intelligent synonym verification and updates score."""
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

    # Fetch associated target word for deep synonym and alternative meaning checks
    word_stmt = select(Word).where(Word.id == question.word_id)
    target_word = (await db.execute(word_stmt)).scalar_one_or_none()

    clean_selected = selected_option.strip().lower()
    clean_correct = question.correct_answer.strip().lower()

    is_correct = clean_selected == clean_correct
    is_synonym = False
    synonym_note = None

    if not is_correct and target_word:
        from app.services.synonym_service import verify_english_answer
        # Check if user's answer is a valid English synonym or translation
        is_correct, is_synonym, synonym_note = await verify_english_answer(
            user_input=selected_option,
            target_word=target_word,
            user_id=user_id,
            db=db,
        )

    now = utc_now()

    question.user_selected = selected_option.strip()
    question.is_correct = is_correct
    question.answered_at = now

    if is_correct:
        attempt.correct_answers += 1

    # Record review in SM-2 and WordProgress
    from app.services.srs_service import process_word_review
    progress, _ = await process_word_review(
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
        "was_marked_weak": not is_correct,
        "is_synonym_match": is_synonym,
        "synonym_note": synonym_note,
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
    quiz_active_seconds = max(30, (attempt.total_questions or 1) * 15)

    if not activity:
        activity = DailyActivity(
            user_id=user_id,
            activity_date=today,
            total_active_seconds=quiz_active_seconds,
            words_learned=0,
            words_reviewed=0,
            quizzes_taken=1,
            streak_day_count=1,
        )
        db.add(activity)
    else:
        activity.quizzes_taken += 1
        activity.total_active_seconds += quiz_active_seconds

    await db.commit()
    await db.refresh(attempt)
    return attempt
