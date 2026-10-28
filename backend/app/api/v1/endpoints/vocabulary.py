import csv
from datetime import datetime, timezone
import io
import json
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.vocabulary import Word, WordBatch, WordExample, WordProgress
from app.schemas.vocabulary import (
    VerifyAnswerRequest,
    VerifyAnswerResponse,
    WordCreate,
    WordOut,
    WordUpdate,
)
from app.services.batch_service import get_or_create_destination_batch, recalculate_batch_status

router = APIRouter()


@router.get(
    "/mastered-practice",
    response_model=List[WordOut],
    summary="Kunlik 50 ta o'zlashtirilgan/bilgan so'zlarni mashq qilish uchun olish",
)
async def get_mastered_practice_words(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns up to 50 randomized mastered or known words for daily booster practice."""
    # 1. Strictly mastered words
    stmt_mastered = (
        select(Word)
        .options(
            selectinload(Word.examples),
            selectinload(Word.progress),
        )
        .join(WordProgress, Word.id == WordProgress.word_id)
        .where(
            Word.user_id == current_user.id,
            WordProgress.is_mastered == True,  # noqa: E712
        )
        .order_by(func.random())
        .limit(limit)
    )
    result = await db.execute(stmt_mastered)
    words = list(result.scalars().all())

    # 2. Supplement with words with correct answers if needed
    if len(words) < limit:
        needed = limit - len(words)
        existing_ids = [w.id for w in words]
        stmt_supplement = (
            select(Word)
            .options(
                selectinload(Word.examples),
                selectinload(Word.progress),
            )
            .join(WordProgress, Word.id == WordProgress.word_id)
            .where(
                Word.user_id == current_user.id,
                WordProgress.times_correct >= 1,
                Word.id.not_in(existing_ids) if existing_ids else True,
            )
            .order_by(func.random())
            .limit(needed)
        )
        sup_result = await db.execute(stmt_supplement)
        words.extend(sup_result.scalars().all())

    # 3. Supplement with any words if user is new
    if len(words) < limit:
        needed = limit - len(words)
        existing_ids = [w.id for w in words]
        stmt_any = (
            select(Word)
            .options(
                selectinload(Word.examples),
                selectinload(Word.progress),
            )
            .where(
                Word.user_id == current_user.id,
                Word.id.not_in(existing_ids) if existing_ids else True,
            )
            .order_by(func.random())
            .limit(needed)
        )
        any_result = await db.execute(stmt_any)
        words.extend(any_result.scalars().all())

    return words


@router.get(
    "/all-practice",
    response_model=List[WordOut],
    summary="Lug'atdagi barcha so'zlar orasidan 50 tasini mashq qilish uchun olish",
)
async def get_all_practice_words(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns up to 50 randomized words across the user's entire vocabulary."""
    stmt = (
        select(Word)
        .options(
            selectinload(Word.examples),
            selectinload(Word.progress),
        )
        .where(Word.user_id == current_user.id)
        .order_by(func.random())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/weak-words",
    summary="Foydalanuvchi ko'p xato qilgan yoki qiynalgan so'zlar ro'yxati (Vocabulary)",
)
async def get_weak_words_vocabulary(
    limit: int = Query(default=20, ge=1, le=100),
    randomize: bool = Query(default=False),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Returns list of weak words for the current user."""
    from app.services.analytics_service import analytics_service
    return await analytics_service.get_weak_words_list(
        user_id=current_user.id,
        db=db,
        limit=limit,
        randomize=randomize,
    )


@router.get(
    "",
    response_model=List[WordOut],
    summary="Foydalanuvchi so'zlar ro'yxatini qidirish va filtrlash",
)
async def list_vocabulary(
    search: Optional[str] = Query(default=None, description="Inglizcha yoki o'zbekcha so'z bo'yicha qidiruv"),
    batch_id: Optional[uuid.UUID] = Query(default=None, description="To'plam bo'yicha filtr"),
    cefr_level: Optional[str] = Query(default=None, description="A1-C2 daraja filtri"),
    is_mastered: Optional[bool] = Query(default=None, description="O'zlashtirilganlik holati"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Lists words owned by the current user with search and filtering."""
    stmt = (
        select(Word)
        .options(
            selectinload(Word.examples),
            selectinload(Word.progress),
        )
        .where(Word.user_id == current_user.id)
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Word.english_word.ilike(pattern),
                Word.uzbek_translation.ilike(pattern),
            )
        )

    if batch_id:
        stmt = stmt.where(Word.batch_id == batch_id)

    if cefr_level:
        stmt = stmt.where(Word.cefr_level == cefr_level.upper())

    if is_mastered is not None:
        stmt = stmt.join(WordProgress, Word.id == WordProgress.word_id).where(
            WordProgress.is_mastered == is_mastered
        )

    stmt = stmt.order_by(Word.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=WordOut,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi so'z qo'shish",
)
async def create_word(
    word_in: WordCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Creates a new word, assigning it to a batch and initializing Spaced Repetition."""
    clean_word = word_in.english_word.strip().lower()

    # Check for existing duplicate for this user
    dup_stmt = select(Word).where(
        Word.user_id == current_user.id,
        func.lower(Word.english_word) == clean_word.lower(),
    )
    existing = (await db.execute(dup_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{clean_word}' so'zi lug'atingizda allaqachon mavjud",
        )

    # Determine destination batch
    if word_in.batch_id:
        batch_stmt = select(WordBatch).where(
            WordBatch.id == word_in.batch_id,
            WordBatch.user_id == current_user.id,
        )
        dest_batch = (await db.execute(batch_stmt)).scalar_one_or_none()
        if not dest_batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Belgilangan to'plam topilmadi",
            )
    else:
        dest_batch = await get_or_create_destination_batch(
            user_id=current_user.id,
            db=db,
            fill_incomplete=True,
        )

    uzbek_tr = word_in.uzbek_translation.strip()
    if not uzbek_tr or uzbek_tr.lower() == clean_word.lower():
        from app.services.translation_service import translation_service
        try:
            auto_uz = await translation_service.fast_translate(clean_word, "en", "uz")
            if auto_uz and auto_uz.lower() != clean_word.lower():
                uzbek_tr = auto_uz
        except Exception:
            pass

    new_word = Word(
        user_id=current_user.id,
        batch_id=dest_batch.id,
        english_word=clean_word,
        uzbek_translation=uzbek_tr,
        part_of_speech=word_in.part_of_speech,
        phonetic=word_in.phonetic,
        audio_url=word_in.audio_url,
        cefr_level=word_in.cefr_level,
        notes=word_in.notes,
        order_in_batch=dest_batch.word_count + 1,
    )
    db.add(new_word)
    await db.flush()

    # Add optional examples
    if word_in.examples:
        for ex in word_in.examples:
            example = WordExample(
                word_id=new_word.id,
                sentence_en=ex.sentence_en.strip(),
                sentence_uz=ex.sentence_uz.strip(),
            )
            db.add(example)

    # Initialize Spaced Repetition progress
    progress = WordProgress(
        user_id=current_user.id,
        word_id=new_word.id,
        repetition_number=0,
        ease_factor=2.5,
        interval_days=0,
        due_date=datetime.now(timezone.utc),
        times_reviewed=0,
        times_correct=0,
        times_incorrect=0,
        is_mastered=False,
        is_weak=False,
    )
    db.add(progress)

    # Update batch statistics
    await recalculate_batch_status(dest_batch.id, db)
    await db.commit()

    # Reload word with relationships
    stmt = (
        select(Word)
        .options(
            selectinload(Word.examples),
            selectinload(Word.progress),
        )
        .where(Word.id == new_word.id)
    )
    return (await db.execute(stmt)).scalar_one()


@router.get(
    "/export",
    summary="Foydalanuvchi lug'atini CSV yoki JSON formatida eksport qilish",
)
async def export_vocabulary(
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exports all user words in CSV or JSON format."""
    stmt = (
        select(Word)
        .options(selectinload(Word.progress))
        .where(Word.user_id == current_user.id)
        .order_by(Word.created_at.asc())
    )
    words = (await db.execute(stmt)).scalars().all()

    if format == "json":
        data = [
            {
                "english_word": w.english_word,
                "uzbek_translation": w.uzbek_translation,
                "part_of_speech": w.part_of_speech,
                "phonetic": w.phonetic,
                "cefr_level": w.cefr_level,
                "is_mastered": w.progress.is_mastered if w.progress else False,
            }
            for w in words
        ]
        content = json.dumps(data, ensure_ascii=False, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=my_vocabulary.json"},
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["English", "Uzbek", "Part of Speech", "Phonetic", "CEFR Level", "Mastered"])
        for w in words:
            writer.writerow([
                w.english_word,
                w.uzbek_translation,
                w.part_of_speech or "",
                w.phonetic or "",
                w.cefr_level or "",
                "Ha" if (w.progress and w.progress.is_mastered) else "Yo'q",
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=my_vocabulary.csv"},
        )


@router.get(
    "/{word_id}",
    response_model=WordOut,
    summary="So'z tafsilotlarini olish",
)
async def get_word(
    word_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Gets single word by ID (enforcing user isolation)."""
    stmt = (
        select(Word)
        .options(
            selectinload(Word.examples),
            selectinload(Word.progress),
        )
        .where(Word.id == word_id, Word.user_id == current_user.id)
    )
    word = (await db.execute(stmt)).scalar_one_or_none()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="So'z topilmadi",
        )
    return word


@router.put(
    "/{word_id}",
    response_model=WordOut,
    summary="So'z ma'lumotlarini tahrirlash",
)
async def update_word(
    word_id: uuid.UUID,
    word_in: WordUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Updates word translation, phonetic, notes or moves to another batch."""
    stmt = (
        select(Word)
        .options(
            selectinload(Word.examples),
            selectinload(Word.progress),
        )
        .where(Word.id == word_id, Word.user_id == current_user.id)
    )
    word = (await db.execute(stmt)).scalar_one_or_none()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="So'z topilmadi",
        )

    old_batch_id = word.batch_id
    update_data = word_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(word, field, val)

    await db.flush()

    # If moved to another batch, update both batches' counts
    if word_in.batch_id and word_in.batch_id != old_batch_id:
        if old_batch_id:
            await recalculate_batch_status(old_batch_id, db)
        await recalculate_batch_status(word_in.batch_id, db)

    await db.commit()
    await db.refresh(word)
    return word


@router.delete(
    "/{word_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="So'zni o'chirish",
)
async def delete_word(
    word_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deletes a word and updates the parent batch word count."""
    stmt = select(Word).where(Word.id == word_id, Word.user_id == current_user.id)
    word = (await db.execute(stmt)).scalar_one_or_none()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="So'z topilmadi",
        )

    batch_id = word.batch_id
    await db.delete(word)
    await db.flush()

    if batch_id:
        await recalculate_batch_status(batch_id, db)

    await db.commit()


@router.post(
    "/verify-answer",
    response_model=VerifyAnswerResponse,
    summary="Foydalanuvchi yozgan inglizcha javobni sinonimlar va lug'atdosh so'zlar bilan tekshirish",
)
async def verify_user_answer(
    payload: VerifyAnswerRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Word).where(Word.id == payload.word_id, Word.user_id == current_user.id)
    word = (await db.execute(stmt)).scalar_one_or_none()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="So'z topilmadi",
        )

    from app.services.synonym_service import verify_english_answer

    is_correct, is_synonym, explanation = await verify_english_answer(
        user_input=payload.user_answer,
        target_word=word,
        user_id=current_user.id,
        db=db,
    )

    return VerifyAnswerResponse(
        is_correct=is_correct,
        is_synonym_match=is_synonym,
        correct_english=word.english_word,
        correct_uzbek=word.uzbek_translation,
        explanation=explanation,
    )
