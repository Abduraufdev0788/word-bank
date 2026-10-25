import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import WordBatch, Word
from app.models.story import MiniStory
from app.schemas.ai import (
    StoryGenerateRequest,
    MiniStoryOut,
)
from app.services.ai_service import ai_service

router = APIRouter()


@router.post(
    "/generate",
    response_model=MiniStoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI Mini Story from batch or custom words with CEFR grading and comprehension questions",
)
async def generate_story(
    payload: StoryGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    target_words: List[str] = []

    if payload.batch_id:
        batch_res = await db.execute(
            select(WordBatch).where(
                WordBatch.id == payload.batch_id,
                WordBatch.user_id == current_user.id,
            )
        )
        batch = batch_res.scalars().first()
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ko'rsatilgan so'z to'plami topilmadi.",
            )

        words_res = await db.execute(
            select(Word.english_word)
            .where(
                Word.batch_id == payload.batch_id,
                Word.user_id == current_user.id,
            )
            .order_by(Word.order_in_batch.asc(), Word.created_at.asc())
        )
        target_words = list(words_res.scalars().all())

        if not target_words:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ushbu to'plamda hikoya yaratish uchun so'zlar topilmadi.",
            )

    elif payload.words:
        target_words = [w.strip() for w in payload.words if w.strip()]
        if not target_words:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="So'zlar ro'yxati bo'sh bo'lishi mumkin emas.",
            )
    else:
        # Automatically select words from user's vocabulary
        user_words_res = await db.execute(
            select(Word.english_word)
            .where(Word.user_id == current_user.id)
            .order_by(Word.created_at.desc())
            .limit(10)
        )
        target_words = list(user_words_res.scalars().all())

        # If user has no words in word bank yet, use CEFR graded vocabulary
        if not target_words:
            cefr_defaults = {
                "A1": ["family", "friend", "happy", "morning", "school"],
                "A2": ["journey", "weather", "decide", "celebrate", "island"],
                "B1": ["serendipity", "resilient", "adventure", "curious", "opportunity"],
                "B2": ["perseverance", "fascinating", "perspective", "innovative", "challenge"],
                "C1": ["ubiquitous", "ephemeral", "eloquent", "scrutinize", "paradigm"],
                "C2": ["serendipitous", "meticulous", "idiosyncrasy", "panacea", "ineffable"],
            }
            target_words = cefr_defaults.get(payload.cefr_level, cefr_defaults["B1"])

    # Call AI service with bounded retry and word coverage validation
    generated_story = await ai_service.generate_batch_story(
        words=target_words,
        cefr_level=payload.cefr_level,
    )

    # Persist story in PostgreSQL
    new_story = MiniStory(
        user_id=current_user.id,
        batch_id=payload.batch_id,
        cefr_level=payload.cefr_level,
        title_en=generated_story.title_en,
        title_uz=generated_story.title_uz,
        content_en=generated_story.content_en,
        content_uz=generated_story.content_uz,
        target_words=generated_story.used_target_words,
        comprehension_questions=[
            q.model_dump() for q in generated_story.comprehension_questions
        ],
    )
    db.add(new_story)
    await db.commit()
    await db.refresh(new_story)

    return new_story


@router.get(
    "",
    response_model=List[MiniStoryOut],
    status_code=status.HTTP_200_OK,
    summary="List all saved stories for the current user",
)
async def list_stories(
    batch_id: Optional[uuid.UUID] = Query(None, description="Filter by batch ID"),
    cefr_level: Optional[str] = Query(None, description="Filter by CEFR level"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(MiniStory).where(MiniStory.user_id == current_user.id)

    if batch_id:
        query = query.where(MiniStory.batch_id == batch_id)
    if cefr_level:
        query = query.where(MiniStory.cefr_level == cefr_level.upper().strip())

    query = query.order_by(MiniStory.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    stories = result.scalars().all()
    return stories


@router.get(
    "/{story_id}",
    response_model=MiniStoryOut,
    status_code=status.HTTP_200_OK,
    summary="Get single story detail by ID",
)
async def get_story(
    story_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(MiniStory).where(
            MiniStory.id == story_id,
            MiniStory.user_id == current_user.id,
        )
    )
    story = result.scalars().first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hikoya topilmadi.",
        )
    return story


@router.delete(
    "/{story_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved story",
)
async def delete_story(
    story_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(MiniStory).where(
            MiniStory.id == story_id,
            MiniStory.user_id == current_user.id,
        )
    )
    story = result.scalars().first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hikoya topilmadi.",
        )

    await db.delete(story)
    await db.commit()
    return None
