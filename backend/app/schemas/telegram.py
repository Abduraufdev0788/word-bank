import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CreateLinkTokenOut(BaseModel):
    link_token: str
    bot_url: str
    expires_at: datetime


class VerifyLinkIn(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    telegram_user_id: int
    telegram_chat_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None


class VerifyLinkOut(BaseModel):
    success: bool
    message: str
    user_id: uuid.UUID
    email: str
    full_name: Optional[str] = None


class TelegramUserSummaryOut(BaseModel):
    is_linked: bool
    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    preferred_cefr_level: str = "B1"
    streak_days: int = 0
    words_due_today: int = 0
    words_reviewed_today: int = 0
    study_time_minutes_today: int = 0


class TelegramReviewSubmitIn(BaseModel):
    word_id: uuid.UUID
    quality_rating: int = Field(ge=0, le=5, description="SM-2 quality 0 to 5")
    user_answer: Optional[str] = None


class TelegramQuickAddIn(BaseModel):
    english_word: str = Field(min_length=1, max_length=150)
    uzbek_translation: Optional[str] = None
    auto_enrich: bool = True


class TelegramReviewItemOut(BaseModel):
    id: uuid.UUID
    english_word: str
    uzbek_translation: str
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    cefr_level: Optional[str] = None
    notes: Optional[str] = None
    repetition_number: int = 0
    ease_factor: float = 2.5
    interval_days: int = 0
    is_weak: bool = False
    examples: list = Field(default_factory=list)


class TelegramReviewResultOut(BaseModel):
    word_id: uuid.UUID
    english_word: str
    quality_rating: int
    repetition_number: int
    ease_factor: float
    interval_days: int
    due_date: datetime
    is_mastered: bool
    is_weak: bool

