# SmartVocab AI — REST API Hujjati (API.md)

**Versiya:** 1.0.0  
**Asosiy prefiks:** `/api/v1`  
**Format:** JSON (`application/json`)  
**Autentifikatsiya:** Bearer JWT (`Authorization: Bearer <access_token>`)  

---

## 1. Standart javob va xatoliklar formati

### Muvaffaqiyatli javob:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operatsiya muvaffaqiyatli bajarildi"
}
```

### Xatolik javobi (RFC 7807 mos):
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "So'z topilmadi",
    "details": null
  }
}
```

### Standart HTTP status kodlari:
- `200 OK` — Muvaffaqiyatli GET / PUT / PATCH
- `201 Created` — Muvaffaqiyatli POST (yangi resurs yaratildi)
- `204 No Content` — Muvaffaqiyatli DELETE
- `400 Bad Request` — Noto'g'ri so'rov parametrlari
- `401 Unauthorized` — Token yo'q yoki muddati o'tgan
- `403 Forbidden` — Ruxsat etilmagan resursga murojaat (IDOR himoyasi)
- `404 Not Found` — Resurs mavjud emas
- `422 Unprocessable Entity` — Pydantic validatsiya xatosi
- `429 Too Many Requests` — Cheklovdan oshgan so'rovlar (Rate limit)
- `500 Internal Server Error` — Kutilmagan server xatosi

---

## 2. API Endpoints ro'yxati

