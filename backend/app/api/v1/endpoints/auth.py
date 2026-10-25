import uuid
from typing import Any
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User, UserSettings
from app.schemas.auth import (
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserOut,
    UserRegister,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi foydalanuvchini ro'yxatdan o'tkazish",
)
async def register(
    user_in: UserRegister,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Register a new user account with default settings."""
    # Check if email is already registered
    existing_stmt = select(User).where(User.email == user_in.email.lower().strip())
    existing_user = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ushbu email bilan foydalanuvchi allaqachon ro'yxatdan o'tgan",
        )

    # Create new user
    new_user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()  # Populate new_user.id

    # Create default user settings
    user_settings = UserSettings(
        user_id=new_user.id,
        preferred_cefr_level="B1",
        daily_words_goal=settings.DEFAULT_DAILY_WORDS_GOAL,
        daily_review_goal=20,
        daily_study_time_minutes=settings.DEFAULT_DAILY_STUDY_TIME_MINUTES,
        timezone="Asia/Tashkent",
        theme="dark",
        audio_accent="us",
    )
    db.add(user_settings)
    await db.commit()

    # Generate JWT tokens
    access_token = create_access_token(subject=str(new_user.id))
    refresh_token = create_refresh_token(subject=str(new_user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Tizimga kirish va tokenlar olish",
)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Authenticate with email and password."""
    stmt = select(User).where(User.email == login_data.email.lower().strip())
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Noto'g'ri email yoki parol kiritildi",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Foydalanuvchi hisobi faol emas",
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Access tokenni yangilash (Refresh token orqali)",
)
async def refresh_access_token(
    refresh_in: TokenRefresh,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Refreshes the access token using a valid refresh token."""
    try:
        payload = decode_token(refresh_in.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Yaroqsiz token turi",
            )
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tokenda identifikator topilmadi",
            )
        user_id = uuid.UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token yaroqsiz yoki muddati o'tgan",
        )

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Foydalanuvchi hisobi mavjud emas yoki faol emas",
        )

    new_access_token = create_access_token(subject=str(user.id))
    new_refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get(
    "/me",
    response_model=UserOut,
    summary="Joriy foydalanuvchi ma'lumotlari",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Returns profile and settings of current authenticated user."""
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        settings=current_user.settings,
        is_telegram_linked=current_user.telegram_account is not None,
    )
