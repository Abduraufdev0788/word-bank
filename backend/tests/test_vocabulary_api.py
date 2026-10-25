import pytest
from httpx import AsyncClient


async def create_user_and_get_token(client: AsyncClient, email: str) -> str:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password12345!"},
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_word_and_auto_batching(client: AsyncClient):
    token = await create_user_and_get_token(client, "word_tester@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "english_word": "Perseverance",
        "uzbek_translation": "Matonat, tirishqoqlik",
        "part_of_speech": "noun",
        "phonetic": "/ˌpɜː.sɪˈvɪə.rəns/",
        "cefr_level": "C1",
        "notes": "Qiyinchiliklarga qaramay davom etish",
        "examples": [
            {
                "sentence_en": "Success requires hard work and perseverance.",
                "sentence_uz": "Muvaffaqiyat mehnat va matonatni talab qiladi.",
            }
        ],
    }

    resp = await client.post("/api/v1/vocabulary", json=payload, headers=headers)
    assert resp.status_code == 201
    word_data = resp.json()
    assert word_data["english_word"] == "perseverance"
    assert word_data["part_of_speech"] == "noun"
    assert word_data["batch_id"] is not None
    assert len(word_data["examples"]) == 1
    assert word_data["progress"] is not None
    assert word_data["progress"]["ease_factor"] == 2.5

    # Check that a batch was created
    batches_resp = await client.get("/api/v1/batches", headers=headers)
    assert batches_resp.status_code == 200
    batches = batches_resp.json()
    assert len(batches) == 1
    assert batches[0]["batch_number"] == 1
    assert batches[0]["word_count"] == 1
    assert batches[0]["is_complete"] is False


@pytest.mark.asyncio
async def test_duplicate_word_rejected(client: AsyncClient):
    token = await create_user_and_get_token(client, "dup_word@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    word = {"english_word": "Adventure", "uzbek_translation": "Sarguzasht"}
    r1 = await client.post("/api/v1/vocabulary", json=word, headers=headers)
    assert r1.status_code == 201

    # Attempt to add exact same word (case-insensitive)
    r2 = await client.post(
        "/api/v1/vocabulary",
        json={"english_word": "adventure", "uzbek_translation": "Boshqa tarjima"},
        headers=headers,
    )
    assert r2.status_code == 400
    assert "allaqachon mavjud" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_search_and_filter_vocabulary(client: AsyncClient):
    token = await create_user_and_get_token(client, "searcher@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    # Add 3 words
    await client.post("/api/v1/vocabulary", json={"english_word": "Apple", "uzbek_translation": "Olma", "cefr_level": "A1"}, headers=headers)
    await client.post("/api/v1/vocabulary", json={"english_word": "Pineapple", "uzbek_translation": "Ananas", "cefr_level": "A2"}, headers=headers)
    await client.post("/api/v1/vocabulary", json={"english_word": "Mountain", "uzbek_translation": "Tog'", "cefr_level": "B1"}, headers=headers)

    # Search for "apple"
    resp = await client.get("/api/v1/vocabulary?search=apple", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2  # Apple and Pineapple

    # Search by Uzbek: "Tog"
    resp_uz = await client.get("/api/v1/vocabulary?search=Tog", headers=headers)
    assert resp_uz.status_code == 200
    assert len(resp_uz.json()) == 1
    assert resp_uz.json()[0]["english_word"] == "mountain"

    # Filter by level "A1"
    resp_lvl = await client.get("/api/v1/vocabulary?cefr_level=A1", headers=headers)
    assert resp_lvl.status_code == 200
    assert len(resp_lvl.json()) == 1
    assert resp_lvl.json()[0]["english_word"] == "apple"


@pytest.mark.asyncio
async def test_update_and_delete_word(client: AsyncClient):
    token = await create_user_and_get_token(client, "editor@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    # Create word
    create_resp = await client.post(
        "/api/v1/vocabulary",
        json={"english_word": "Brave", "uzbek_translation": "Jasur"},
        headers=headers,
    )
    word_id = create_resp.json()["id"]

    # Update word
    put_resp = await client.put(
        f"/api/v1/vocabulary/{word_id}",
        json={"uzbek_translation": "Qo'rqmas, jasur", "phonetic": "/breɪv/"},
        headers=headers,
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["uzbek_translation"] == "Qo'rqmas, jasur"
    assert put_resp.json()["phonetic"] == "/breɪv/"

    # Delete word
    del_resp = await client.delete(f"/api/v1/vocabulary/{word_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify deleted
    get_resp = await client.get(f"/api/v1/vocabulary/{word_id}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_multi_tenant_user_isolation(client: AsyncClient):
    # User A creates a word
    token_a = await create_user_and_get_token(client, "user_a@smartvocab.uz")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    resp_a = await client.post(
        "/api/v1/vocabulary",
        json={"english_word": "SecretA", "uzbek_translation": "Sir A"},
        headers=headers_a,
    )
    word_a_id = resp_a.json()["id"]
    batch_a_id = resp_a.json()["batch_id"]

    # User B logs in
    token_b = await create_user_and_get_token(client, "user_b@smartvocab.uz")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to access User A's word -> 404
    word_b_resp = await client.get(f"/api/v1/vocabulary/{word_a_id}", headers=headers_b)
    assert word_b_resp.status_code == 404

    # User B attempts to delete User A's word -> 404
    del_b_resp = await client.delete(f"/api/v1/vocabulary/{word_a_id}", headers=headers_b)
    assert del_b_resp.status_code == 404

    # User B attempts to view User A's batch -> 404
    batch_b_resp = await client.get(f"/api/v1/batches/{batch_a_id}", headers=headers_b)
    assert batch_b_resp.status_code == 404


@pytest.mark.asyncio
async def test_export_vocabulary_csv_and_json(client: AsyncClient):
    token = await create_user_and_get_token(client, "exporter@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        "/api/v1/vocabulary",
        json={"english_word": "ExportWord", "uzbek_translation": "Eksport so'z"},
        headers=headers,
    )

    # Export CSV
    csv_resp = await client.get("/api/v1/vocabulary/export?format=csv", headers=headers)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "exportword" in csv_resp.text.lower()

    # Export JSON
    json_resp = await client.get("/api/v1/vocabulary/export?format=json", headers=headers)
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    data = json_resp.json()
    assert len(data) == 1
    assert data[0]["english_word"] == "exportword"
