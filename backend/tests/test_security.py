from datetime import timedelta
import pytest
import jwt
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hashing_and_verification():
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)

    # Hash should not match plain text
    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    # Correct password verifies
    assert verify_password(raw_password, hashed) is True

    # Wrong password fails verification
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_access_token():
    subject = "123e4567-e89b-12d3-a456-426614174000"
    token = create_access_token(subject=subject)

    payload = decode_token(token)
    assert payload["sub"] == subject
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_refresh_token():
    subject = "123e4567-e89b-12d3-a456-426614174000"
    token = create_refresh_token(subject=subject)

    payload = decode_token(token)
    assert payload["sub"] == subject
    assert payload["type"] == "refresh"


def test_expired_token():
    subject = "123e4567-e89b-12d3-a456-426614174000"
    # Token that expired 5 minutes ago
    expired_token = create_access_token(
        subject=subject,
        expires_delta=timedelta(minutes=-5),
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expired_token)
