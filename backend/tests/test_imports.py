import io
import pytest
import openpyxl
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str = "importer@smartvocab.uz") -> str:
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "ImporterPassword123!"},
    )
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_txt_import_preview_and_commit(client: AsyncClient):
    token = await get_auth_token(client, "txt_user@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    # Generate 45 words in TXT format
    txt_lines = [f"word_{i} - tarjima_{i}" for i in range(1, 46)]
    txt_content = "\n".join(txt_lines).encode("utf-8")

    # 1. Preview
    files = {"file": ("test_words.txt", io.BytesIO(txt_content), "text/plain")}
    preview_resp = await client.post("/api/v1/imports/preview", files=files, headers=headers)
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert preview_data["total_detected_rows"] == 45
    assert preview_data["valid_rows_count"] == 45
    assert preview_data["duplicate_candidates_count"] == 0
    assert preview_data["batches_to_create"] == 3  # 20 + 20 + 5 -> 3 batches
    assert len(preview_data["preview_rows"]) == 15

    # 2. Commit
    files = {"file": ("test_words.txt", io.BytesIO(txt_content), "text/plain")}
    data = {"skip_duplicates": "true", "fill_incomplete_batch": "true"}
    commit_resp = await client.post(
        "/api/v1/imports/commit", files=files, data=data, headers=headers
    )
    assert commit_resp.status_code == 200
    commit_data = commit_resp.json()
    assert commit_data["total_imported"] == 45
    assert commit_data["total_skipped_duplicates"] == 0

    # 3. Check resulting batches: Should have 3 batches (20, 20, 5)
    batches_resp = await client.get("/api/v1/batches", headers=headers)
    assert batches_resp.status_code == 200
    batches = batches_resp.json()
    assert len(batches) == 3
    assert batches[0]["word_count"] == 20
    assert batches[0]["is_complete"] is True
    assert batches[1]["word_count"] == 20
    assert batches[1]["is_complete"] is True
    assert batches[2]["word_count"] == 5
    assert batches[2]["is_complete"] is False


@pytest.mark.asyncio
async def test_csv_import_with_headers_and_duplicates(client: AsyncClient):
    token = await get_auth_token(client, "csv_user@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    # CSV with headers and a duplicate
    csv_text = "English,Uzbek\napple,olma\nbook,kitob\napple,olma (takror)\nsun,quyosh\n"
    csv_bytes = csv_text.encode("utf-8")

    files = {"file": ("words.csv", io.BytesIO(csv_bytes), "text/csv")}
    preview_resp = await client.post("/api/v1/imports/preview", files=files, headers=headers)
    assert preview_resp.status_code == 200
    pdata = preview_resp.json()
    assert pdata["total_detected_rows"] == 4
    assert pdata["duplicate_candidates_count"] == 1

    # Commit with skip_duplicates=True
    files = {"file": ("words.csv", io.BytesIO(csv_bytes), "text/csv")}
    commit_resp = await client.post(
        "/api/v1/imports/commit",
        files=files,
        data={"skip_duplicates": "true"},
        headers=headers,
    )
    assert commit_resp.status_code == 200
    cdata = commit_resp.json()
    assert cdata["total_imported"] == 3
    assert cdata["total_skipped_duplicates"] == 1


@pytest.mark.asyncio
async def test_xlsx_import(client: AsyncClient):
    token = await get_auth_token(client, "xlsx_user@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    # Create XLSX in-memory
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Vocabulary"
    ws.append(["Term", "Meaning"])
    ws.append(["resilient", "bardoshli"])
    ws.append(["diligent", "tirishqoq"])
    ws.append(["serendipity", "kutilmagan yoqimli tasodif"])

    xlsx_buffer = io.BytesIO()
    wb.save(xlsx_buffer)
    xlsx_bytes = xlsx_buffer.getvalue()

    files = {"file": ("sample.xlsx", io.BytesIO(xlsx_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    preview_resp = await client.post("/api/v1/imports/preview", files=files, headers=headers)
    assert preview_resp.status_code == 200
    pdata = preview_resp.json()
    assert pdata["valid_rows_count"] == 3

    # Commit
    files = {"file": ("sample.xlsx", io.BytesIO(xlsx_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    commit_resp = await client.post("/api/v1/imports/commit", files=files, headers=headers)
    assert commit_resp.status_code == 200
    assert commit_resp.json()["total_imported"] == 3


@pytest.mark.asyncio
async def test_invalid_file_extension(client: AsyncClient):
    token = await get_auth_token(client, "bad_file@smartvocab.uz")
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("malicious.exe", io.BytesIO(b"binary"), "application/octet-stream")}
    resp = await client.post("/api/v1/imports/preview", files=files, headers=headers)
    assert resp.status_code == 400
    assert "noto'g'ri fayl formati" in resp.json()["detail"].lower()
