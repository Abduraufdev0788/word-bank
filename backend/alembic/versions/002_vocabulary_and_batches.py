"""Vocabulary and batches tables

Revision ID: 002_vocabulary_and_batches
Revises: 001_initial_user_tables
Create Date: 2026-10-24 16:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '002_vocabulary_and_batches'
down_revision: Union[str, None] = '001_initial_user_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. word_batches table
    op.create_table(
        'word_batches',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('batch_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('source_file_name', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='learning'),
        sa.Column('word_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_complete', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'batch_number', name='uq_user_batch_number')
    )
    op.create_index(op.f('ix_word_batches_user_id'), 'word_batches', ['user_id'], unique=False)

    # 2. words table
    op.create_table(
        'words',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=True),
        sa.Column('english_word', sa.String(length=150), nullable=False),
        sa.Column('uzbek_translation', sa.Text(), nullable=False),
        sa.Column('part_of_speech', sa.String(length=50), nullable=True),
        sa.Column('phonetic', sa.String(length=100), nullable=True),
        sa.Column('audio_url', sa.String(length=500), nullable=True),
        sa.Column('cefr_level', sa.String(length=10), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('order_in_batch', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['batch_id'], ['word_batches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'english_word', name='uq_user_english_word')
    )
    op.create_index(op.f('ix_words_english_word'), 'words', ['english_word'], unique=False)
    op.create_index(op.f('ix_words_user_id'), 'words', ['user_id'], unique=False)
    op.create_index(op.f('ix_words_batch_id'), 'words', ['batch_id'], unique=False)

    # 3. word_examples table
    op.create_table(
        'word_examples',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('word_id', sa.UUID(), nullable=False),
        sa.Column('sentence_en', sa.Text(), nullable=False),
        sa.Column('sentence_uz', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['word_id'], ['words.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_word_examples_word_id'), 'word_examples', ['word_id'], unique=False)

    # 4. word_progress table
    op.create_table(
        'word_progress',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('word_id', sa.UUID(), nullable=False),
        sa.Column('repetition_number', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ease_factor', sa.Float(), nullable=False, server_default='2.5'),
        sa.Column('interval_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('times_reviewed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('times_correct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('times_incorrect', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_mastered', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_weak', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['word_id'], ['words.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('word_id')
    )
    op.create_index(op.f('ix_word_progress_due_date'), 'word_progress', ['due_date'], unique=False)
    op.create_index(op.f('ix_word_progress_user_id'), 'word_progress', ['user_id'], unique=False)
    op.create_index(op.f('ix_word_progress_word_id'), 'word_progress', ['word_id'], unique=True)

    # 5. import_jobs table
    op.create_table(
        'import_jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=10), nullable=False),
        sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('imported_words_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duplicate_words_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_rows_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_import_jobs_user_id'), 'import_jobs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('import_jobs')
    op.drop_table('word_progress')
    op.drop_table('word_examples')
    op.drop_table('words')
    op.drop_table('word_batches')
