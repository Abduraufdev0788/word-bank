import logging
from typing import Any, Dict, List, Optional
import httpx

from bot.config import bot_settings

logger = logging.getLogger(__name__)


class BackendAPIClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or bot_settings.BACKEND_INTERNAL_API_URL).rstrip("/")

    async def _request(
        self,
        method: str,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.request(method, url, json=json, params=params)
                if res.status_code in [200, 201]:
                    return res.json()
                elif res.status_code == 404:
                    return None
                elif res.status_code == 409:
                    error_data = res.json()
                    return {"error": error_data.get("detail", "Konflikt")}
                else:
                    logger.error(f"Backend API error {res.status_code} on {url}: {res.text}")
                    return None
        except Exception as e:
            logger.error(f"HTTP request error to {url}: {e}")
            return None

    # --- Account Linking ---

    async def verify_link(
        self,
        token: str,
        telegram_user_id: int,
        telegram_chat_id: int,
        username: Optional[str] = None,
        first_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/telegram/verify-link"
        payload = {
            "token": token,
            "telegram_user_id": telegram_user_id,
            "telegram_chat_id": telegram_chat_id,
            "username": username,
            "first_name": first_name,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    return {"success": True, "data": res.json()}
                detail = res.json().get("detail", "Bog'lashda xatolik yuz berdi.")
                return {"success": False, "error": detail}
        except Exception as e:
            logger.error(f"Error in verify_link: {e}")
            return {"success": False, "error": "Server bilan ulanishda xatolik."}

    async def get_user_summary(self, telegram_user_id: int) -> Optional[Dict[str, Any]]:
        return await self._request("GET", f"/telegram/user/{telegram_user_id}")

    async def unlink_account(self, telegram_user_id: int) -> bool:
        res = await self._request("POST", f"/telegram/unlink/{telegram_user_id}")
        return res is not None and res.get("success", False)

    # --- Review Queue & Submit ---

    async def get_review_queue(
        self,
        telegram_user_id: int,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        res = await self._request(
            "GET",
            f"/telegram/review/queue/{telegram_user_id}",
            params={"limit": limit},
        )
        if isinstance(res, list):
            return res
        return []

    async def submit_review(
        self,
        telegram_user_id: int,
        word_id: str,
        quality_rating: int,
        user_answer: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        payload = {
            "word_id": word_id,
            "quality_rating": quality_rating,
            "user_answer": user_answer,
        }
        return await self._request(
            "POST",
            f"/telegram/review/submit/{telegram_user_id}",
            json=payload,
        )

    # --- Vocabulary & Batches ---

    async def quick_add_word(
        self,
        telegram_user_id: int,
        english_word: str,
        uzbek_translation: Optional[str] = None,
        auto_enrich: bool = True,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/telegram/vocabulary/quick-add/{telegram_user_id}"
        payload = {
            "english_word": english_word,
            "uzbek_translation": uzbek_translation,
            "auto_enrich": auto_enrich,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 201:
                    return {"success": True, "word": res.json()}
                detail = res.json().get("detail", "So'z qo'shishda xatolik.")
                return {"success": False, "error": detail}
        except Exception as e:
            logger.error(f"Error in quick_add_word: {e}")
            return {"success": False, "error": "Server bilan ulanishda xatolik."}

    async def get_batches(self, telegram_user_id: int) -> List[Dict[str, Any]]:
        res = await self._request("GET", f"/telegram/batches/{telegram_user_id}")
        if isinstance(res, list):
            return res
        return []

    async def quick_translate(
        self,
        text: str,
        source_lang: str = "en",
        target_lang: str = "uz",
    ) -> Optional[str]:
        # Uses public quick translate
        url = f"{self.base_url}/translations/quick"
        payload = {"text": text, "source_lang": source_lang, "target_lang": target_lang}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    return res.json().get("translated_text")
                return None
        except Exception:
            return None

    # --- Weak Words & Word of the Day ---

    async def get_weak_words(self, telegram_user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        res = await self._request("GET", f"/telegram/weak-words/{telegram_user_id}", params={"limit": limit})
        return res if isinstance(res, list) else []

    async def get_word_of_the_day(self, telegram_user_id: int) -> Optional[Dict[str, Any]]:
        return await self._request("GET", f"/telegram/word-of-the-day/{telegram_user_id}")

    # --- Interactive Quizzes ---

    async def get_quiz_questions(
        self,
        telegram_user_id: int,
        count: int = 5,
        direction: str = "en_to_uz",
    ) -> List[Dict[str, Any]]:
        res = await self._request(
            "GET",
            f"/telegram/quiz/{telegram_user_id}",
            params={"count": count, "direction": direction},
        )
        return res if isinstance(res, list) else []

    async def submit_quiz_answer(
        self,
        telegram_user_id: int,
        word_id: str,
        selected_option: str,
        direction: str = "en_to_uz",
    ) -> Optional[Dict[str, Any]]:
        payload = {
            "word_id": word_id,
            "selected_option": selected_option,
            "direction": direction,
        }
        return await self._request("POST", f"/telegram/quiz/answer/{telegram_user_id}", json=payload)

    # --- Mini Stories & Batch Words ---

    async def get_stories(self, telegram_user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        res = await self._request("GET", f"/telegram/stories/{telegram_user_id}", params={"limit": limit})
        return res if isinstance(res, list) else []

    async def get_batch_words(self, telegram_user_id: int, batch_id: str) -> List[Dict[str, Any]]:
        res = await self._request("GET", f"/telegram/batches/{telegram_user_id}/{batch_id}/words")
        return res if isinstance(res, list) else []


api_client = BackendAPIClient()

