# SmartVocab AI — Mahsulot Spetsifikatsiyasi (PRODUCT_SPEC.md)

**Versiya:** 1.0.0  
**Holati:** Tasdiqlangan / Amalga oshirishga tayyor  
**Asosiy foydalanuvchi tili:** O'zbek tili (Lotin yozuvi)  
**O'rganilayotgan til:** Ingliz tili  

---

## 1. Mahsulot maqsadi va vazifalari

SmartVocab AI — bu shaxsiy ta'lim intellekti platformasi bo'lib, ingliz tilini o'rganuvchilarga yangi so'zlarni yuklash, ularni chuqur tushunish, interval takrorlash (Spaced Repetition) orqali xotirada uzoq saqlash, shaxsiy darajaga mos mini-hikoyalar orqali o'qish va Telegram bot bilan uzviy bog'liq holda o'rganish imkonini beradi.

### Asosiy maqsadli ko'rsatkichlar:
1. **O'qish ishonchliligi:** So'zlarni ishonchli import qilish, 20 talik to'plamlarga (batch) ajratish va ilmiy asoslangan algoritm orqali takrorlash.
2. **Haqiqiy faol vaqt hisobi:** Faqat brauzer ochiq turgan vaqtni emas, balki foydalanuvchi real harakatda bo'lgan vaqtni (Active Study Time) daqiqama-daqiqa o'lchash.
3. **Mukammal kross-platforma:** Saytda o'rganilgan yoki kiritilgan so'z shu zahoti Telegram botda paydo bo'ladi; botda topshirilgan test natijalari sayt analitikasida to'g'ridan-to'g'ri aks etadi.
4. **Haqiqiy baholash (Anti-Cheat):** Test savollarining to'g'ri javoblari mijoz brauzeriga yuborilmaydi; barcha javoblar serverda tekshiriladi va baholanadi.

---

## 2. Foydalanuvchi rollari va foydalanish ssenariylari

### 2.1 Foydalanuvchi turlari
- **Yangi o'rganuvchi (Onboarding):** Birinchi bor ro'yxatdan o'tgan, so'zlari yo'q, boshlang'ich yo'naltiruvchi qo'llanma (Welcome & Onboarding) va namunaviy to'plam bilan kutib olinadi.
- **Faol o'rganuvchi:** Har kuni takrorlash navbatini (Daily Review) to'liq bajaradi, yangi so'zlar kiritadi yoki fayl yuklaydi, mini hikoyalar o'qiydi.
- **Telegram foydalanuvchisi:** Yo'lda yoki kompyuter bo'lmaganda Telegram boti orqali takrorlash savollariga javob beradi va kunlik seriyasini (Streak) saqlaydi.

---

## 3. Mahsulot bo'limlari va funksional talablar

### 3.1 Boshqaruv paneli (Dashboard)
- **Bugungi takrorlash navbati (Due Reviews):** Bugun takrorlanishi lozim bo'lgan so'zlar soni va bitta tugma orqali mashg'ulotni boshlash.
- **Bugun o'rganilgan yangi so'zlar:** Real o'rganilgan so'zlar hisobi.
- **Bugun takrorlangan so'zlar:** Bugun yechilgan savollar va so'zlar soni.
- **Lug'at umumiy statistikasi:** Jami yuklangan so'zlar, mustahkam xotiradagi (Mastered) so'zlar.
- **O'rganish seriyasi (Streak):** Ketma-ket necha kun mashg'ulot olib borilgani.
- **Faol o'qish vaqti (Active Study Time):** Bugungi sarflangan faol vaqt va haftalik dinamika grafigi.
- **Tezkor harakatlar (Quick Actions):** So'z qo'shish, fayl yuklash, takrorlashni boshlash.
- **Aqlli keyingi qadam tavsiyasi (Suggested Next Action):** Masalan: *"B2 darajasidagi 2-to'plamda 12 ta so'z takrorlashga tayyor"*.