### 2.1 Autentifikatsiya (`/auth`)
- `POST /auth/register` — Yangi foydalanuvchini ro'yxatdan o'tkazish.
- `POST /auth/login` — Email va parol orqali kirish (Access & Refresh token qaytaradi).
- `POST /auth/refresh` — Refresh token orqali yangi access token olish.
- `GET /auth/me` — Hozirgi autentifikatsiyadan o'tgan foydalanuvchi ma'lumotlari.
- `POST /auth/logout` — Tizimdan chiqish (sessiyani to'xtatish).

### 2.2 Foydalanuvchi sozlamalari (`/users`)
- `GET /users/settings` — Shaxsiy ta'lim sozlamalarini olish.
- `PUT /users/settings` — CEFR daraja, kunlik maqsadlar va vaqt zonasini yangilash.
- `PUT /users/password` — Parolni xavfsiz yangilash.
- `DELETE /users/account` — Hisobni barcha ma'lumotlari bilan to'liq o'chirish.

### 2.3 Lug'at va so'zlar (`/vocabulary`)
- `GET /vocabulary` — So'zlar ro'yxati (Pagination: `page`, `page_size`, `search`, `batch_id`, `cefr_level`, `is_mastered`).
- `POST /vocabulary` — Yangi so'z qo'shish (AI yordamida yoki qo'lda).
- `GET /vocabulary/{id}` — So'z tafsilotlari, misollari va progressi.
- `PUT /vocabulary/{id}` — So'z tarjimasi va izohlarini tahrirlash.
- `DELETE /vocabulary/{id}` — So'zni o'chirish.
- `GET /vocabulary/weak-words` — Zaif va muntazam xato qilinadigan so'zlar ro'yxati.
- `GET /vocabulary/export` — Barcha so'zlarni CSV yoki JSON formatida yuklab olish.

### 2.4 To'plamlar (`/batches`)
- `GET /batches` — Foydalanuvchining 20 talik to'plamlari ro'yxati (holat, so'z soni, progress).
- `GET /batches/{id}` — To'plam tafsilotlari va undagi barcha 20 ta so'z.
- `POST /batches` — Yangi bo'sh to'plam yaratish.
- `PUT /batches/{id}` — To'plam nomini o'zgartirish.
- `DELETE /batches/{id}` — To'plamni o'chirish (ichidagi so'zlarni saqlab qolgan holda yoki kaskadli).

### 2.5 Fayllarni import qilish (`/imports`)
- `POST /imports/preview` — TXT, CSV, XLSX faylni yuklash va ma'lumotlarni tekshirish (Preview: aniqlangan ustunlar, xato qatorlar, dublikatlar).
- `POST /imports/commit` — Preview qilingan so'zlarni tasdiqlash va 20 talik to'plamlarga bo'lib bazaga yozish.
- `POST /imports/cancel` — Import jarayonini bekor qilish.

### 2.6 Kunlik takrorlash (`/reviews`)
- `GET /reviews/queue` — Bugun takrorlanishi lozim bo'lgan so'zlar navbati (Spaced Repetition).
- `POST /reviews/submit` — Bitta so'z bo'yicha takrorlash javobini yuborish.
  ```json
  {
    "word_id": "uuid",
    "review_type": "multiple_choice",
    "quality_rating": 4, // 0-5 (SM-2)
    "user_answer": "apple",
    "source": "web" // "web" | "telegram"
  }
  ```
  *Javob: Keyingi takrorlash sanasi va yangilangan o'zlashtirish koeffitsiyenti.*

### 2.7 Testlar va Mashqlar (`/quizzes` — Anti-Cheat)
- `POST /quizzes/start` — Yangi test sessiyasini boshlash (`batch_id` yoki `quiz_type`).
  *Javob: `quiz_attempt_id` va savollar ro'yxati (FAQAT savol matni va variantlar, TO'G'RI JAVOBLARSIZ).*
- `POST /quizzes/{attempt_id}/answer` — Savolga javob yuborish.
  ```json
  {
    "question_id": "uuid",
    "selected_option": "kitob"
  }
  ```
  *Javob: `{ "is_correct": true, "correct_answer": "kitob", "explanation": "..." }`*
- `POST /quizzes/{attempt_id}/complete` — Testni yakunlash va to'liq tahlil natijasini olish.

### 2.8 AI Mini Hikoyalar (`/stories`)
- `POST /stories/generate` — Tanlangan to'plam yoki so'zlar va CEFR daraja (A1-C2) bo'yicha yangi hikoya generatsiya qilish.
- `GET /stories` — Saqlangan barcha hikoyalar ro'yxati.
- `GET /stories/{id}` — Hikoya tafsiloti, nishon so'zlar lug'ati va tushunish savollari.

### 2.9 AI Tarjimon (`/translations`)
- `POST /translations/translate` — So'z yoki iborani o'zbekchaga chuqur tahliliy tarjima qilish (transkripsiya, so'z turkumi, 2 ta namunaviy gap bilan).

### 2.10 Faol vaqtni kuzatish (`/study-sessions`)
- `POST /study-sessions/start` — Faol o'rganish sessiyasini boshlash (`activity_type`: 'review' | 'quiz' | 'story').
- `POST /study-sessions/heartbeat` — Har 30 soniyada brauzerdan yuboriladigan faollik signali.
- `POST /study-sessions/end` — Sessiyani to'xtatish va to'plangan faol vaqtni saqlash.
- `GET /study-sessions/stats` — Bugungi, haftalik va jami to'plangan faol vaqt ko'rsatkichlari.

### 2.11 Tahlillar va Rivojlanish (`/analytics`)
- `GET /analytics/dashboard` — Boshqaruv paneli uchun barcha haqiqiy ko'rsatkichlar (due count, streak, today's time, recent activity).
- `GET /analytics/weekly-chart` — Haftalik faol vaqt va o'rganilgan so'zlar grafigi.
- `GET /analytics/level-assessment` — Foydalanuvchining so'z boyligi darajasi hisoboti.

### 2.12 Telegram integratsiyasi (`/telegram`)
- `POST /telegram/link-token` — Telegram hisobini bog'lash uchun bir martalik token olish.
- `POST /telegram/verify-link` — Bot tomonidan tokenni tekshirish va hisobni biriktirish (Faqat Bot Secret Token orqali ruxsat beriladi).
- `GET /telegram/user/{tg_user_id}/status` — Telegram foydalanuvchisining tizimdagi holati.
- `POST /telegram/sync-review` — Bot orqali bajarilgan takrorlashni yozish.
