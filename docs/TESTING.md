# SmartVocab AI — Testlash va Sifat Kafolati (TESTING.md)

**Versiya:** 1.0.0  
**Backend test vositasi:** `pytest`, `pytest-asyncio`, `httpx`  
**Frontend test vositasi:** `vitest`, `@testing-library/react`  
**Qat'iy qoida:** Hech qachon testlar ishga tushirilmasdan turib "barcha testlar o'tdi" deb da'vo qilinmaydi. Har bir hisobotda aniq terminal buyruqlari va natijalari keltiriladi.

---

## 1. Testlash darajalari va qamrovi

### 1.1 Backend Unit Testlar
1. **Spaced Repetition (SRS) Dvigateli:**
   - SM-2 algoritmi to'g'ri baho (0-5) bo'yicha intervalni oshirishi yoki nolga tushirishi.
   - So'zning `is_mastered` holatiga o'tish qoidalari.
2. **Fayl importi va To'plamlarga ajratish:**
   - 85 ta so'zdan iborat fayl aniq 20, 20, 20, 20 va 5 ta so'zli 5 ta to'plam hosil qilishi.
   - Bo'sh qatorlar, buzilgan formatlar va dublikatlarning to'g'ri ushlanishi.
3. **Faol vaqtni hisoblash (Study Tracker):**
   - 5 daqiqadan ko'p uzilish bo'lsa vaqt qo'shilmasligi.
   - Bir vaqtning o'zida bir nechta tab ochilganda ikki marta hisoblanmasligi.

### 1.2 Backend Integratsion Testlar (API & DB)
1. **Ko'p foydalanuvchili izolyatsiya (Multi-tenant User Isolation):**
   - Foydalanuvchi A o'z tokeni orqali Foydalanuvchi B ning so'zini, to'plamini yoki testini ko'ra olmasligi (`403 Forbidden` yoki `404 Not Found`).
2. **Testlar xavfsizligi (Anti-Cheat Quiz):**
   - `POST /quizzes/start` qaytargan savollar ro'yxatida `correct_answer` yo'qligini tekshirish.
   - Noto'g'ri yoki ruxsatsiz javob yuborilganda server xatoni qaytarishi.
3. **Telegram hisobini bog'lash:**
   - Muddati o'tgan yoki ishlatilgan token bilan qayta bog'lanish rad etilishi.

---

## 2. Testlarni ishga tushirish buyruqlari

### Backend testlari:
```bash
cd backend
source venv/bin/activate

# Barcha testlarni ishga tushirish
pytest -v

# Faqat xavfsizlik va izolyatsiya testlari
pytest tests/test_security_isolation.py -v

# Qamrov hisoboti bilan (Coverage)
pytest --cov=app --cov-report=term-missing
```

### Frontend testlari va Linter:
```bash
cd frontend

# TypeScript tur tekshiruvi
npm run typecheck # yoki npx tsc --noEmit

# Linter tekshiruvi
npm run lint

# Komponent testlari
npm run test
```

---

## 3. Bosqichlarni yakunlash uchun Sifat Chegaralari (Quality Gates)

Har bir bosqichni (Phase) "bajarildi" deb hisoblash uchun quyidagi shartlar qanoatlantirilishi shart:
1. `ruff` yoki linter hech qanday kritik xato ko'rsatmasligi.
2. `tsc` (TypeScript) nol xato bilan o'tishi.
3. Barcha tegishli avtomatlashtirilgan testlar muvaffaqiyatli o'tishi (`PASS`).
4. Ma'lumotlar bazasi migratsiyalari toza qo'llanilishi (`alembic upgrade head`).
5. Hech qanday soxta (mock) ma'lumotlar real progress sifatida ko'rsatilmasligi.
