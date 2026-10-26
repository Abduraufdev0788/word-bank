import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.learning import DailyActivity, StudySession


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def start_study_session(
    user_id: uuid.UUID,
    activity_type: str,
    db: AsyncSession,
    source: str = "web",
) -> StudySession:
    """Starts a new study session and cleans up stale unclosed sessions."""
    now = utc_now()

    # Close any stale active sessions
    stale_cutoff = now - timedelta(minutes=settings.STUDY_SESSION_IDLE_TIMEOUT_MINUTES * 2)
    stale_stmt = select(StudySession).where(
        StudySession.user_id == user_id,
        StudySession.is_active == True,
        StudySession.last_heartbeat_at < stale_cutoff,
    )
    stale_sessions = (await db.execute(stale_stmt)).scalars().all()
    for s in stale_sessions:
        s.is_active = False
        s.ended_at = s.last_heartbeat_at

    new_session = StudySession(
        user_id=user_id,
        activity_type=activity_type,
        source=source,
        started_at=now,
        last_heartbeat_at=now,
        active_duration_seconds=0,
        is_active=True,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


async def record_study_heartbeat(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> StudySession:
    """Records an activity heartbeat (every 30s) and accumulates active study time."""
    stmt = select(StudySession).where(
        StudySession.id == session_id,
        StudySession.user_id == user_id,
        StudySession.is_active == True,
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if not session:
        raise ValueError("Faol o'rganish sessiyasi topilmadi")

    now = utc_now()
    last_hb = ensure_utc(session.last_heartbeat_at)
    delta = (now - last_hb).total_seconds() if last_hb else 0
    max_idle_seconds = settings.STUDY_SESSION_IDLE_TIMEOUT_MINUTES * 60

    added_seconds = 0
    if 0 < delta <= max_idle_seconds:
        # User was active; cap single step to reasonable upper bound (40s for 30s heartbeat)
        added_seconds = int(min(delta, 40))
        session.active_duration_seconds += added_seconds

    # Always update last heartbeat timestamp
    session.last_heartbeat_at = now

    # Accumulate into DailyActivity if seconds were gained
    if added_seconds > 0:
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
                total_active_seconds=added_seconds,
                words_learned=0,
                words_reviewed=0,
                quizzes_taken=0,
                streak_day_count=1,
            )
            db.add(activity)
        else:
            activity.total_active_seconds += added_seconds

    await db.commit()
    await db.refresh(session)
    return session


async def end_study_session(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> StudySession:
    """Explicitly concludes a study session and flushes any pending elapsed active time."""
    stmt = select(StudySession).where(
        StudySession.id == session_id,
        StudySession.user_id == user_id,
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if not session:
        raise ValueError("Sessiya topilmadi")

    now = utc_now()
    if session.is_active:
        last_hb = ensure_utc(session.last_heartbeat_at)
        delta = (now - last_hb).total_seconds() if last_hb else 0
        max_idle_seconds = settings.STUDY_SESSION_IDLE_TIMEOUT_MINUTES * 60
        if 0 < delta <= max_idle_seconds:
            # User was active right up until ending; flush remaining seconds (capped at 60s)
            remaining_seconds = int(min(delta, 60))
            if remaining_seconds > 0:
                session.active_duration_seconds += remaining_seconds

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
                        total_active_seconds=remaining_seconds,
                        words_learned=0,
                        words_reviewed=0,
                        quizzes_taken=0,
                        streak_day_count=1,
                    )
                    db.add(activity)
                else:
                    activity.total_active_seconds += remaining_seconds

    session.is_active = False
    session.ended_at = now
    session.last_heartbeat_at = now
    await db.commit()
    await db.refresh(session)
    return session


async def get_study_time_summary(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Dict[str, Any]:
    """Calculates today's, 7-day, and total accumulated active study time."""
    now = utc_now()
    today = now.date()
    seven_days_ago = today - timedelta(days=7)

    # Today's active seconds
    today_stmt = select(func.coalesce(func.sum(DailyActivity.total_active_seconds), 0)).where(
        DailyActivity.user_id == user_id,
        DailyActivity.activity_date == today,
    )
    today_seconds = (await db.execute(today_stmt)).scalar() or 0

    # 7-day active seconds
    week_stmt = select(func.coalesce(func.sum(DailyActivity.total_active_seconds), 0)).where(
        DailyActivity.user_id == user_id,
        DailyActivity.activity_date >= seven_days_ago,
    )
    week_seconds = (await db.execute(week_stmt)).scalar() or 0

    # Total all-time active seconds
    total_stmt = select(func.coalesce(func.sum(DailyActivity.total_active_seconds), 0)).where(
        DailyActivity.user_id == user_id,
    )
    total_seconds = (await db.execute(total_stmt)).scalar() or 0

    return {
        "today_active_seconds": int(today_seconds),
        "today_active_minutes": int(today_seconds // 60),
        "weekly_active_seconds": int(week_seconds),
        "weekly_active_minutes": int(week_seconds // 60),
        "total_active_seconds": int(total_seconds),
        "total_active_hours": round(total_seconds / 3600, 1),
    }
