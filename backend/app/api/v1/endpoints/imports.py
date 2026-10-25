from typing import Any, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.vocabulary import (
    ImportCommitResponse,
    ImportPreviewResponse,
)
from app.services.import_service import (
    execute_commit_import,
    generate_import_preview,
)

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB limit
ALLOWED_EXTENSIONS = {"txt", "csv", "xlsx", "xls"}


def validate_file(file: UploadFile) -> str:
    """Validates file presence and extension."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fayl tanlanmadi",
        )
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Noto'g'ri fayl formati: .{ext}. Faqat TXT, CSV va XLSX fayllar qabul qilinadi.",
        )
    return ext


@router.post(
    "/preview",
    response_model=ImportPreviewResponse,
    summary="Yuklanayotgan lug'at faylini tahlil qilish (Oldindan ko'rish)",
)
async def preview_import_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Parses uploaded file and returns row preview, detected columns, and duplicate counts."""
    validate_file(file)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Fayl hajmi 5 MB dan oshmasligi kerak",
        )

    try:
        preview = await generate_import_preview(
            user_id=current_user.id,
            file_name=file.filename or "unknown",
            file_bytes=content,
            db=db,
        )
        return preview
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faylni tahlil qilishda xatolik yuz berdi: {str(e)}",
        )


@router.post(
    "/commit",
    response_model=ImportCommitResponse,
    summary="Fayldagi so'zlarni tasdiqlash va 20 talik to'plamlarga bo'lib saqlash",
)
async def commit_import_file(
    file: UploadFile = File(...),
    skip_duplicates: bool = Form(default=True),
    fill_incomplete_batch: bool = Form(default=True),
    en_column: Optional[str] = Form(default=None),
    uz_column: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Commits valid words into 20-word batches transactionally."""
    validate_file(file)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Fayl hajmi 5 MB dan oshmasligi kerak",
        )

    try:
        response = await execute_commit_import(
            user_id=current_user.id,
            file_name=file.filename or "uploaded_file",
            file_bytes=content,
            db=db,
            skip_duplicates=skip_duplicates,
            fill_incomplete_batch=fill_incomplete_batch,
            custom_en_col=en_column,
            custom_uz_col=uz_column,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Importni saqlashda xatolik yuz berdi: {str(e)}",
        )
