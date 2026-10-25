"""Learning engine and study time tables

Revision ID: 003_learning_engine
Revises: 002_vocabulary_and_batches
Create Date: 2026-10-24 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '003_learning_engine'
down_revision: Union[str, None] = '002_vocabulary_and_batches'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. word_reviews
    op.create_table(
        'word_reviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('word_id', sa.UUID(), nullable=False),
        sa.Column('review_source', sa.String(length=20), nullable=False, server_default='web'),
        sa.Column('review_type', sa.String(length=30), nullable=False, server_default='multiple_choice'),
        sa.Column('quality_rating', sa.Integer(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('user_answer', sa.Text(), nullable=True),
        sa.Column('time_spent_ms', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['word_id'], ['words.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_word_reviews_user_id'), 'word_reviews', ['user_id'], unique=False)
    op.create_index(op.f('ix_word_reviews_word_id'), 'word_reviews', ['word_id'], unique=False)
    op.create_index(op.f('ix_word_reviews_created_at'), 'word_reviews', ['created_at'], unique=False)

    # 2. quiz_attempts
    op.create_table(
        'quiz_attempts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=True),
        sa.Column('quiz_type', sa.String(length=30), nullable=False, server_default='batch'),
        sa.Column('total_questions', sa.Integer(), nullable=False),
        sa.Column('correct_answers', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('score_percent', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='in_progress'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['word_batches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quiz_attempts_user_id'), 'quiz_attempts', ['user_id'], unique=False)
    op.create_index(op.f('ix_quiz_attempts_batch_id'), 'quiz_attempts', ['batch_id'], unique=False)

    # 3. quiz_questions
    op.create_table(
        'quiz_questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('quiz_attempt_id', sa.UUID(), nullable=False),
        sa.Column('word_id', sa.UUID(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=False),
        sa.Column('correct_answer', sa.Text(), nullable=False),
        sa.Column('user_selected', sa.Text(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['quiz_attempt_id'], ['quiz_attempts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['word_id'], ['words.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quiz_questions_quiz_attempt_id'), 'quiz_questions', ['quiz_attempt_id'], unique=False)

    # 4. study_sessions
    op.create_table(
        'study_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('activity_type', sa.String(length=30), nullable=False, server_default='review'),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='web'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_heartbeat_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('active_duration_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_study_sessions_user_id'), 'study_sessions', ['user_id'], unique=False)

    # 5. daily_activity
    op.create_table(
        'daily_activity',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('activity_date', sa.Date(), nullable=False),
        sa.Column('total_active_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('words_learned', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('words_reviewed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quizzes_taken', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('streak_day_count', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'activity_date', name='uq_user_activity_date')
    )
    op.create_index(op.f('ix_daily_activity_user_id'), 'daily_activity', ['user_id'], unique=False)
    op.create_index(op.f('ix_daily_activity_activity_date'), 'daily_activity', ['activity_date'], unique=False)


def downgrade() -> None:
    op.drop_table('daily_activity')
    op.drop_table('study_sessions')
    op.drop_table('quiz_questions')
    op.drop_table('quiz_attempts')
    op.drop_table('word_reviews')
