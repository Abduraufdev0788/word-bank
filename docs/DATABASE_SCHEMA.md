# SmartVocab AI — Ma'lumotlar Bazasi Sxemasi (DATABASE_SCHEMA.md)

**Versiya:** 1.0.0  
**RDBMS:** PostgreSQL 16+  
**ORM:** SQLAlchemy 2.x (Asinxron)  
**Migratsiya boshqaruvi:** Alembic  

---

## 1. Umumiy modellashtirish qoidalari

1. **User Isolation (Multi-tenant):** Har bir shaxsiy jadvalda `user_id` ustuni majburiy va indekslangan bo'ladi.
2. **Kaskadli o'chirish (Cascade):** Foydalanuvchi o'chirilganda unga tegishli barcha so'zlar, to'plamlar, progress va sessiyalar toza o'chiriladi (`CASCADE`).
3. **Immutability (O'zgarmaslik):** `word_reviews` va `quiz_attempts` jadvallari faqat qo'shish (Append-only) printsipida ishlaydi, o'tmishdagi natijalar o'zgartirilmaydi.
4. **Vaqt zonalari:** Barcha vaqt ustunlari `TIMESTAMP WITH TIME ZONE` (UTC) formatida saqlanadi.

---

## 2. Jadvallar va ustunlar tavsifi

### 2.1 Foydalanuvchilar va hisoblar

#### `users`
Foydalanuvchilarning asosiy hisob ma'lumotlari.
- `id`: UUID (Primary Key, default: `gen_random_uuid()`)
- `email`: VARCHAR(255) (UNIQUE, NOT NULL, INDEX)
- `hashed_password`: VARCHAR(255) (NOT NULL)
- `full_name`: VARCHAR(100) (NULL)
- `is_active`: BOOLEAN (DEFAULT TRUE)
- `is_verified`: BOOLEAN (DEFAULT FALSE)
- `created_at`: TIMESTAMPTZ (DEFAULT now())
- `updated_at`: TIMESTAMPTZ (DEFAULT now())

#### `user_settings`
Foydalanuvchining shaxsiy ta'lim sozlamalari.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, UNIQUE, NOT NULL)
- `preferred_cefr_level`: VARCHAR(10) (DEFAULT 'B1') # A1, A2, B1, B2, C1, C2
- `daily_words_goal`: INTEGER (DEFAULT 10)
- `daily_review_goal`: INTEGER (DEFAULT 20)
- `daily_study_time_minutes`: INTEGER (DEFAULT 20)
- `timezone`: VARCHAR(50) (DEFAULT 'Asia/Tashkent')
- `theme`: VARCHAR(20) (DEFAULT 'dark') # 'dark' | 'light'
- `audio_accent`: VARCHAR(10) (DEFAULT 'us') # 'us' | 'uk'
- `updated_at`: TIMESTAMPTZ (DEFAULT now())

#### `telegram_accounts`
Foydalanuvchiga bog'langan Telegram hisob ma'lumotlari.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, UNIQUE, NOT NULL)
- `telegram_user_id`: BIGINT (UNIQUE, NOT NULL, INDEX)
- `telegram_chat_id`: BIGINT (NOT NULL)
- `username`: VARCHAR(100) (NULL)
- `first_name`: VARCHAR(100) (NULL)
- `is_notifications_enabled`: BOOLEAN (DEFAULT TRUE)
- `linked_at`: TIMESTAMPTZ (DEFAULT now())

#### `account_link_tokens`
Telegram hisobini xavfsiz bog'lash uchun bir martalik qisqa muddatli tokenlar.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL)
- `token`: VARCHAR(64) (UNIQUE, NOT NULL, INDEX)
- `is_used`: BOOLEAN (DEFAULT FALSE)
- `expires_at`: TIMESTAMPTZ (NOT NULL)
- `created_at`: TIMESTAMPTZ (DEFAULT now())

---

### 2.2 Lug'at va to'plamlar (Batches & Words)

#### `word_batches`
Foydalanuvchining 20 tadan so'zdan iborat to'plamlari.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `batch_number`: INTEGER (NOT NULL) # Har bir user uchun 1, 2, 3...
- `title`: VARCHAR(150) (NOT NULL) # Masalan: "1-to'plam (So'zlar 1-20)"
- `source_file_name`: VARCHAR(255) (NULL) # Qaysi fayldan yuklangan
- `status`: VARCHAR(30) (DEFAULT 'learning') # 'new', 'learning', 'reviewed', 'mastered'
- `word_count`: INTEGER (DEFAULT 0) # 0 dan 20 gacha
- `is_complete`: BOOLEAN (DEFAULT FALSE) # 20 ta to'lgan bo'lsa TRUE
- `created_at`: TIMESTAMPTZ (DEFAULT now())
- `updated_at`: TIMESTAMPTZ (DEFAULT now())
- **Constraint:** `UNIQUE (user_id, batch_number)`

