import asyncio
import json
import logging
import re
from typing import List, Optional, Tuple
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.ai import (
    WordEnrichmentResponse,
    QuickTranslationResponse,
    MiniStoryResponse,
    ComprehensionQuestionSchema,
)

logger = logging.getLogger(__name__)


def validate_target_words(content: str, target_words: List[str]) -> Tuple[bool, List[str], List[str]]:
    """
    Validates whether target words (or their regular English inflections) appear in the content.
    Returns (all_present, present_words, missing_words).
    """
    if not content:
        return False, [], list(target_words)

    content_lower = content.lower()
    present_words = []
    missing_words = []

    for raw_word in target_words:
        w = raw_word.strip().lower()
        if not w:
            continue

        # Build regex patterns allowing common English inflections
        # 1. Exact match
        patterns = [rf"\b{re.escape(w)}\b"]

        if " " not in w:
            # Common plural & third-person -s / -es
            patterns.append(rf"\b{re.escape(w)}s\b")
            patterns.append(rf"\b{re.escape(w)}es\b")
            if w.endswith("y") and len(w) > 1:
                patterns.append(rf"\b{re.escape(w[:-1])}ies\b")
                patterns.append(rf"\b{re.escape(w[:-1])}ied\b")

            # Past tense -ed / -d
            patterns.append(rf"\b{re.escape(w)}ed\b")
            patterns.append(rf"\b{re.escape(w)}d\b")

            # Continuous -ing
            patterns.append(rf"\b{re.escape(w)}ing\b")
            if w.endswith("e") and len(w) > 1:
                patterns.append(rf"\b{re.escape(w[:-1])}ing\b")
            # Doubled consonant, e.g., run -> running, stop -> stopping
            if len(w) >= 3 and w[-1] not in "aeiouyw" and w[-2] in "aeiou" and w[-3] not in "aeiou":
                patterns.append(rf"\b{re.escape(w + w[-1])}ing\b")
                patterns.append(rf"\b{re.escape(w + w[-1])}ed\b")
        else:
            # Multi-word phrase: match with flexible whitespace
            parts = [re.escape(p) for p in w.split()]
            patterns.append(r"\b" + r"\s+".join(parts) + r"\b")

        matched = False
        for pat in patterns:
            if re.search(pat, content_lower):
                matched = True
                break

        if matched:
            present_words.append(raw_word)
        else:
            missing_words.append(raw_word)

    all_present = len(missing_words) == 0
    return all_present, present_words, missing_words


