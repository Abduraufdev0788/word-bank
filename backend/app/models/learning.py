import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def today_date() -> date:
    return datetime.now(timezone.utc).date()


class WordReview(Base):
    __tablename__ = "word_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("words.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    review_source: Mapped[str] = mapped_column(
        String(20),
        default="web",
        nullable=False,  # 'web' | 'telegram'
    )
    review_type: Mapped[str] = mapped_column(
        String(30),
        default="multiple_choice",
        nullable=False,  # 'multiple_choice', 'typed', 'flashcard'
    )
    quality_rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,  # SM-2: 0 - 5
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )
    user_answer: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    time_spent_ms: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("word_batches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quiz_type: Mapped[str] = mapped_column(
        String(30),
        default="batch",
        nullable=False,  # 'batch', 'weak_words', 'mixed'
    )
    total_questions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    correct_answers: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    score_percent: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="in_progress",
        nullable=False,  # 'in_progress', 'completed', 'abandoned'
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    questions: Mapped[List["QuizQuestion"]] = relationship(
        "QuizQuestion",
        back_populates="attempt",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.id",
        lazy="selectin",
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    quiz_attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("words.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    options: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
    )
    correct_answer: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # Hidden server-side! Never returned before submission
    )
    user_selected: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_correct: Mapped[Optional[bool]] = mapped_column(
        Boolean,
        nullable=True,
    )
    answered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    attempt: Mapped["QuizAttempt"] = relationship("QuizAttempt", back_populates="questions")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_type: Mapped[str] = mapped_column(
        String(30),
        default="review",
        nullable=False,  # 'review', 'quiz', 'story', 'practice'
    )
    source: Mapped[str] = mapped_column(
        String(20),
        default="web",
        nullable=False,  # 'web' | 'telegram'
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    last_heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    active_duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )


class DailyActivity(Base):
    __tablename__ = "daily_activity"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_date: Mapped[date] = mapped_column(
        Date,
        default=today_date,
        nullable=False,
        index=True,
    )
    total_active_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    words_learned: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    words_reviewed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    quizzes_taken: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    streak_day_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "activity_date", name="uq_user_activity_date"),
    )
