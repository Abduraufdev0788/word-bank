import asyncio
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.learning import StudySession


@pytest.mark.asyncio
async def test_study_session_tracking_flow(client: AsyncClient, test_session):
    # Register user
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "timer_user@smartvocab.uz", "password": "TimerPassword2026!"},
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start study session
    start_resp = await client.post(
        "/api/v1/study-sessions/start",
        json={"activity_type": "review", "source": "web"},
        headers=headers,
    )
    assert start_resp.status_code == 201
    session_data = start_resp.json()
    session_id = session_data["id"]
    assert session_data["is_active"] is True
    assert session_data["active_duration_seconds"] == 0

    # Simulate 1 second passing and send heartbeat
    await asyncio.sleep(1)
    hb_resp = await client.post(
        f"/api/v1/study-sessions/{session_id}/heartbeat",
        headers=headers,
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["active_duration_seconds"] >= 1

    # 2. Test Idle cutoff: simulate a 10-minute idle gap in database
    import uuid
    db_session = (await test_session.execute(
        select(StudySession).where(StudySession.id == uuid.UUID(session_id))
    )).scalar_one()
    # Backdate last heartbeat by 10 minutes (600s)
    db_session.last_heartbeat_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    await test_session.commit()

    duration_before = db_session.active_duration_seconds
    # Heartbeat arrives after 10 minutes idle
    idle_hb_resp = await client.post(
        f"/api/v1/study-sessions/{session_id}/heartbeat",
        headers=headers,
    )
    assert idle_hb_resp.status_code == 200
    # Active duration must NOT jump by 600s!
    assert idle_hb_resp.json()["active_duration_seconds"] == duration_before

    # 3. Stop study session
    end_resp = await client.post(
        f"/api/v1/study-sessions/{session_id}/end",
        headers=headers,
    )
    assert end_resp.status_code == 200
    assert end_resp.json()["is_active"] is False

    # 4. Check study time summary stats
    stats_resp = await client.get("/api/v1/study-sessions/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "today_active_seconds" in stats
    assert "total_active_seconds" in stats