class AIService:
    def __init__(self, client=None):
        self._client = client

    def _get_client(self):
        if self._client is not None:
            return self._client

        if not settings.GEMINI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Gemini API kaliti sozlanmagan. Iltimos, sozlamalarda GEMINI_API_KEY ni o'rnating yoki so'zni qo'lda kiriting.",
            )

        try:
            from google import genai
            return genai.Client(api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            logger.error(f"Failed to initialize Google GenAI Client: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Google Gemini SDK ga ulanishda xatolik: {str(e)}",
            )

    async def enrich_word(
        self,
        word: str,
        context: Optional[str] = None,
    ) -> WordEnrichmentResponse:
        """
        Generates enriched dictionary data (Uzbek translation, phonetic, POS, CEFR, examples, notes).
        Uses structured output schema.
        """
        client = self._get_client()

        context_clause = f"\nKontekst: {context}" if context else ""
        prompt = (
            f"Sen ingliz tili va o'zbek tili bo'yicha professional leksikograf va til o'rgatuvchisan.\n"
            f"Quyidagi inglizcha so'z yoki ibora uchun o'zbek tilidagi to'liq va aniq lug'at ma'lumotlarini taqdim et:\n"
            f"So'z: {word}{context_clause}\n\n"
            f"Talablar:\n"
            f"1. uzbek_translation: eng ko'p ishlatiladigan tabiiy o'zbekcha tarjimasi.\n"
            f"2. part_of_speech: so'z turkumi (masalan: noun, verb, adjective, phrase, adverb).\n"
            f"3. phonetic: xalqaro IPA transkripsiyasi (masalan: /ˈwɜːld/).\n"
            f"4. cefr_level: A1, A2, B1, B2, C1 yoki C2 darajasi.\n"
            f"5. examples: kamida 2 ta kundalik hayotga mos namunaviy gap (sentence_en) va ularning o'zbekcha tarjimasi (sentence_uz).\n"
            f"6. notes: ushbu so'zning nozik ma'nosi, sinonimlari yoki madaniy qo'llanilishi haqida qisqa o'zbekcha eslatma."
        )

        try:
            from google.genai import types

            def _call_enrich():
                return client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=WordEnrichmentResponse,
                    ),
                )

            response = await asyncio.to_thread(_call_enrich)

            if hasattr(response, "parsed") and response.parsed is not None:
                return response.parsed
            
            # Fallback parse from JSON text
            return WordEnrichmentResponse.model_validate_json(response.text)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error enriching word '{word}': {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini AI orqali so'zni tarjima qilishda xatolik yuz berdi: {str(e)}",
            )

    async def translate_quick(
        self,
        text: str,
        source_lang: str = "en",
        target_lang: str = "uz",
    ) -> QuickTranslationResponse:
        """
        Performs quick direct translation between English and Uzbek.
        """
        client = self._get_client()

        lang_names = {
            "en": "ingliz tili",
            "uz": "o'zbek tili",
        }
        src_name = lang_names.get(source_lang, source_lang)
        dst_name = lang_names.get(target_lang, target_lang)

        prompt = (
            f"Quyidagi matnni {src_name}dan {dst_name}ga professional va tabiiy tarjima qil:\n\n"
            f"Matn:\n{text}\n\n"
            f"Faqat tarjima qilingan natijaviy matnni qaytar, hech qanday ortiqcha izoh yoki so'zboshisiz."
        )

        try:
            def _call_translate():
                return client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                )

            response = await asyncio.to_thread(_call_translate)
            translated = response.text.strip()
            return QuickTranslationResponse(
                original_text=text,
                translated_text=translated,
                source_lang=source_lang,
                target_lang=target_lang,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Quick translation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Tarjima qilishda xatolik: {str(e)}",
            )

    async def generate_batch_story(
        self,
        words: List[str],
        cefr_level: str = "B1",
        max_retries: Optional[int] = None,
    ) -> MiniStoryResponse:
        """
        Generates an engaging CEFR-graded story using the given target words,
        ensuring 100% target word coverage with post-generation validation and bounded retries.
        """
        if not words:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hikoya yaratish uchun kamida 1 ta so'z kiritilishi shart.",
            )

        client = self._get_client()
        attempts_limit = max_retries or settings.GEMINI_MAX_RETRIES

        from google.genai import types

        clean_words = [w.strip() for w in words if w.strip()]
        words_formatted = ", ".join(f"'{w}'" for w in clean_words)

        current_prompt = (
            f"Sen mahoratli ingliz tili o'qituvchisisan.\n"
            f"Berilgan nishon so'zlar ro'yxatidan foydalanib, CEFR {cefr_level} darajasiga mos qiziqarli, "
            f"mazmunli va o'quvchi uchun tushunarli hikoya yoz.\n\n"
            f"NISHON SO'ZLAR ({len(clean_words)} ta):\n{words_formatted}\n\n"
            f"QAT'IY TALABLAR:\n"
            f"1. Hikoyada (content_en) ko'rsatilgan BARCHA {len(clean_words)} ta nishon so'z majburiy ishtirok etishi SHART! "
            f"Hech bir so'z tushib qolmasin. Tabiiy grammatik fleksiyalar (ko'plik, o'tgan zamon, sifatdosh) ruxsat etiladi.\n"
            f"2. Matn darajasi CEFR {cefr_level} talablariga mos bo'lsin.\n"
            f"3. content_uz: butun hikoyaning ravon, adabiy o'zbekcha tarjimasi bo'lsin.\n"
            f"4. title_en va title_uz: mos sarlavhalar.\n"
            f"5. used_target_words: matnda ishlatilgan nishon so'zlarning asl ro'yxati.\n"
            f"6. comprehension_questions: hikoyani tushunganlikni tekshirish uchun 3 ta savol. "
            f"Har bir savolda 4 ta variant (options), to'g'ri variant indeksi (0-3) va o'zbekcha tushuntirish (explanation) bo'lsin."
        )

        last_response: Optional[MiniStoryResponse] = None

        for attempt in range(1, attempts_limit + 1):
            try:
                def _call_story():
                    return client.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=current_prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=MiniStoryResponse,
                        ),
                    )

                response = await asyncio.to_thread(_call_story)

                if hasattr(response, "parsed") and response.parsed is not None:
                    story: MiniStoryResponse = response.parsed
                else:
                    story = MiniStoryResponse.model_validate_json(response.text)

                last_response = story

                # Post-generation target word validation
                all_present, present_words, missing_words = validate_target_words(
                    story.content_en, clean_words
                )

                if all_present:
                    logger.info(
                        f"Story generated successfully on attempt {attempt} with 100% word coverage ({len(present_words)}/{len(clean_words)})."
                    )
                    story.used_target_words = present_words
                    return story

                # If missing words and we have remaining attempts, retry with corrective feedback
                if attempt < attempts_limit:
                    logger.warning(
                        f"Attempt {attempt}: Story missing {len(missing_words)} target words: {missing_words}. Retrying..."
                    )
                    missing_str = ", ".join(f"'{m}'" for m in missing_words)
                    current_prompt = (
                        f"Avvalgi yozilgan hikoyangda quyidagi nishon so'zlar TUSHIB QOLDI: {missing_str}.\n"
                        f"Iltimos, hikoyani qaytadan yoz va yuqoridagi yetishmayotgan so'zlarni hamda barcha {len(clean_words)} ta nishon so'zni "
                        f"matnga to'liq va tabiiy ravishda kirit. Hech qaysi so'z qolib ketmasin!"
                    )
                else:
                    # Final attempt reached: report actual used words truthfully
                    logger.warning(
                        f"Max retries reached ({attempts_limit}). Used {len(present_words)}/{len(clean_words)} words. Missing: {missing_words}"
                    )
                    story.used_target_words = present_words
                    return story

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error on story generation attempt {attempt}: {e}")
                if attempt == attempts_limit:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Mini hikoya generatsiya qilishda xatolik yuz berdi: {str(e)}",
                    )

        if last_response:
            return last_response

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Hikoya yaratish muvaffaqiyatsiz tugadi.",
        )


ai_service = AIService()
