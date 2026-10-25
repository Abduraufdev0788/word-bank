"""Initial user and account tables

Revision ID: 001_initial_user_tables
Revises: 
Create Date: 2026-10-24 15:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_user_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. user_settings table
    op.create_table(
        'user_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('preferred_cefr_level', sa.String(length=10), nullable=False, server_default='B1'),
        sa.Column('daily_words_goal', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('daily_review_goal', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('daily_study_time_minutes', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Tashkent'),
        sa.Column('theme', sa.String(length=20), nullable=False, server_default='dark'),
        sa.Column('audio_accent', sa.String(length=10), nullable=False, server_default='us'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_settings_user_id'), 'user_settings', ['user_id'], unique=True)

    # 3. telegram_accounts table
    op.create_table(
        'telegram_accounts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('telegram_user_id', sa.BigInteger(), nullable=False),
        sa.Column('telegram_chat_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=True),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('is_notifications_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('linked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('telegram_user_id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_telegram_accounts_telegram_user_id'), 'telegram_accounts', ['telegram_user_id'], unique=True)
    op.create_index(op.f('ix_telegram_accounts_user_id'), 'telegram_accounts', ['user_id'], unique=True)

    # 4. account_link_tokens table
    op.create_table(
        'account_link_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index(op.f('ix_account_link_tokens_token'), 'account_link_tokens', ['token'], unique=True)
    op.create_index(op.f('ix_account_link_tokens_user_id'), 'account_link_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('account_link_tokens')
    op.drop_table('telegram_accounts')
    op.drop_table('user_settings')
    op.drop_table('users')