#### `words`
Lug'atdagi alohida so'zlar va iboralar.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `batch_id`: UUID (FK -> word_batches.id ON DELETE SET NULL, NULL, INDEX)
- `english_word`: VARCHAR(150) (NOT NULL, INDEX)
- `uzbek_translation`: TEXT (NOT NULL)
- `part_of_speech`: VARCHAR(50) (NULL) # noun, verb, adjective, phrase, etc.
- `phonetic`: VARCHAR(100) (NULL) # Masalan: /ˈwɜːrld/
- `audio_url`: VARCHAR(500) (NULL)
- `cefr_level`: VARCHAR(10) (NULL) # A1-C2
- `notes`: TEXT (NULL)
- `order_in_batch`: INTEGER (DEFAULT 0)
- `created_at`: TIMESTAMPTZ (DEFAULT now())
- `updated_at`: TIMESTAMPTZ (DEFAULT now())
- **Constraint:** `UNIQUE (user_id, english_word)`

#### `word_examples`
So'zga tegishli namunaviy gaplar va ularning o'zbekcha tarjimalari.
- `id`: UUID (Primary Key)
- `word_id`: UUID (FK -> words.id ON DELETE CASCADE, NOT NULL, INDEX)
- `sentence_en`: TEXT (NOT NULL)
- `sentence_uz`: TEXT (NOT NULL)
- `created_at`: TIMESTAMPTZ (DEFAULT now())

---

### 2.3 O'zlashtirish va Spaced Repetition (SRS)