### 3.2 Kunlik takrorlash (Daily Review)
- Spaced Repetition (SRS) algoritmi bo'yicha saralangan so'zlar.
- Rejimlar:
  - English -> Uzbek (ma'nosini eslash).
  - Uzbek -> English (inglizchasini eslash).
  - Yozma javob (Typed Answer) — imlo xatolarini hisobga oluvchi tekshiruv.
  - Variantli test (Multiple Choice) — chalkashtiruvchi noto'g'ri variantlar bilan.
- Javob berilgandan so'ng darhol tushuntirish va noto'g'ri topilgan so'zni sessiya oxirida qayta takrorlash.
- Klaviaturaning tezkor tugmalari (1-4 variantlar uchun, Enter javob yuborish uchun).

### 3.3 Yangi so'z qo'shish (Add Word)
- Inglizcha so'z yoki ibora kiritish.
- AI yordamida o'zbekcha tarjima, so'z turkumi (Part of Speech), transkripsiya, talaffuz (IPA) va 2 ta kontekstli misol keltirish.
- Foydalanuvchi ma'lumotlarni saqlashdan oldin tahrirlashi mumkin.
- Dublikat (mavjud so'z)ni aniqlash va ogohlantirish.
- Mavjud to'plamni (batch) tanlash yoki avtomatik ravishda to'lmagan to'plamga joylash.

### 3.4 Mening lug'at fayllarim (My Vocabulary Files)
- Qo'llab-quvvatlanadigan formatlar: **TXT, CSV, XLSX**.
- Yuklashdan oldin ma'lumotlarni oldindan ko'rish (Preview modal).
- Inglizcha va o'zbekcha ustunlarni avtomatik aniqlash yoki qo'lda biriktirish (Column Mapping).
- Xato qatorlar va dublikatlarni ko'rsatish.
- So'zlarni ketma-ketligini saqlagan holda **20 tadan so'zdan iborat to'plamlarga (batch)** ajratish (masalan: 85 ta so'z -> 20, 20, 20, 20, 5).

### 3.5 Mening to'plamlarim (My Batches)
- Har bir to'plam kartasida: To'plam nomi, tartib raqami, so'zlar soni, o'zlashtirish foizi, takrorlashlar soni, oxirgi test natijasi, tayyor hikoya mavjudligi.
- To'plam bo'yicha harakatlar: O'rganish, test topshirish, hikoya o'qish, so'zlar ro'yxatini ko'rish.

### 3.6 AI Tarjimon (AI Translator)
- Inglizcha -> O'zbekcha chuqur kontekstli tarjima.
- So'zning turli ma'nolari, so'z birikmalari va CEFR darajasiga mos izohlar.
- Tarjima natijasini to'g'ridan-to'g'ri shaxsiy lug'atga saqlash imkoniyati.

### 3.7 Mini Hikoyalar (Mini Stories)
- CEFR darajalari: **A1, A2, B1, B2, C1, C2**.
- Foydalanuvchi tanlagan 20 talik to'plamdagi so'zlarni 100% qamrab oluvchi hikoya matni yaratish.
- Hikoya ichida nishon so'zlar (Target Words) ajratib ko'rsatiladi (highlighted).
- Har bir so'z ustiga bosilganda o'zbekcha tarjimasi va izohi ochiladi.
- Hikoya oxirida matnni tushunish bo'yicha 3 ta savol (Reading Comprehension).
- Hikoyalarni bazaga saqlash va oflayn/keyinroq qayta o'qish imkoniyati.

### 3.8 Mashqlar (Practice)
- Bir nechta mustaqil mashq turlari:
  1. Ko'p variantli test (Multiple Choice).
  2. Yozma tarjima (Typed Translation).
  3. Teskari tarjima (Reverse Translation).
  4. Fleshkardlar (Flashcards - Flip card animatsiyasi bilan).
  5. Gapni to'ldirish (Sentence Completion).
  6. Zaif so'zlar mashqi (Weak Words Practice).
- Javoblar qat'iy serverda tekshiriladi.

### 3.9 Lug'at boyligim (My Word Bank)
- Barcha so'zlar jadvali: qidiruv, to'plam bo'yicha filtr, CEFR darajasi va o'zlashtirish holati.
- So'zni tahrirlash, o'chirish, ovozini eshitish (TTS / Audio).
- Lug'atni CSV yoki JSON formatida eksport qilish.

### 3.10 Zaif so'zlar (Weak Words)
- Tizim tomonidan muntazam xato qilinadigan so'zlarni avtomatik aniqlash.
- Xatolar chastotasi, imlo xatolari va yo'nalishli qiyinchiliklar tahlili.
- Zaif so'zlar bo'yicha maxsus tezkor mashg'ulotlar.

### 3.11 Mening darajam (My Level)
- Lug'at boyligini baholash testi (Vocabulary Assessment).
- So'z boyligi hajmi va taxminiy CEFR darajasi (ishonchlilik darajasi bilan).

### 3.12 Suhbat (Conversation)
- AI bilan erkin yozma suhbat, tanlangan mavzular va lug'at so'zlarini qo'llash bo'yicha tavsiyalar.

### 3.13 Tinglash va Talaffuz (Listening & Pronunciation)
- Web Speech API / Audio yordamida so'zlar va gaplarni eshitish.
- Tinglab to'g'ri so'zni yozish mashqlari.

### 3.14 Rivojlanish va Tahlillar (Progress & Analytics)
- Aniq matematik hisob-kitoblar asosida grafigi: o'zlashtirish darajasi, kunlik faollik, to'plangan faol vaqt, xotira saqlanish egri chizig'i (retention curve).

### 3.15 Ta'lim rejasi (Study Plan)
- Kunlik yangi so'zlar maqsadi, takrorlashlar soni va o'rganish vaqti chegaralarini sozlash.

### 3.16 Sozlamalar va Profil (Settings & Profile)
- Profil ma'lumotlari, parolni o'zgartirish, Telegram hisobini xavfsiz bog'lash/uzish, ma'lumotlarni to'liq eksport qilish yoki hisobni o'chirish.

---

## 4. Faol vaqtni kuzatish (Active Study-Time Tracking) qoidalari

1. **Heartbeat:** Brauzer har 30 soniyada backendga faollik xabarini yuboradi.
2. **Idle Detection:** Agar foydalanuvchi klaviatura yoki sichqoncha bilan 5 daqiqa harakat qilmasa, vaqt hisobi to'xtatiladi.
3. **Visibility API:** Brauzer oynasi yopilsa yoki boshqa tabga o'tilsa, hisoblash darhol muzlatiladi.
4. **Server-side Validation:** Bir xil vaqt oralig'i (overlapping intervals) ikki marta qo'shilmaydi; soxta vaqt yozuvlari qabul qilinmaydi.
5. **Telegram faolligi:** Telegramda bajarilgan har bir yakunlangan test yoki mashq belgilangan real vaqt ekvivalenti (masalan: 1 ta savol = 15-20 soniya faol vaqt) sifatida qo'shiladi.

---

## 5. Qabul mezonlari (Acceptance Criteria)

- Barcha bo'limlar mock-ma'lumotlarsiz, real backend API va PostgreSQL ma'lumotlari bilan ishlaydi.
- Foydalanuvchi o'ziga tegishli bo'lmagan hech qanday ma'lumotni ko'ra olmaydi (IDOR himoyasi).
- Dizayn WCAG 2.2 AA standartlariga javob beradi, mobil qurilmalarda to'liq qulay va estetik jihatdan yuqori darajada.
