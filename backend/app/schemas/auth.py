import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters long")
    full_name: Optional[str] = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    refresh_token: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    preferred_cefr_level: str
    daily_words_goal: int
    daily_review_goal: int
    daily_study_time_minutes: int
    timezone: str
    theme: str
    audio_accent: str


class UserSettingsUpdate(BaseModel):
    preferred_cefr_level: Optional[str] = None
    daily_words_goal: Optional[int] = None
    daily_review_goal: Optional[int] = None
    daily_study_time_minutes: Optional[int] = None
    timezone: Optional[str] = None
    theme: Optional[str] = None
    audio_accent: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    settings: Optional[UserSettingsOut] = None
    is_telegram_linked: bool = False
