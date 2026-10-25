# SmartVocab AI — Xavfsizlik va Maxfiylik Hujjati (SECURITY.md)

**Versiya:** 1.0.0  
**Standart:** OWASP Top 10 moslik va Zero-Trust tamoyili  

---

## 1. Xavf modellari (Threat Modeling) va Himoya strategiyalari

| Xavf | Ta'rifi | SmartVocab AI himoya mexanizmi |
| :--- | :--- | :--- |
| **IDOR (Boshqa user ma'lumotlarini ko'rish/o'zgartirish)** | Bir foydalanuvchi boshqa foydalanuvchining so'z yoki test natijasini UUID orqali so'rashi | Har bir ma'lumotlar bazasi so'rovida `WHERE user_id = current_user.id` filtri majburiy qilingan. Dependency Injection orqali tekshiriladi. |
| **Parol va Hisob o'g'irlanishi** | Brute force yoki parollar bazasini buzish | `bcrypt` / `Argon2id` orqali xeshlanadi. Parol uzunligi kamida 8 belgi. Login endpointida Rate Limiting (5 ta urinish / 10 daqiqa). |
| **Anti-Cheat (Test natijalarini soxtalashtirish)** | Foydalanuvchi brauzer konsoli orqali to'g'ri javoblarni ko'rishi yoki to'g'ridan-to'g'ri 100% ball yuborishi | Savollar ro'yxati berilganda `correct_answer` maydoni serverda qoladi. Ball faqat serverda har bir javob solishtirilgach hisoblanadi. |
| **Fayl yuklashdagi zaifliklar (Malicious Uploads)** | TXT, CSV, XLSX o'rniga skript yoki zararli fayl yuklash | Fayl hajmi maksimal 5 MB. Fayl kengaytmasi va Magic Bytes qat'iy tekshiriladi. Fayl server fayl tizimida saqlanmaydi, xotirada (in-memory) tahlil qilinadi. |
| **Telegram hisobini noqonuniy bog'lash** | Birovning username yoki ID sini kiritib uning hisobiga kirish | Faqat tizim ichida generatsiya qilingan bir martalik, 15 daqiqa amal qiluvchi kriptografik token orqali bog'lanadi. Username orqali bog'lash qat'iyan taqiqlangan. |
| **Prompt Injection (AI buzish)** | Yuklangan so'zlar orqali Gemini AI tizim ko'rsatmalarini o'zgartirish | Barcha kiruvchi so'zlar "Untrusted User Input" sifatida qabul qilinadi. Pydantic Structured Output sxemasi orqali javob majburiy formatlanadi. |
| **Maxfiy kalitlar sizib chiqishi** | `.env` fayli yoki API kalitlarni Gitga qo'shib yuborish | `.gitignore` ga barcha muhit fayllari qo'shilgan. Ilova ishga tushganda Pydantic Settings barcha kalitlar mavjudligini tekshiradi. |

---

## 2. Autentifikatsiya va Sessiyalar boshqaruvi

1. **JWT Tuzilishi:**
   - **Access Token:** Muddati 60 daqiqa. Payload faqat `sub` (User ID), `exp` va `iat` ni o'z ichiga oladi. Hech qanday maxfiy ma'lumot (parol, to'liq profil) saqlanmaydi.
   - **Refresh Token:** Muddati 14 kun. Shifrlangan va xavfsiz saqlanadi.
2. **CORS (Cross-Origin Resource Sharing):**
   - Faqat oldindan ruxsat berilgan domenlarga (masalan: `http://localhost:5173` va production domen) ruxsat etiladi. `*` (wildcard) qat'iyan man etiladi.
3. **Parol xavfsizligi:**
   - Hech qachon xom parollar loglarga yozilmaydi.
   - Parol o'zgartirilganda eski parolni kiritish majburiy.

---

## 3. Ma'lumotlar yaxlitligi va Maxfiylik (Data Privacy)

1. **Foydalanuvchini to'liq o'chirish (Right to be Forgotten):**
   - Foydalanuvchi hisobini o'chirganda, unga tegishli barcha so'zlar, takrorlashlar, testlar, Telegram ulanishlari va faollik ma'lumotlari bazadan kaskadli to'liq o'chiriladi.
2. **Eksport huquqi (Data Portability):**
   - Foydalanuvchi o'ziga tegishli barcha lug'at ma'lumotlarini istalgan payt CSV yoki JSON formatida yuklab olishi mumkin.
3. **Audit va Monitoring:**
   - Xavfsizlikka oid barcha hodisalar (muvaffaqiyatsiz login urinishlari, parolni o'zgartirish, Telegram bog'lash) maxsus log formatida qayd etiladi.
