import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MiniStory(Base):
    __tablename__ = "mini_stories"

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
    cefr_level: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="B1",
    )
    title_en: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    title_uz: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    content_en: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    content_uz: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    target_words: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    comprehension_questions: Mapped[List[dict]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    batch: Mapped[Optional["WordBatch"]] = relationship("WordBatch", lazy="selectin")
