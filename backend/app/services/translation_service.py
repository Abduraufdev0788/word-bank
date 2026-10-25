import html
import logging
import re
from typing import Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

CYR_TO_LAT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z',
    'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': "'", 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': "o'", 'қ': 'q', 'ғ': "g'",
    'ҳ': 'h',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'J', 'З': 'Z',
    'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R',
    'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'X', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sh',
    'Ъ': "'", 'Ы': 'I', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya', 'Ў': "O'", 'Қ': 'Q', 'Ғ': "G'",
    'Ҳ': 'H',
}


def cyrillic_to_latin(text: str) -> str:
    return "".join(CYR_TO_LAT.get(ch, ch) for ch in text)


def is_clean_translation(candidate: str, source_text: str) -> bool:
    if not candidate:
        return False
    c = html.unescape(candidate).strip()
    if not c or c.lower() == source_text.lower():
        return False

    # Discard if starts with bracket or parentheses
    if c.startswith("(") or c.startswith("[") or c.startswith("{") or c.startswith('"'):
        return False

    # Check for religious or commentary keywords that pollute public corpora
    corrupted_keywords = [
        "аллоҳ", "оят", "неъмат", "сажда", "пайғамбар", "сура",
        "allah", "ayat", "quran", "qur'on"
    ]
    c_lower = c.lower()
    if any(k in c_lower for k in corrupted_keywords):
        return False

    # Check word count ratio: if source is <= 2 words, translation must not be a full sentence/paragraph
    src_words = len(source_text.split())
    cand_words = len(c.split())
    if src_words <= 2 and (cand_words > 4 or len(c) > 35):
        return False

    return True


class TranslationService:
    """
    Robust, high-accuracy translation service supporting:
    1. Google Cloud Translation API v2 (if GOOGLE_TRANSLATE_API_KEY configured)
    2. Verified Neural Machine Translation via MyMemory (created-by: 'MT!', Latin sanitized)
    3. Seamless Gemini AI Fallback (direct translation)
    """

    @staticmethod
    async def fast_translate(
        text: str,
        source_lang: str = "en",
        target_lang: str = "uz",
    ) -> str:
        clean_text = text.strip()
        if not clean_text:
            return ""

        # 1. Google Cloud Translation API v2 if key is configured
        if settings.GOOGLE_TRANSLATE_API_KEY:
            try:
                url = "https://translation.googleapis.com/language/translate/v2"
                params = {
                    "key": settings.GOOGLE_TRANSLATE_API_KEY,
                    "q": clean_text,
                    "source": source_lang,
                    "target": target_lang,
                    "format": "text",
                }
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        translations = data.get("data", {}).get("translations", [])
                        if translations and "translatedText" in translations[0]:
                            translated = html.unescape(translations[0]["translatedText"]).strip()
                            if translated:
                                return translated
            except Exception as e:
                logger.warning(f"Google Cloud Translation error: {e}")

        # 2. Fast Neural Translation via MyMemory API (free, fast ~150ms)
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(
                    "https://api.mymemory.translated.net/get",
                    params={
                        "q": clean_text,
                        "langpair": f"{source_lang}|{target_lang}",
                    },
                    headers={"User-Agent": "SmartVocabAI/2.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    matches = data.get("matches", [])

                    # 2a. Priority 1: Official Machine Translation (created-by == 'MT!')
                    for m in matches:
                        cand = m.get("translation", "")
                        if m.get("created-by") == "MT!" and is_clean_translation(cand, clean_text):
                            cleaned = html.unescape(cand).strip()
                            if re.search(r"[\u0400-\u04FF]", cleaned):
                                cleaned = cyrillic_to_latin(cleaned)
                            return cleaned

                    # 2b. Priority 2: High quality human matches (quality >= 70)
                    for m in matches:
                        cand = m.get("translation", "")
                        qual = int(m.get("quality", 0) or 0)
                        if qual >= 70 and is_clean_translation(cand, clean_text):
                            cleaned = html.unescape(cand).strip()
                            if re.search(r"[\u0400-\u04FF]", cleaned):
                                cleaned = cyrillic_to_latin(cleaned)
                            return cleaned

                    # 2c. Priority 3: responseData translatedText (only if clean)
                    raw_tr = data.get("responseData", {}).get("translatedText")
                    if raw_tr and is_clean_translation(raw_tr, clean_text):
                        cleaned = html.unescape(raw_tr).strip()
                        if re.search(r"[\u0400-\u04FF]", cleaned):
                            cleaned = cyrillic_to_latin(cleaned)
                        return cleaned
        except Exception as e:
            logger.warning(f"MyMemory translation error: {e}")

        # 3. Gemini AI Fallback (using configured lightweight model)
        if settings.GEMINI_API_KEY:
            try:
                from app.services.ai_service import ai_service
                ai_res = await ai_service.translate_quick(
                    text=clean_text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                )
                if ai_res and ai_res.translated_text and ai_res.translated_text.lower() != clean_text.lower():
                    return ai_res.translated_text.strip()
            except Exception as e:
                logger.warning(f"Gemini fallback translation error: {e}")

        return clean_text


translation_service = TranslationService()
