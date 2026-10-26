from fastapi import APIRouter
from app.api.v1.endpoints import (
    analytics,
    auth,
    batches,
    imports,
    quizzes,
    reviews,
    stories,
    study_sessions,
    telegram,
    translations,
    users,
    vocabulary,
    speaking,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autentifikatsiya"])
api_router.include_router(users.router, prefix="/users", tags=["Foydalanuvchi sozlamalari"])
api_router.include_router(batches.router, prefix="/batches", tags=["Lug'at to'plamlari"])
api_router.include_router(vocabulary.router, prefix="/vocabulary", tags=["Lug'at so'zlari"])
api_router.include_router(imports.router, prefix="/imports", tags=["Fayllarni import qilish"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["Kunlik takrorlash (SRS)"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["Testlar va Mashqlar (Anti-Cheat)"])
api_router.include_router(study_sessions.router, prefix="/study-sessions", tags=["Faol vaqtni kuzatish"])
api_router.include_router(translations.router, prefix="/translations", tags=["AI Tarjima va Boyitish"])
api_router.include_router(stories.router, prefix="/stories", tags=["AI Mini Hikoyalar"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["Telegram Bot Integratsiyasi"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analitika va Boshqaruv paneli"])
api_router.include_router(speaking.router, prefix="/speaking", tags=["AI Speaking & Talaffuz Murabbiyi"])



