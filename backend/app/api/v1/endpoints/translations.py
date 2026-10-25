import logging
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import Word, WordExample
from app.schemas.ai import (
    WordEnrichmentRequest,
    WordEnrichmentResponse,
    WordExampleSchema,
    QuickTranslationRequest,
    QuickTranslationResponse,
)
from app.services.ai_service import ai_service
from app.services.translation_service import translation_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/enrich",
    response_model=WordEnrichmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Enrich English word with AI (Uzbek translation, IPA phonetic, POS, examples, CEFR)",
)
async def enrich_word(
    payload: WordEnrichmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    clean_word = payload.english_word.strip()

    # 1. Check cache / existing word in user's bank first (0ms)
    result = await db.execute(
        select(Word)
        .where(
            Word.user_id == current_user.id,
            Word.english_word.ilike(clean_word),
        )
    )
    existing_word = result.scalars().first()

    if existing_word:
        ex_result = await db.execute(
            select(WordExample).where(WordExample.word_id == existing_word.id)
        )
        examples = ex_result.scalars().all()
        return WordEnrichmentResponse(
            uzbek_translation=existing_word.uzbek_translation,
            part_of_speech=existing_word.part_of_speech or "word",
            phonetic=existing_word.phonetic or "",
            cefr_level=existing_word.cefr_level or "B1",
            examples=[
                WordExampleSchema(
                    sentence_en=ex.sentence_en,
                    sentence_uz=ex.sentence_uz,
                )
                for ex in examples
            ],
            notes=existing_word.notes or "Lug'atingizdagi mavjud so'z",
        )

    # 2. Try Gemini AI service first
    try:
        enrichment = await ai_service.enrich_word(
            word=clean_word,
            context=payload.context,
        )
        return enrichment
    except Exception as e:
        logger.warning(
            f"AI enrichment failed or quota exceeded ({e}), falling back to fast translation..."
        )
        # 3. Seamless ultra-fast fallback via Google Translate / MyMemory API
        fast_uz = await translation_service.fast_translate(clean_word, "en", "uz")
        return WordEnrichmentResponse(
            uzbek_translation=fast_uz or clean_word,
            part_of_speech="word",
            phonetic="",
            cefr_level="B1",
            examples=[],
            notes="Tezkor tarjima",
        )


@router.post(
    "/quick",
    response_model=QuickTranslationResponse,
    status_code=status.HTTP_200_OK,
    summary="Quick direct translation between English and Uzbek",
)
async def quick_translate(
    payload: QuickTranslationRequest,
    current_user: User = Depends(get_current_active_user),
):
    # 1. Try ultra-fast translation service first (Google Translate API / MyMemory, ~200ms)
    try:
        fast_result = await translation_service.fast_translate(
            payload.text,
            payload.source_lang,
            payload.target_lang,
        )
        if fast_result and fast_result.lower() != payload.text.lower():
            return QuickTranslationResponse(
                original_text=payload.text,
                translated_text=fast_result,
                source_lang=payload.source_lang,
                target_lang=payload.target_lang,
            )
    except Exception as e:
        logger.warning(f"Fast translation error: {e}")

    # 2. Fallback to Gemini AI if fast service returned same text
    return await ai_service.translate_quick(
        text=payload.text,
        source_lang=payload.source_lang,
        target_lang=payload.target_lang,
    )
