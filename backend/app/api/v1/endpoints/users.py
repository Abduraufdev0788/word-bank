from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import (
    PasswordChange,
    UserSettingsOut,
    UserSettingsUpdate,
)

router = APIRouter()


@router.get(
    "/settings",
    response_model=UserSettingsOut,
    summary="Foydalanuvchi ta'lim sozlamalarini olish",
)
async def get_settings(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Returns the settings of the current active user."""
    if not current_user.settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foydalanuvchi sozlamalari topilmadi",
        )
    return current_user.settings


@router.put(
    "/settings",
    response_model=UserSettingsOut,
    summary="Foydalanuvchi ta'lim sozlamalarini yangilash",
)
async def update_settings(
    settings_in: UserSettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Updates learning settings (CEFR level, goals, timezone, theme)."""
    user_settings = current_user.settings
    if not user_settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foydalanuvchi sozlamalari topilmadi",
        )

    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user_settings, field, value)

    await db.commit()
    await db.refresh(user_settings)
    return user_settings


@router.put(
    "/password",
    status_code=status.HTTP_200_OK,
    summary="Parolni xavfsiz yangilash",
)
async def change_password(
    password_in: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Changes user password after verifying current password."""
    if not verify_password(password_in.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Joriy parol noto'g'ri kiritildi",
        )

    current_user.hashed_password = hash_password(password_in.new_password)
    await db.commit()
    return {"message": "Parol muvaffaqiyatli yangilandi"}
