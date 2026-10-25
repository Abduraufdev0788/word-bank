import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.learning import QuizAttempt
from app.models.user import User
from app.schemas.learning import (
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizQuestionClientOut,
    QuizStartRequest,
    QuizStartResponse,
    QuizSummaryOut,
)
from app.services.quiz_service import (
    answer_quiz_question,
    create_quiz_session,
    finalize_quiz_attempt,
)

router = APIRouter()


@router.post(
    "/start",
    response_model=QuizStartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi xavfsiz test sessiyasini boshlash (Anti-Cheat)",
)
async def start_quiz(
    quiz_in: QuizStartRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Generates a secure quiz session where correct answers remain server-side."""
    try:
        attempt, client_questions = await create_quiz_session(
            user_id=current_user.id,
            db=db,
            quiz_type=quiz_in.quiz_type,
            batch_id=quiz_in.batch_id,
        )
        return QuizStartResponse(
            attempt_id=attempt.id,
            quiz_type=attempt.quiz_type,
            total_questions=attempt.total_questions,
            questions=[QuizQuestionClientOut(**q) for q in client_questions],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/{attempt_id}/answer",
    response_model=QuizAnswerResponse,
    summary="Test savoliga javob berish va natijani olish",
)
async def submit_quiz_answer(
    attempt_id: uuid.UUID,
    answer_in: QuizAnswerRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Evaluates question answer on the server and updates authoritative score."""
    try:
        result = await answer_quiz_question(
            attempt_id=attempt_id,
            question_id=answer_in.question_id,
            selected_option=answer_in.selected_option,
            user_id=current_user.id,
            db=db,
        )
        return QuizAnswerResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/{attempt_id}/complete",
    response_model=QuizSummaryOut,
    summary="Testni yakunlash va yakuniy ballni hisoblash",
)
async def complete_quiz(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Finalizes quiz attempt and returns summary score."""
    try:
        attempt = await finalize_quiz_attempt(
            attempt_id=attempt_id,
            user_id=current_user.id,
            db=db,
        )
        return QuizSummaryOut(
            id=attempt.id,
            total_questions=attempt.total_questions,
            correct_answers=attempt.correct_answers,
            score_percent=attempt.score_percent,
            status=attempt.status,
            completed_at=attempt.completed_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/{attempt_id}",
    response_model=QuizSummaryOut,
    summary="Test sessiyasi tafsilotlarini ko'rish",
)
async def get_quiz(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns quiz attempt summary."""
    stmt = select(QuizAttempt).where(
        QuizAttempt.id == attempt_id,
        QuizAttempt.user_id == current_user.id,
    )
    attempt = (await db.execute(stmt)).scalar_one_or_none()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test topilmadi",
        )
    return QuizSummaryOut(
        id=attempt.id,
        total_questions=attempt.total_questions,
        correct_answers=attempt.correct_answers,
        score_percent=attempt.score_percent,
        status=attempt.status,
        completed_at=attempt.completed_at,
    )
