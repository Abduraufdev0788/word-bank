import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, TelegramAccount, AccountLinkToken
from app.models.vocabulary import WordBatch, Word, WordProgress, WordExample
from app.models.learning import DailyActivity, WordReview
from app.schemas.telegram import (
    CreateLinkTokenOut,
    VerifyLinkIn,
    VerifyLinkOut,
    TelegramUserSummaryOut,
    TelegramReviewSubmitIn,
    TelegramQuickAddIn,
    TelegramReviewItemOut,
    TelegramReviewResultOut,
)
from app.schemas.vocabulary import WordBatchOut, WordOut
from app.services.batch_service import get_or_create_destination_batch, recalculate_batch_status
from app.services.srs_service import process_word_review
from app.services.study_tracker import ensure_utc
from app.services.ai_service import ai_service

router = APIRouter()


async def get_linked_user(telegram_user_id: int, db: AsyncSession) -> User:
    """Helper to look up user linked to telegram_user_id or raise 404."""
    stmt = (
        select(TelegramAccount)
        .options(selectinload(TelegramAccount.user).selectinload(User.settings))
        .where(TelegramAccount.telegram_user_id == telegram_user_id)
    )
    result = await db.execute(stmt)
    tg_acc = result.scalars().first()
    if not tg_acc or not tg_acc.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Telegram hisobi tizimga ulanmagan. Iltimos, /start buyrug'i orqali hisobingizni bog'lang.",
        )
    return tg_acc.user


# --- 1. Web User Token Generation ---

@router.post(
    "/link-token",
    response_model=CreateLinkTokenOut,
    status_code=status.HTTP_201_CREATED,
    summary="Web foydalanuvchisi uchun Telegram bog'lash tokenini yaratish",
)
async def create_link_token(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.TELEGRAM_LINK_TOKEN_EXPIRE_MINUTES
    )

    link_token_obj = AccountLinkToken(
        user_id=current_user.id,
        token=token,
        is_used=False,
        expires_at=expires_at,
    )
    db.add(link_token_obj)
    await db.commit()

    bot_url = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}"
    return CreateLinkTokenOut(
        link_token=token,
        bot_url=bot_url,
        expires_at=expires_at,
    )


# --- 2. Telegram Bot Link Verification ---