#### `word_progress`
Har bir so'z bo'yicha interval takrorlash holati (SM-2 ko'rsatkichlari).
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `word_id`: UUID (FK -> words.id ON DELETE CASCADE, UNIQUE, NOT NULL, INDEX)
- `repetition_number`: INTEGER (DEFAULT 0) # Ketma-ket to'g'ri topilganlar soni
- `ease_factor`: FLOAT (DEFAULT 2.5) # SM-2 qiyinlik koeffitsiyenti (min: 1.3)
- `interval_days`: INTEGER (DEFAULT 0) # Keyingi takrorlashgacha kunlar
- `due_date`: TIMESTAMPTZ (DEFAULT now(), INDEX) # Takrorlash vaqti
- `last_reviewed_at`: TIMESTAMPTZ (NULL)
- `times_reviewed`: INTEGER (DEFAULT 0)
- `times_correct`: INTEGER (DEFAULT 0)
- `times_incorrect`: INTEGER (DEFAULT 0)
- `is_mastered`: BOOLEAN (DEFAULT FALSE)
- `is_weak`: BOOLEAN (DEFAULT FALSE) # Xatolari ko'p so'z belgisi
- `updated_at`: TIMESTAMPTZ (DEFAULT now())

#### `word_reviews`
Har bir takrorlash harakatining o'zgarmas tarixi (Audit & Analytics).
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `word_id`: UUID (FK -> words.id ON DELETE CASCADE, NOT NULL, INDEX)
- `review_source`: VARCHAR(20) (NOT NULL) # 'web' | 'telegram'
- `review_type`: VARCHAR(30) (NOT NULL) # 'multiple_choice', 'typed', 'flashcard'
- `quality_rating`: INTEGER (NOT NULL) # SM-2 bahosi: 0 dan 5 gacha
- `is_correct`: BOOLEAN (NOT NULL)
- `user_answer`: TEXT (NULL)
- `time_spent_ms`: INTEGER (DEFAULT 0)
- `created_at`: TIMESTAMPTZ (DEFAULT now(), INDEX)

---

### 2.4 Testlar (Quizzes & Anti-Cheat)

#### `quiz_attempts`
Topshirilayotgan test sessiyasi.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `batch_id`: UUID (FK -> word_batches.id ON DELETE SET NULL, NULL)
- `quiz_type`: VARCHAR(30) (NOT NULL) # 'batch', 'weak_words', 'mixed'
- `total_questions`: INTEGER (NOT NULL)
- `correct_answers`: INTEGER (DEFAULT 0)
- `score_percent`: FLOAT (DEFAULT 0.0)
- `status`: VARCHAR(20) (DEFAULT 'in_progress') # 'in_progress', 'completed', 'abandoned'
- `started_at`: TIMESTAMPTZ (DEFAULT now())
- `completed_at`: TIMESTAMPTZ (NULL)

#### `quiz_questions`
Testdagi savollar va serverda yashirin to'g'ri javoblar.
- `id`: UUID (Primary Key)
- `quiz_attempt_id`: UUID (FK -> quiz_attempts.id ON DELETE CASCADE, NOT NULL, INDEX)
- `word_id`: UUID (FK -> words.id ON DELETE CASCADE, NOT NULL)
- `question_text`: TEXT (NOT NULL)
- `options`: JSONB (NOT NULL) # Masalan: ["olma", "kitob", "uy", "ruchka"]
- `correct_answer`: TEXT (NOT NULL) # MIJOZGA YUBORILMAYDI!
- `user_selected`: TEXT (NULL)
- `is_correct`: BOOLEAN (NULL)
- `answered_at`: TIMESTAMPTZ (NULL)

---

### 2.5 AI Mini Hikoyalar (Mini Stories)

#### `mini_stories`
To'plam yoki tanlangan so'zlar asosida yaratilgan hikoyalar.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `batch_id`: UUID (FK -> word_batches.id ON DELETE SET NULL, NULL, INDEX)
- `cefr_level`: VARCHAR(10) (NOT NULL) # A1, A2, B1, B2, C1, C2
- `title_en`: VARCHAR(200) (NOT NULL)
- `title_uz`: VARCHAR(200) (NOT NULL)
- `content_en`: TEXT (NOT NULL) # Nishon so'zlar bilan boyitilgan inglizcha matn
- `content_uz`: TEXT (NOT NULL) # To'liq o'zbekcha tarjimasi
- `target_words`: JSONB (NOT NULL) # Hikoyada ishlatilgan nishon so'zlar ro'yxati
- `comprehension_questions`: JSONB (NOT NULL) # 3 ta tushunish savoli va variantlari
- `created_at`: TIMESTAMPTZ (DEFAULT now())

---

### 2.6 Faol o'qish vaqti (Active Study Time)

#### `study_sessions`
Foydalanuvchining real mashg'ulot sessiyalari.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `activity_type`: VARCHAR(30) (NOT NULL) # 'review', 'quiz', 'story', 'practice'
- `source`: VARCHAR(20) (DEFAULT 'web') # 'web' | 'telegram'
- `started_at`: TIMESTAMPTZ (DEFAULT now())
- `last_heartbeat_at`: TIMESTAMPTZ (DEFAULT now())
- `ended_at`: TIMESTAMPTZ (NULL)
- `active_duration_seconds`: INTEGER (DEFAULT 0) # Real faol soniyalar
- `is_active`: BOOLEAN (DEFAULT TRUE)

#### `daily_activity`
Har bir kun uchun agregatsiyalangan natijalar (Tezkor grafiklar uchun).
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `activity_date`: DATE (NOT NULL, INDEX)
- `total_active_seconds`: INTEGER (DEFAULT 0)
- `words_learned`: INTEGER (DEFAULT 0)
- `words_reviewed`: INTEGER (DEFAULT 0)
- `quizzes_taken`: INTEGER (DEFAULT 0)
- `streak_day_count`: INTEGER (DEFAULT 1)
- **Constraint:** `UNIQUE (user_id, activity_date)`

---

### 2.7 Import operatsiyalari

#### `import_jobs`
Fayl yuklash va uni tahlil qilish jarayoni holati.
- `id`: UUID (Primary Key)
- `user_id`: UUID (FK -> users.id ON DELETE CASCADE, NOT NULL, INDEX)
- `file_name`: VARCHAR(255) (NOT NULL)
- `file_type`: VARCHAR(10) (NOT NULL) # txt, csv, xlsx
- `total_rows`: INTEGER (DEFAULT 0)
- `imported_words_count`: INTEGER (DEFAULT 0)
- `duplicate_words_count`: INTEGER (DEFAULT 0)
- `failed_rows_count`: INTEGER (DEFAULT 0)
- `status`: VARCHAR(20) (DEFAULT 'pending') # 'pending', 'preview', 'completed', 'failed'
- `created_at`: TIMESTAMPTZ (DEFAULT now())
