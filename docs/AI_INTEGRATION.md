# SmartVocab AI — Google Gemini AI Integratsiyasi (AI_INTEGRATION.md)

**Versiya:** 1.0.0  
**SDK:** Rasmiy `google-genai` Python SDK  
**Boshqaruv:** Markazlashtirilgan `AIService` qatlami  

---

## 1. Konfiguratsiya va Model tanlovi

`AGENTS.md` qoidalariga binoan, model nomi kod ichida qattiq kodlanmaydi (hardcode qilinmaydi) va muhit o'zgaruvchisi orqali boshqariladi:
- `GEMINI_API_KEY`: Google AI Studio maxfiy kaliti.
- `GEMINI_MODEL`: Model identifikatori (standart: `gemini-1.5-flash` yoki `gemini-1.5-pro`).
- `GEMINI_REQUEST_TIMEOUT_SECONDS`: Maksimal kutish vaqti (30 soniya).
- `GEMINI_MAX_RETRIES`: Xatolik yuz berganda qayta urinishlar soni (3 marta).

---

## 2. Asosiy AI Imkoniyatlari va Funksiyalar

### 2.1 So'zlarni boyitish va tarjima (Vocabulary Enrichment)
Foydalanuvchi yangi inglizcha so'z kiritganda, tizim quyidagi tuzilmada to'liq ma'lumot generatsiya qiladi:
- O'zbekcha aniq kontekstli tarjimasi.
- So'z turkumi (Part of Speech: noun, verb, adj...).
- Xalqaro fonetik transkripsiyasi (IPA).
- Kamida 2 ta kundalik hayotga mos namunaviy gap va ularning o'zbekcha tarjimasi.
- CEFR taxminiy darajasi (A1-C2).

### 2.2 Mini Hikoyalar generatsiyasi (A1–C2 Mini Stories)
To'plamdagi (20 ta so'z) so'zlar asosida berilgan CEFR darajasiga mos qiziqarli hikoya tuzish:
1. **Nishon so'zlarni 100% ishlatish talabi:** Hikoyada barcha 20 ta so'z tabiiy kontekstda qatnashishi shart (fleksiyalar/qo'shimchalar bilan ruxsat beriladi).
2. **Serverda validatsiya (Post-generation Validation):** Generatsiya qilingan matnda barcha 20 ta so'z borligi regex/lemmatizatsiya orqali tekshiriladi.
3. **Chegaralangan qayta urinish (Bounded Retries):** Agar qaysidir so'z tushib qolsa, modelga yetishmayotgan so'zlar ko'rsatilib, 3 martagacha qayta generatsiya qilinadi.
4. **Matnni tushunish savollari (Comprehension Questions):** Hikoya mazmuni bo'yicha 3 ta 4 variantli test savoli.

---

## 3. Pydantic Strukturalangan Chiqish Sxemalari (Structured Outputs)

Model chiqishi doimo qat'iy Pydantic sxemasi bilan validatsiya qilinadi:

```python
from pydantic import BaseModel, Field
from typing import List

class WordExampleSchema(BaseModel):
    sentence_en: str = Field(description="English example sentence")
    sentence_uz: str = Field(description="Uzbek translation of the sentence")

class WordEnrichmentResponse(BaseModel):
    uzbek_translation: str = Field(description="Primary Uzbek translation")
    part_of_speech: str = Field(description="noun, verb, adjective, etc.")
    phonetic: str = Field(description="IPA phonetic transcription, e.g. /ˈæp.əl/")
    cefr_level: str = Field(description="Estimated CEFR level: A1, A2, B1, B2, C1, or C2")
    examples: List[WordExampleSchema] = Field(min_length=2, max_length=3)
    notes: str = Field(default="", description="Helpful nuance or cultural note in Uzbek")

class ComprehensionQuestionSchema(BaseModel):
    question: str
    options: List[str] = Field(min_length=4, max_length=4)
    correct_option_index: int = Field(ge=0, le=3)
    explanation: str

class MiniStoryResponse(BaseModel):
    title_en: str
    title_uz: str
    content_en: str
    content_uz: str
    used_target_words: List[str]
    comprehension_questions: List[ComprehensionQuestionSchema] = Field(min_length=3, max_length=3)
```

---

## 4. Xatoliklarni boshqarish va Keshlashtirish (Fault Tolerance & Caching)

1. **Graceful Degradation:** Agar Gemini API kvotasi tugasa yoki tarmoq xatosi bersa, foydalanuvchiga xatolik chiroyli ko'rsatiladi va qo'lda tarjima kiritib so'zni saqlash imkoniyati saqlanadi. Tizim qulab tushmaydi.
2. **Keshlashtirish:** Lug'atdagi mashhur so'zlarning tarjimalari bazada saqlanadi; agar boshqa foydalanuvchi xuddi shu so'zni qo'shmoqchi bo'lsa, qayta API chaqirilmaydi (xarajat va tezlik optimallashadi).
3. **Xavfsiz Prompt:** Tizim ko'rsatmalariga foydalanuvchi kiritgan so'zlar maxsus ajratuvchilar bilan kiritiladi, bu esa prompt injection urinishlarini zararsizlantiradi.