@router.post(
    "/verify-link",
    response_model=VerifyLinkOut,
    status_code=status.HTTP_200_OK,
    summary="Telegram bot orqali kelgan tokenni tekshirish va hisobni bog'lash",
)
async def verify_link(
    payload: VerifyLinkIn,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    stmt = (
        select(AccountLinkToken)
        .options(selectinload(AccountLinkToken.user))
        .where(
            AccountLinkToken.token == payload.token,
            AccountLinkToken.is_used == False,  # noqa: E712
            AccountLinkToken.expires_at > now,
        )
    )
    result = await db.execute(stmt)
    token_obj = result.scalars().first()

    if not token_obj or not token_obj.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ushbu bog'lash kodi eskirgan yoki noto'g'ri. Saytdan yangi havola oling.",
        )

    user = token_obj.user

    # Check if this telegram_user_id is already linked to another user, or if this user is already linked
    existing_tg = await db.execute(
        select(TelegramAccount).where(
            (TelegramAccount.telegram_user_id == payload.telegram_user_id)
            | (TelegramAccount.user_id == user.id)
        )
    )
    existing_accounts = existing_tg.scalars().all()
    for acc in existing_accounts:
        await db.delete(acc)

    new_tg_account = TelegramAccount(
        user_id=user.id,
        telegram_user_id=payload.telegram_user_id,
        telegram_chat_id=payload.telegram_chat_id,
        username=payload.username,
        first_name=payload.first_name,
    )
    db.add(new_tg_account)
    token_obj.is_used = True
    await db.commit()

    return VerifyLinkOut(
        success=True,
        message="Hisobingiz SmartVocab AI platformasiga muvaffaqiyatli bog'landi!",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


# --- 3. Telegram User Info & Summary ---

@router.get(
    "/user/{telegram_user_id}",
    response_model=TelegramUserSummaryOut,
    summary="Telegram foydalanuvchisi holatini tekshirish",
)
async def get_telegram_user_summary(
    telegram_user_id: int,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TelegramAccount)
        .options(selectinload(TelegramAccount.user).selectinload(User.settings))
        .where(TelegramAccount.telegram_user_id == telegram_user_id)
    )
    result = await db.execute(stmt)
    tg_acc = result.scalars().first()

    if not tg_acc or not tg_acc.user:
        return TelegramUserSummaryOut(is_linked=False)

    user = tg_acc.user
    today = datetime.now(timezone.utc).date()

    # Query today's activity
    act_res = await db.execute(
        select(DailyActivity).where(
            DailyActivity.user_id == user.id,
            DailyActivity.activity_date == today,
        )
    )
    activity = act_res.scalars().first()

    # Query due review words
    now = datetime.now(timezone.utc) + timedelta(seconds=5)
    due_res = await db.execute(
        select(func.count(WordProgress.id)).where(
            WordProgress.user_id == user.id,
            WordProgress.due_date <= now,
        )
    )
    words_due = due_res.scalar_one() or 0

    return TelegramUserSummaryOut(
        is_linked=True,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        preferred_cefr_level=user.settings.preferred_cefr_level if user.settings else "B1",
        streak_days=activity.streak_day_count if activity else 1,
        words_due_today=words_due,
        words_reviewed_today=activity.words_reviewed if activity else 0,
        study_time_minutes_today=(activity.total_active_seconds // 60) if activity else 0,
    )


# --- 4. Review Queue & Submission ---

@router.get(
    "/review/queue/{telegram_user_id}",
    response_model=List[TelegramReviewItemOut],
    summary="Telegram orqali bugungi takrorlash navbatini olish",
)
async def get_telegram_review_queue(
    telegram_user_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    user = await get_linked_user(telegram_user_id, db)
    now = datetime.now(timezone.utc) + timedelta(seconds=5)

    stmt = (
        select(Word)
        .join(WordProgress, Word.id == WordProgress.word_id)
        .options(selectinload(Word.progress), selectinload(Word.examples))
        .where(
            Word.user_id == user.id,
            WordProgress.due_date <= now,
        )
        .order_by(WordProgress.due_date.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    words = result.scalars().all()

    queue = []
    for w in words:
        item = TelegramReviewItemOut(
            id=w.id,
            english_word=w.english_word,
            uzbek_translation=w.uzbek_translation,
            part_of_speech=w.part_of_speech,
            phonetic=w.phonetic,
            cefr_level=w.cefr_level,
            notes=w.notes,
            repetition_number=w.progress.repetition_number if w.progress else 0,
            ease_factor=w.progress.ease_factor if w.progress else 2.5,
            interval_days=w.progress.interval_days if w.progress else 0,
            is_weak=w.progress.is_weak if w.progress else False,
            examples=[
                {"sentence_en": ex.sentence_en, "sentence_uz": ex.sentence_uz}
                for ex in w.examples
            ],
        )
        queue.append(item)

    return queue


@router.post(
    "/review/submit/{telegram_user_id}",
    response_model=TelegramReviewResultOut,
    summary="Telegram orqali so'z takrorlash javobini topshirish (SM-2 + Study-time)",
)
async def submit_telegram_review(
    telegram_user_id: int,
    payload: TelegramReviewSubmitIn,
    db: AsyncSession = Depends(get_db),
):
    user = await get_linked_user(telegram_user_id, db)

    # 1. Fetch word
    word_res = await db.execute(
        select(Word)
        .options(selectinload(Word.progress))
        .where(Word.id == payload.word_id, Word.user_id == user.id)
    )
    word = word_res.scalars().first()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ko'rsatilgan so'z topilmadi.",
        )

    # 2. Process SM-2 review
    progress, review_record = await process_word_review(
        user_id=user.id,
        word_id=payload.word_id,
        quality_rating=payload.quality_rating,
        review_source="telegram",
        review_type="flashcard",
        db=db,
        user_answer=payload.user_answer,
        time_spent_ms=20000,  # Calibrated 20 seconds
    )

    # 3. Update today's DailyActivity (reviewed count + 20 seconds calibrated active time)
    today = datetime.now(timezone.utc).date()
    act_res = await db.execute(
        select(DailyActivity).where(
            DailyActivity.user_id == user.id,
            DailyActivity.activity_date == today,
        )
    )
    activity = act_res.scalars().first()
    if not activity:
        activity = DailyActivity(
            user_id=user.id,
            activity_date=today,
            total_active_seconds=20,
            words_reviewed=1,
            streak_day_count=1,
        )
        db.add(activity)
    else:
        activity.words_reviewed += 1
        activity.total_active_seconds += 20

    await db.commit()
    await db.refresh(progress)

    return TelegramReviewResultOut(
        word_id=word.id,
        english_word=word.english_word,
        quality_rating=payload.quality_rating,
        repetition_number=progress.repetition_number,
        ease_factor=round(progress.ease_factor, 2),
        interval_days=progress.interval_days,
        due_date=progress.due_date,
        is_mastered=progress.is_mastered,
        is_weak=progress.is_weak,
    )


# --- 5. Quick Word Addition ---

@router.post(
    "/vocabulary/quick-add/{telegram_user_id}",
    response_model=WordOut,
    status_code=status.HTTP_201_CREATED,
    summary="Telegram orqali yangi so'z qo'shish va AI orqali boyitish",
)
async def quick_add_word_from_telegram(
    telegram_user_id: int,
    payload: TelegramQuickAddIn,
    db: AsyncSession = Depends(get_db),
):
    user = await get_linked_user(telegram_user_id, db)
    clean_word = payload.english_word.strip().lower()

    # Check if duplicate exists
    dup_res = await db.execute(
        select(Word).where(
            Word.user_id == user.id,
            Word.english_word.ilike(clean_word),
        )
    )
    if dup_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{clean_word}' so'zi sizning lug'atingizda allaqachon mavjud.",
        )

    # Auto-enrich if requested
    uzbek_tr = payload.uzbek_translation or ""
    pos = "word"
    phonetic = ""
    cefr = "B1"
    notes = ""
    examples_data = []

    if payload.auto_enrich and settings.GEMINI_API_KEY:
        try:
            enrichment = await ai_service.enrich_word(clean_word)
            uzbek_tr = uzbek_tr or enrichment.uzbek_translation
            pos = enrichment.part_of_speech
            phonetic = enrichment.phonetic
            cefr = enrichment.cefr_level
            notes = enrichment.notes
            examples_data = enrichment.examples
        except Exception:
            pass  # Fall back gracefully

    if not uzbek_tr:
        uzbek_tr = "Tarjima kiritilmagan"

    # Get or create eligible 20-word batch
    batch = await get_or_create_destination_batch(user_id=user.id, db=db)

    # Create word
    new_word = Word(
        user_id=user.id,
        batch_id=batch.id,
        english_word=clean_word,
        uzbek_translation=uzbek_tr,
        part_of_speech=pos,
        phonetic=phonetic,
        cefr_level=cefr,
        notes=notes,
        order_in_batch=batch.word_count + 1,
    )
    db.add(new_word)
    await db.flush()

    # Create initial progress
    progress = WordProgress(
        user_id=user.id,
        word_id=new_word.id,
        due_date=datetime.now(timezone.utc),
    )
    db.add(progress)

    # Add examples if any
    for ex in examples_data:
        example_obj = WordExample(
            word_id=new_word.id,
            sentence_en=ex.sentence_en,
            sentence_uz=ex.sentence_uz,
        )
        db.add(example_obj)

    # Recalculate batch
    await recalculate_batch_status(batch_id=batch.id, db=db)

    # Update today's learned count in DailyActivity
    today = datetime.now(timezone.utc).date()
    act_res = await db.execute(
        select(DailyActivity).where(
            DailyActivity.user_id == user.id,
            DailyActivity.activity_date == today,
        )
    )
    activity = act_res.scalars().first()
    if not activity:
        activity = DailyActivity(
            user_id=user.id,
            activity_date=today,
            total_active_seconds=20,
            words_learned=1,
            streak_day_count=1,
        )
        db.add(activity)
    else:
        activity.words_learned += 1

    await db.commit()

    # Re-query word with relations for WordOut response
    stmt = (
        select(Word)
        .options(selectinload(Word.examples), selectinload(Word.progress))
        .where(Word.id == new_word.id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


# --- 6. Batches List ---

@router.get(
    "/batches/{telegram_user_id}",
    response_model=List[WordBatchOut],
    summary="Telegram foydalanuvchisi to'plamlari ro'yxatini olish",
)
async def get_telegram_batches(
    telegram_user_id: int,
    db: AsyncSession = Depends(get_db),
):
    user = await get_linked_user(telegram_user_id, db)
    stmt = (
        select(WordBatch)
        .where(WordBatch.user_id == user.id)
        .order_by(WordBatch.batch_number.asc())
    )
    result = await db.execute(stmt)
    batches = result.scalars().all()

    now = datetime.now(timezone.utc) + timedelta(seconds=5)
    due_stmt = (
        select(Word.batch_id, func.count(Word.id))
        .join(WordProgress, Word.id == WordProgress.word_id)
        .where(
            Word.user_id == user.id,
            WordProgress.due_date <= now,
        )
        .group_by(Word.batch_id)
    )
    due_res = await db.execute(due_stmt)
    due_map = {b_id: count for b_id, count in due_res.all()}

    output = []
    for b in batches:
        b_dict = WordBatchOut.model_validate(b)
        b_dict.due_count = due_map.get(b.id, 0)
        output.append(b_dict)

    return output


# --- 7. Unlink Telegram Account ---

@router.post(
    "/unlink/{telegram_user_id}",
    status_code=status.HTTP_200_OK,
    summary="Telegram hisobini uzish",
)
async def unlink_telegram_account(
    telegram_user_id: int,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TelegramAccount).where(
        TelegramAccount.telegram_user_id == telegram_user_id
    )
    result = await db.execute(stmt)
    tg_acc = result.scalars().first()
    if not tg_acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ushbu Telegram hisobi tizimga ulanmagan.",
        )

    await db.delete(tg_acc)
    await db.commit()
    return {"success": True, "message": "Telegram hisobi muvaffaqiyatli uzildi."}
