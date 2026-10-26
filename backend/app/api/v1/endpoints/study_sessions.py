import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.learning import (
    StudySessionOut,
    StudySessionStartRequest,
    StudyTimeSummaryOut,
)
from app.services.study_tracker import (
    end_study_session,
    get_study_time_summary,
    record_study_heartbeat,
    start_study_session,
)

router = APIRouter()


@router.post(
    "/start",
    response_model=StudySessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Faol o'rganish sessiyasini boshlash",
)
async def start_session(
    session_in: StudySessionStartRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Initiates an active study session with heartbeat tracking."""
    session = await start_study_session(
        user_id=current_user.id,
        activity_type=session_in.activity_type,
        source=session_in.source,
        db=db,
    )
    return session


@router.post(
    "/{session_id}/heartbeat",
    response_model=StudySessionOut,
    summary="Faollik heartbeat signalini yuborish (Har 30 soniyada)",
)
async def heartbeat(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Accumulates active study time if heartbeat arrived within idle cutoff window."""
    try:
        session = await record_study_heartbeat(
            session_id=session_id,
            user_id=current_user.id,
            db=db,
        )
        return session
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/{session_id}/end",
    response_model=StudySessionOut,
    summary="O'rganish sessiyasini to'xtatish",
)
async def stop_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Concludes the study session."""
    try:
        session = await end_study_session(
            session_id=session_id,
            user_id=current_user.id,
            db=db,
        )
        return session
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/stats",
    response_model=StudyTimeSummaryOut,
    summary="Foydalanuvchining bugungi, haftalik va jami faol o'rganish vaqti",
)
@router.get(
    "/summary",
    response_model=StudyTimeSummaryOut,
    include_in_schema=False,
)
async def get_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns aggregated active study time stats."""
    stats = await get_study_time_summary(
        user_id=current_user.id,
        db=db,
    )
    return StudyTimeSummaryOut(**stats)
