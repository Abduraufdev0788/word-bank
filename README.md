# SmartVocab AI

> **Intellektual ingliz tili lug'at o'rganish platformasi va sinxronlashtirilgan Telegram bot.**  
> *Production-ready, xavfsiz, yuqori darajadagi UI/UX dizayn va Google Gemini sun'iy intellekti bilan integratsiyalashgan shaxsiy ta'lim ekotizimi.*

---

## 🌟 Loyiha haqida

**SmartVocab AI** — bu ingliz tilini o'rganuvchilar uchun mo'ljallangan shaxsiy ta'lim intellekti platformasi. Tizim veb-ilova va Telegram bot orqali yagona ma'lumotlar bazasida ishlaydi. Foydalanuvchilar lug'at boyligini fayllar (TXT, CSV, XLSX) orqali yuklashlari, 20 tadan so'zdan iborat to'plamlarga (batch) ajratishlari, interval takrorlash (Spaced Repetition) asosida o'rganishlari, AI orqali har bir daraja (A1–C2) uchun mini hikoyalar yaratishlari, real faol o'rganish vaqtini o'lchashlari va Telegram bot orqali istalgan joyda mashq qilishlari mumkin.

### Asosiy afzalliklar:
- **Yagona hisob va sinxronizatsiya:** Veb-saytdagi barcha o'zgarishlar, yangi so'zlar va mashq natijalari Telegram botda darhol aks etadi va aksincha.
- **Aqlli interval takrorlash (SRS):** So'zlarni shunchaki bir marta to'g'ri topish bilan "yodlandi" deb hisoblamaydi; eslash qiyinligiga qarab takrorlash vaqtini belgilaydi.
- **Haqiqiy faol o'qish vaqti (Active Study-Time Tracking):** Brauzer shunchaki ochiq turgan vaqtni emas, balki real mashg'ulot davomidagi faollikni (heartbeat, idle detection, visibility) hisoblaydi.
- **AI Mini Hikoyalar (A1–C2):** 20 talik to'plamdagi barcha so'zlarni qamrab oluvchi, darajaga mos kontekstli hikoyalar va savollar yaratadi.
- **Haqiqiy test va tahlillar:** Test javoblari serverda tekshiriladi, brauzerga oldindan javob yuborilmaydi (anti-cheat), tahlillar real o'zlashtirishga asoslanadi.

---

## 🛠 Texnologiyalar steki

| Qism | Texnologiya | Tavsifi |
| :--- | :--- | :--- |
| **Backend** | Python 3.12, FastAPI, Pydantic v2 | Yuqori tezlikdagi asinxron RESTful API |
| **ORM & DB** | PostgreSQL 16+, SQLAlchemy 2.x (async), Alembic | Qat'iy ma'lumotlar yaxlitligi va migratsiyalar |
| **Frontend** | React 18+, TypeScript, Vite, Tailwind CSS | Zamonaviy, tezkor va responsive foydalanuvchi interfeysi |
| **UI Kutubxonalari** | Lucide React, Framer Motion, TanStack Query | Interaktiv animatsiyalar va server holati boshqaruvi |
| **Telegram Bot** | Python 3.12, aiogram 3.x | Backend API bilan bog'langan asinxron bot |
| **AI Dvigateli** | Google Gemini API (`google-genai` SDK) | Kontekstli tarjima, mini-hikoyalar va mashqlar |
| **Infratuzilma** | Docker, Docker Compose, Nginx | Ishonchli konteynerizatsiya va xavfsiz proxy |

---

## 📂 Loyiha tuzilmasi

