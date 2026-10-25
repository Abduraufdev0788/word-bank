"""Mini stories table

Revision ID: 004_mini_stories
Revises: 003_learning_engine
Create Date: 2026-10-24 17:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '004_mini_stories'
down_revision: Union[str, None] = '003_learning_engine'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mini_stories',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=True),
        sa.Column('cefr_level', sa.String(length=10), nullable=False, server_default='B1'),
        sa.Column('title_en', sa.String(length=200), nullable=False),
        sa.Column('title_uz', sa.String(length=200), nullable=False),
        sa.Column('content_en', sa.Text(), nullable=False),
        sa.Column('content_uz', sa.Text(), nullable=False),
        sa.Column('target_words', sa.JSON(), nullable=False),
        sa.Column('comprehension_questions', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['batch_id'], ['word_batches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mini_stories_user_id'), 'mini_stories', ['user_id'], unique=False)
    op.create_index(op.f('ix_mini_stories_batch_id'), 'mini_stories', ['batch_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mini_stories_batch_id'), table_name='mini_stories')
    op.drop_index(op.f('ix_mini_stories_user_id'), table_name='mini_stories')
    op.drop_table('mini_stories')
