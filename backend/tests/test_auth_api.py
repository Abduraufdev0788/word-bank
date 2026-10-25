import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "SmartVocab AI" in data["service"]

    v1_response = await client.get("/api/v1/health")
    assert v1_response.status_code == 200


@pytest.mark.asyncio
async def test_user_registration_success(client: AsyncClient):
    payload = {
        "email": "learner@smartvocab.uz",
        "password": "StrongPassword2026!",
        "full_name": "Abdurauf",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


@pytest.mark.asyncio
async def test_duplicate_registration_fails(client: AsyncClient):
    payload = {
        "email": "duplicate@smartvocab.uz",
        "password": "StrongPassword2026!",
        "full_name": "Test User",
    }
    # First registration
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    # Second registration with same email
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 400
    assert "allaqachon" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_registration_weak_password_fails(client: AsyncClient):
    payload = {
        "email": "short@smartvocab.uz",
        "password": "short",  # Less than 8 chars
        "full_name": "Short Pass",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_flow(client: AsyncClient):
    # Register first
    email = "login_test@smartvocab.uz"
    password = "CorrectPassword123"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Login Tester"},
    )

    # Attempt login with correct password
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    assert "access_token" in tokens

    # Attempt login with wrong password
    bad_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword!"},
    )
    assert bad_resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_profile(client: AsyncClient):
    email = "profile_user@smartvocab.uz"
    password = "ProfilePassword123"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Profile User"},
    )
    access_token = reg_resp.json()["access_token"]

    # Request without token -> 401
    unauth_resp = await client.get("/api/v1/auth/me")
    assert unauth_resp.status_code == 401

    # Request with valid Bearer token -> 200
    headers = {"Authorization": f"Bearer {access_token}"}
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    user_data = me_resp.json()
    assert user_data["email"] == email
    assert user_data["full_name"] == "Profile User"
    assert user_data["is_active"] is True
    assert user_data["is_telegram_linked"] is False
    assert user_data["settings"]["preferred_cefr_level"] == "B1"
    assert user_data["settings"]["daily_words_goal"] == 10


@pytest.mark.asyncio
async def test_refresh_token_flow(client: AsyncClient):
    email = "refresh_user@smartvocab.uz"
    password = "RefreshPassword123"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    refresh_token = reg_resp.json()["refresh_token"]

    # Refresh the token
    ref_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref_resp.status_code == 200
    data = ref_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_update_settings_and_password(client: AsyncClient):
    email = "settings_user@smartvocab.uz"
    password = "OldPassword123"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    access_token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Update settings
    update_payload = {
        "preferred_cefr_level": "B2",
        "daily_words_goal": 25,
        "theme": "dark",
    }
    put_resp = await client.put(
        "/api/v1/users/settings",
        json=update_payload,
        headers=headers,
    )
    assert put_resp.status_code == 200
    updated = put_resp.json()
    assert updated["preferred_cefr_level"] == "B2"
    assert updated["daily_words_goal"] == 25

    # Change password
    pwd_resp = await client.put(
        "/api/v1/users/password",
        json={
            "current_password": password,
            "new_password": "BrandNewPassword2026!",
        },
        headers=headers,
    )
    assert pwd_resp.status_code == 200

    # Old password no longer works
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert old_login.status_code == 401

    # New password works
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "BrandNewPassword2026!"},
    )
    assert new_login.status_code == 200
