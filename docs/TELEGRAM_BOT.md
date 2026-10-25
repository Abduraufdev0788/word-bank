# SmartVocab AI — Telegram Bot Spetsifikatsiyasi (TELEGRAM_BOT.md)

**Versiya:** 1.0.0  
**Framework:** `python-telegram-bot` (v22+, Asinxron)  
**Backend bilan aloqa:** FastAPI REST API (Internal Token / Auth)  

---

## 1. Botning maqsadi va Arxitekturaviy qoidasi

Telegram bot — bu veb-platformaning mustaqil nusxasi emas, balki foydalanuvchining shaxsiy hisobiga to'liq sinxronlashgan ko'chma yordamchisidir.
- **Qat'iy qoida:** Bot alohida ma'lumotlar bazasiga ega bo'lmaydi. Barcha so'zlar, takrorlashlar, test natijalari va foydalanuvchi ma'lumotlari FastAPI backend orqali umumiy PostgreSQL bazasiga yoziladi.
- Saytda qo'shilgan so'z darhol botda ko'rinadi; botda yechilgan takrorlash saytdagi grafikda real vaqt rejimida aks etadi.

---

## 2. Buyruqlar va Imkoniyatlar (Commands & Features)

| Buyruq | Tavsifi | Foydalanish |
| :--- | :--- | :--- |
| `/start [token]` | Botni ishga tushirish yoki hisobni bog'lash | `/start` yoki veb-saytdan olingan token bilan: `/start abc123xyz` |
| `/review` | Bugungi takrorlanishi lozim bo'lgan so'zlarni boshlash | Inline tugmalar orqali savol-javob (English-Uzbek, Uzbek-English) |
| `/batches` | Foydalanuvchining 20 talik to'plamlari ro'yxati | To'plamni tanlash va uning so'zlarini ko'rish yoki test topshirish |
| `/add <word>` | Tezkor yangi so'z qo'shish | Masalan: `/add resilient` (AI avtomatik tarjimasini beradi va tasdiqlangach bazaga saqlaydi) |
| `/translate <matn>` | AI tarjimon yordamida tezkor tarjima olish | So'z yoki jumlani chuqur izohi bilan tarjima qilish |
| `/story` | Oxirgi yaratilgan yoki yangi mini hikoyani o'qish | Telegram xabari formatida formatlangan hikoya va tushunish testi |
| `/progress` | Kunlik statistika, streak va faol vaqt hisoboti | Bugungi takrorlangan so'zlar, to'plangan daqiqalar va olov seriyasi |
| `/settings` | Eslatmalar vaqtini sozlash yoki hisobni uzish | Eslatmalarni yoqish/o'chirish, vaqtini belgilash |

---

## 3. Hisobni xavfsiz bog'lash jarayoni (Secure Account Linking)

1. Foydalanuvchi saytda "Telegramni ulash" tugmasini bosadi.
2. Backend bir martalik, 15 daqiqa amal qiluvchi noyob token generatsiya qiladi.
3. Foydalanuvchiga to'g'ridan-to'g'ri havola beriladi: `https://t.me/SmartVocabAIBot?start=<link_token>`.
4. Foydalanuvchi havola ustiga bosganda bot avtomatik ravishda tokenni backendga tekshirish uchun yuboradi (`POST /telegram/verify-link`).
5. Backend tokenni tekshirib, foydalanuvchi ID si bilan Telegram ID sini biriktiradi va tokenni bekor qiladi.
6. Hech qachon foydalanuvchi nomini (username) qo'lda kiritish orqali hisob bog'lanmaydi.

---

## 4. Telegram orqali faol vaqtni hisoblash (Study-Time Accounting)

`AGENTS.md` qoidasiga binoan:
- Foydalanuvchi botga 1 soat oldin bitta xabar yozib, keyin yana bitta xabar yozsa, 1 soat faol o'qish vaqti deb **hisoblanmaydi**.
- Telegramdagi har bir muvaffaqiyatli yakunlangan test yoki so'z takrorlash harakati kalibratsiyalangan real faol vaqt (masalan: 1 ta to'liq savol-javob = 15-20 soniya) sifatida hisoblanadi va foydalanuvchining bugungi kunlik faol vaqtiga (`daily_activity.total_active_seconds`) qo'shiladi.

---

## 5. Idempotentlik va Xatoliklarni boshqarish

- Telegram qayta yuborishi mumkin bo'lgan takroriy yangilanishlar (Duplicate Updates) `update_id` va `callback_query.id` orqali filtrlanadi, bir xil javob ikki marta bazaga yozilmaydi.
- Telegram API cheklovlariga (Rate Limits: 30 xabar/soniya) qat'iy rioya qilinadi.
- Tarmoq uzilsa yoki backend vaqtincha javob bermasa, bot foydalanuvchiga muloyimlik bilan kutishni so'raydi.
