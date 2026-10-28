import re
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class WordExampleBase(BaseModel):
    sentence_en: str
    sentence_uz: str


class WordExampleCreate(WordExampleBase):
    pass


class WordExampleOut(WordExampleBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


class WordProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    repetition_number: int
    ease_factor: float
    interval_days: int
    due_date: datetime
    last_reviewed_at: Optional[datetime] = None
    times_reviewed: int
    times_correct: int
    times_incorrect: int
    is_mastered: bool
    is_weak: bool


class WordBase(BaseModel):
    english_word: str = Field(min_length=1, max_length=150)
    uzbek_translation: str = Field(min_length=1)
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    audio_url: Optional[str] = None
    cefr_level: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("english_word", mode="before")
    @classmethod
    def normalize_english_word(cls, v: str) -> str:
        if isinstance(v, str):
            cleaned = re.sub(r"^(?:\d+[\.\)]|[-*•])\s*", "", v.strip())
            return cleaned.strip().lower()
        return v

    @field_validator("uzbek_translation", mode="before")
    @classmethod
    def clean_uzbek(cls, v: str) -> str:
        if isinstance(v, str):
            cleaned = re.sub(r"^(?:\d+[\.\)]|[-*•])\s*", "", v.strip())
            return cleaned.strip()
        return v


class WordCreate(WordBase):
    batch_id: Optional[uuid.UUID] = None
    examples: Optional[List[WordExampleCreate]] = None


class WordUpdate(BaseModel):
    uzbek_translation: Optional[str] = None
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    audio_url: Optional[str] = None
    cefr_level: Optional[str] = None
    notes: Optional[str] = None
    batch_id: Optional[uuid.UUID] = None


class WordOut(WordBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    batch_id: Optional[uuid.UUID] = None
    order_in_batch: int
    created_at: datetime
    updated_at: datetime
    examples: List[WordExampleOut] = []
    progress: Optional[WordProgressOut] = None


class WordBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_number: int
    title: str
    source_file_name: Optional[str] = None
    status: str
    word_count: int
    is_complete: bool
    created_at: datetime
    updated_at: datetime
    due_count: Optional[int] = 0


class WordBatchDetailOut(WordBatchOut):
    words: List[WordOut] = []


class WordBatchCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    force_new: Optional[bool] = False


class WordBatchUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=150)
    is_complete: Optional[bool] = None


class ImportPreviewRow(BaseModel):
    english_word: str
    uzbek_translation: str
    is_duplicate: bool = False
    is_valid: bool = True
    error_message: Optional[str] = None


class ImportPreviewResponse(BaseModel):
    file_name: str
    file_type: str
    total_detected_rows: int
    valid_rows_count: int
    duplicate_candidates_count: int
    detected_en_column: Optional[str] = None
    detected_uz_column: Optional[str] = None
    preview_rows: List[ImportPreviewRow]
    batches_to_create: int


class ImportCommitRequest(BaseModel):
    file_name: str
    file_type: str
    en_column: Optional[str] = None
    uz_column: Optional[str] = None
    skip_duplicates: bool = True
    fill_incomplete_batch: bool = True


class ImportCommitResponse(BaseModel):
    message: str
    total_imported: int
    total_skipped_duplicates: int
    batches_created: int
    batches_updated: int


class VerifyAnswerRequest(BaseModel):
    word_id: uuid.UUID
    user_answer: str


class VerifyAnswerResponse(BaseModel):
    is_correct: bool
    is_synonym_match: bool
    correct_english: str
    correct_uzbek: str
    explanation: Optional[str] = None


class ExtractedWordItem(BaseModel):
    english: str
    uzbek: str


class ExtractedWordsList(BaseModel):
    words: List[ExtractedWordItem]
