import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import Word, WordProgress
from app.schemas.speaking import (
    GenerateSpeakingRequest,
    SpeakingSessionResponse,
    AnalyzeSpeakingAttemptRequest,
    AnalyzeSpeakingAttemptResponse,
)
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()


PRESET_TOPICS = [
    {
        "id": "job_interview",
        "title": "Ish suhbati (Job Interview)",
        "prompt": "Job interview self-introduction and discussing professional strengths",
        "recommended_level": "B2",
        "icon": "Briefcase",
    },
    {
        "id": "travel_airport",
        "title": "Sayohat va aeroport (Travel & Airport)",
        "prompt": "Checking in at an international airport and asking for flight directions",
        "recommended_level": "A2",
        "icon": "Plane",
    },
    {
        "id": "restaurant_order",
        "title": "Restoranda buyurtma (Ordering at a Restaurant)",
        "prompt": "Ordering a delicious three-course meal and asking the waiter for recommendations",
        "recommended_level": "A2",
        "icon": "Utensils",
    },
    {
        "id": "daily_routine",
        "title": "Kundalik rejim (Daily Routine & Habits)",
        "prompt": "Describing morning habits, productive work hours, and evening relaxation",
        "recommended_level": "A1",
        "icon": "Sun",
    },
    {
        "id": "tech_ai",
        "title": "Sun'iy intellekt va kelajak (AI & Future Tech)",
        "prompt": "How artificial intelligence and modern technology are transforming education and everyday life",
        "recommended_level": "B2",
        "icon": "Cpu",
    },
    {
        "id": "future_goals",
        "title": "Kelajak rejalari (Future Dreams & Goals)",
        "prompt": "Talking about career ambitions, personal dreams, and traveling to new countries",
        "recommended_level": "B1",
        "icon": "Compass",
    },
    {
        "id": "hobbies_sports",
        "title": "Qiziqishlar va sport (Hobbies & Sports)",
        "prompt": "My favorite physical activities, sports passion, and weekend leisure hobbies",
        "recommended_level": "A2",
        "icon": "Trophy",
    },
]


@router.get(
    "/topics",
    summary="Tayyor tavsiya etilgan speaking mavzulari ro'yxati",
)
async def get_suggested_topics():
    return PRESET_TOPICS


@router.post(
    "/generate",
    response_model=SpeakingSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Mavzu va CEFR darajasi bo'yicha speaking mashg'ulotini yaratish",
)
async def generate_speaking_session(
    payload: GenerateSpeakingRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    user_words: List[str] = []
    if payload.include_user_words:
        # Fetch up to 8 user words (preferring weak words or recent words)
        stmt = (
            select(Word.english_word)
            .join(WordProgress, WordProgress.word_id == Word.id, isouter=True)
            .where(Word.user_id == current_user.id)
            .order_by(WordProgress.is_weak.desc().nullslast(), Word.created_at.desc())
            .limit(8)
        )
        res = await db.execute(stmt)
        user_words = [row[0] for row in res.all() if row[0]]

    speaking_session = await ai_service.generate_speaking_session(
        topic=payload.topic,
        cefr_level=payload.cefr_level.upper(),
        user_words=user_words,
        sentence_count=payload.sentence_count,
    )
    return speaking_session


@router.post(
    "/analyze",
    response_model=AnalyzeSpeakingAttemptResponse,
    status_code=status.HTTP_200_OK,
    summary="Foydalanuvchi nutqi aniqligini so'zma-so'z tekshirish va maslahat berish",
)
async def analyze_speaking_attempt(
    payload: AnalyzeSpeakingAttemptRequest,
    current_user: User = Depends(get_current_active_user),
):
    analysis = ai_service.analyze_speaking_attempt(
        original_text=payload.original_text,
        spoken_text=payload.spoken_text,
        cefr_level=payload.cefr_level or "B1",
    )
    return analysis
