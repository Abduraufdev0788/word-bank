import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class WordBatch(Base):
    __tablename__ = "word_batches"

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
    batch_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    source_file_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="learning",  # 'new', 'learning', 'reviewed', 'mastered'
        nullable=False,
    )
    word_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_complete: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    words: Mapped[List["Word"]] = relationship(
        "Word",
        back_populates="batch",
        order_by="Word.order_in_batch",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "batch_number", name="uq_user_batch_number"),
    )


class Word(Base):
    __tablename__ = "words"

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
    english_word: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )
    uzbek_translation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    part_of_speech: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    phonetic: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    audio_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    cefr_level: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    order_in_batch: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    batch: Mapped[Optional["WordBatch"]] = relationship(
        "WordBatch",
        back_populates="words",
    )
    examples: Mapped[List["WordExample"]] = relationship(
        "WordExample",
        back_populates="word",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    progress: Mapped[Optional["WordProgress"]] = relationship(
        "WordProgress",
        back_populates="word",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "english_word", name="uq_user_english_word"),
    )


class WordExample(Base):
    __tablename__ = "word_examples"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("words.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sentence_en: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    sentence_uz: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    word: Mapped["Word"] = relationship("Word", back_populates="examples")


class WordProgress(Base):
    __tablename__ = "word_progress"

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
        unique=True,
        nullable=False,
        index=True,
    )
    repetition_number: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    ease_factor: Mapped[float] = mapped_column(
        Float,
        default=2.5,
        nullable=False,
    )
    interval_days: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    times_reviewed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    times_correct: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    times_incorrect: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_mastered: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_weak: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    word: Mapped["Word"] = relationship("Word", back_populates="progress")


class ImportJob(Base):
    __tablename__ = "import_jobs"

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
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,  # txt, csv, xlsx
    )
    total_rows: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    imported_words_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    duplicate_words_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    failed_rows_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