```text
word-bank/
├── AGENTS.md                  # Loyihaning asosiy muhandislik spetsifikatsiyasi
├── README.md                  # Loyiha umumiy hujjati va ishga tushirish qo'llanmasi
├── .env.example               # Muhit o'zgaruvchilari shabloni
├── docker-compose.yml         # Konteynerlar kompozitsiyasi (backend, bot, db, frontend)
├── docs/                      # Texnik arxitektura va spetsifikatsiyalar
│   ├── PRODUCT_SPEC.md        # Mahsulot funksiyalari va qabul mezonlari
│   ├── ARCHITECTURE.md        # Tizim arxitekturasi va ma'lumotlar oqimi
│   ├── DATABASE_SCHEMA.md     # Ma'lumotlar bazasi jadvallari va aloqalari
│   ├── API.md                 # REST API kontraktlari va xavfsizlik
│   ├── UI_UX.md               # Dizayn tizimi va interfeys talablari
│   ├── SECURITY.md            # Xavfsizlik qoidalari va avtorizatsiya
│   ├── AI_INTEGRATION.md      # Google Gemini integratsiyasi va promptlar
│   ├── TELEGRAM_BOT.md        # Telegram bot imkoniyatlari va hisob bog'lash
│   ├── TESTING.md             # Testlash strategiyasi va QA talablari
│   └── DEPLOYMENT.md          # Ishlab chiqarishga joylashtirish va zaxiralash
├── backend/                   # FastAPI backend ilovasi
│   ├── app/
│   │   ├── api/               # API marshrutlari (v1)
│   │   ├── core/              # Konfiguratsiya, xavfsizlik, DB ulanish
│   │   ├── models/            # SQLAlchemy 2.x modellari
│   │   ├── schemas/           # Pydantic v2 validatsiya sxemalari
│   │   ├── services/          # Biznes mantiq (SRS, import, AI, hisob-kitob)
│   │   └── main.py            # FastAPI kirish nuqtasi
│   ├── alembic/               # Ma'lumotlar bazasi migratsiyalari
│   ├── tests/                 # Pytest testlar to'plami
│   ├── Dockerfile
│   └── pyproject.toml / requirements.txt
├── frontend/                  # React + Vite + TypeScript veb-ilova
│   ├── src/
│   │   ├── components/        # Qayta ishlatiluvchi UI komponentlar
│   │   ├── pages/             # Sahifalar (Dashboard, Review, Batches, Stories...)
│   │   ├── services/          # API so'rovlar klienti (Axios/TanStack Query)
│   │   ├── hooks/             # Maxsus hooklar (useStudyTracker, useAuth...)
│   │   └── App.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
└── bot/                       # Telegram bot (aiogram 3.x)
    ├── handlers/              # Buyruqlar va xabarlar ishlovchilari
    ├── keyboards/             # Inline va reply klaviaturalar
    ├── services/              # Backend API bilan muloqot qiluvchi klient
    ├── bot.py                 # Bot asosiy ishga tushirish fayli
    └── Dockerfile
```

---

## 🚀 Ishga tushirish (Local Development)

### 1. Talablar
- Python 3.12+
- Node.js 18+ va npm
- PostgreSQL 16+ (yoki Docker)
- Git

### 2. O'rnatish bosqichlari
```bash
# Repozitoriyani klonlash
git clone https://github.com/Abduraufdev0788/word-bank.git
cd word-bank

# Muhit o'zgaruvchilarini sozlash
cp .env.example .env
# .env faylini oching va kerakli API kalitlarni kiriting (masalan, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN)
```

### 3. Backendni ishga tushirish
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 4. Frontendni ishga tushirish
```bash
cd ../frontend
npm install
npm run dev
```

### 5. Telegram botni ishga tushirish
```bash
cd ../bot
source ../backend/venv/bin/activate
python bot.py
```

---

## 🔒 Xavfsizlik va Ma'lumotlar Izolyatsiyasi
- Har bir foydalanuvchi ma'lumotlari qat'iy `user_id` orqali izolyatsiya qilingan (Multi-tenant isolation).
- Parollar Argon2id / bcrypt orqali xeshlanadi.
- JWT asosidagi xavfsiz autentifikatsiya (Access & Refresh token).
- Telegram bot hisobni bir martalik va vaqti cheklangan 6 xonali / UUID token orqali bog'laydi.

---

## 📖 Hujjatlar
To'liq texnik tafsilotlar bilan tanishish uchun `docs/` papkasidagi yo'riqnomalarni o'qing.
