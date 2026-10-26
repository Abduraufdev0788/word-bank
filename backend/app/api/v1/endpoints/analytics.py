from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.analytics import (
    DashboardStatsOut,
    DailyActivityChartPoint,
    WeakWordOut,
    LevelAssessmentOut,
    ActivityHeatmapOut,
)
from app.services.analytics_service import analytics_service

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=DashboardStatsOut,
    status_code=status.HTTP_200_OK,
    summary="Boshqaruv paneli uchun to'liq analitika va ko'rsatkichlar",
)
async def get_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns live personalized metrics for the dashboard:
    - Today's reviews due, learned, and reviewed count
    - Mastered and weak words count
    - Consecutive streak and active study time
    - Weekly activity chart data
    - Daily goals completion percentage
    - Recent activities and intelligent suggested learning action
    """
    return await analytics_service.get_dashboard_analytics(
        user_id=current_user.id,
        db=db,
    )


@router.get(
    "/weekly-chart",
    response_model=List[DailyActivityChartPoint],
    status_code=status.HTTP_200_OK,
    summary="So'nggi 7 kunlik faollik va o'rganish grafigi",
)
async def get_weekly_chart(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await analytics_service.get_dashboard_analytics(
        user_id=current_user.id,
        db=db,
    )
    return stats.weekly_chart


@router.get(
    "/weak-words",
    response_model=List[WeakWordOut],
    status_code=status.HTTP_200_OK,
    summary="Foydalanuvchi ko'p xato qilgan yoki qiynalgan so'zlar ro'yxati",
)
async def get_weak_words(
    limit: int = Query(20, ge=1, le=100),
    randomize: bool = Query(False, description="Tasodifiy tartibda 20 ta so'z olish"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_weak_words_list(
        user_id=current_user.id,
        db=db,
        limit=limit,
        randomize=randomize,
    )


@router.get(
    "/level-assessment",
    response_model=LevelAssessmentOut,
    status_code=status.HTTP_200_OK,
    summary="Lug'at boyligi bo'yicha taxminiy CEFR darajasi bahosi",
)
async def get_level_assessment(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_level_assessment(
        user_id=current_user.id,
        db=db,
    )


@router.get(
    "/activity-heatmap",
    response_model=ActivityHeatmapOut,
    status_code=status.HTTP_200_OK,
    summary="GitHub uslubidagi kunlik faollik va o'rganish kalendari (Heatmap)",
)
async def get_activity_heatmap(
    days: int = Query(180, ge=30, le=365, description="Ko'rsatiladigan kunlar soni"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_activity_heatmap(
        user_id=current_user.id,
        days_count=days,
        db=db,
    )

