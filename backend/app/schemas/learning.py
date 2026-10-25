import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# --- Reviews (Spaced Repetition) ---
class ReviewSubmission(BaseModel):
    word_id: uuid.UUID
    quality_rating: int = Field(ge=0, le=5, description="SM-2 quality rating from 0 (blackout) to 5 (perfect)")
    review_source: str = Field(default="web", description="'web' or 'telegram'")
    review_type: str = Field(default="multiple_choice", description="'multiple_choice', 'typed', 'flashcard'")
    user_answer: Optional[str] = None
    time_spent_ms: int = Field(default=0, ge=0)


class ReviewSubmissionResponse(BaseModel):
    word_id: uuid.UUID
    is_correct: bool
    repetition_number: int
    new_interval_days: int
    new_ease_factor: float
    new_due_date: datetime
    is_mastered: bool
    is_weak: bool


class DueWordReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    english_word: str
    uzbek_translation: str
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    batch_id: Optional[uuid.UUID] = None
    due_date: datetime
    repetition_number: int
    is_weak: bool


# --- Quizzes (Anti-Cheat) ---
class QuizStartRequest(BaseModel):
    quiz_type: str = Field(default="batch", description="'batch', 'weak_words', 'mixed'")
    batch_id: Optional[uuid.UUID] = None


class QuizQuestionClientOut(BaseModel):
    id: uuid.UUID
    word_id: uuid.UUID
    english_word: str
    question_text: str
    options: List[str]  # Never contains answer key or correct_answer


class QuizStartResponse(BaseModel):
    attempt_id: uuid.UUID
    quiz_type: str
    total_questions: int
    questions: List[QuizQuestionClientOut]


class QuizAnswerRequest(BaseModel):
    question_id: uuid.UUID
    selected_option: str


class QuizAnswerResponse(BaseModel):
    question_id: uuid.UUID
    is_correct: bool
    selected_option: str
    correct_answer: str


class QuizSummaryOut(BaseModel):
    id: uuid.UUID
    total_questions: int
    correct_answers: int
    score_percent: float
    status: str
    completed_at: Optional[datetime] = None


# --- Study-Time Tracking ---
class StudySessionStartRequest(BaseModel):
    activity_type: str = Field(default="review", description="'review', 'quiz', 'story', 'practice'")
    source: str = Field(default="web", description="'web' or 'telegram'")


class StudySessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    activity_type: str
    source: str
    started_at: datetime
    last_heartbeat_at: datetime
    active_duration_seconds: int
    is_active: bool


class StudyTimeSummaryOut(BaseModel):
    today_active_seconds: int
    today_active_minutes: int
    weekly_active_seconds: int
    weekly_active_minutes: int
    total_active_seconds: int
    total_active_hours: float
