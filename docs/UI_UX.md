# SmartVocab AI — UI/UX va Dizayn Tizimi (UI_UX.md)

**Versiya:** 1.0.0  
**Standart:** WCAG 2.2 AA  
**Asosiy uslub:** Premium Dark EdTech UI / Intellektual neomorfizm va shisha effekti (Glassmorphism) unsurlari  

---

## 1. Vizual o'zlik (Visual Identity) va Ranglar Palitrasi

SmartVocab AI oddiy admin paneli emas, balki foydalanuvchida ishonch, zavq va intellektual joziba uyg'otuvchi premium til o'rganish muhitidir.

### 1.1 Ranglar tizimi (Tailwind tokens)
- **Asosiy fon (Surfaces):**
  - Orqa fon: `#080C14` (Deep Night Navy)
  - Kartalar va panellar: `#0F172A` (Slate 900)
  - Chegaralar va ajratuvchilar: `#1E293B` (Slate 800)
  - Ichki yuzalar (Hover/Active): `#1E293B` va `#334155`
- **Asosiy aksentlar (Primary Accents):**
  - Electric Violet / Indigo: `#6366F1` (Indigo 500) va `#8B5CF6` (Violet 500)
  - Gradient: `from-indigo-600 via-violet-600 to-purple-600`
- **Muvaffaqiyat va Statuslar (Feedback & Accents):**
  - To'g'ri javob / Muvaffaqiyat: `#10B981` (Emerald 500)
  - Xato / Diqqat: `#EF4444` (Rose 500)
  - O'rganish seriyasi (Streak): `#F59E0B` (Amber 500) / `#F97316` (Orange 500)
  - Ma'lumot / Ko'rsatkich: `#06B6D4` (Cyan 500)

### 1.2 Tipografiya
- **Bosh shrift:** `Inter` yoki `Plus Jakarta Sans` (Google Fonts orqali)
- **Sarlavhalar:** Qalin (`font-bold`, `tracking-tight`), yuqori kontrastli oq (`#F8FAFC`)
- **Matnlar:** O'qish oson bo'lgan yumshoq kulrang (`#94A3B8` - Slate 400)

---

## 2. Asosiy sahifalar dizayni va interfeys talablari

### 2.1 Boshqaruv paneli (Dashboard)
1. **Salomlashuv va Holat:** Foydalanuvchining ismi, bugungi o'rganish maqsadi va joriy CEFR darajasi.
2. **Katta Takrorlash Kartasi (Hero Review Card):**
   - E'tiborni tortuvchi gradientli karta: "Bugungi navbat: 18 ta so'z".
   - Katta "Takrorlashni boshlash" tugmasi (bitta bosish bilan mashg'ulotga o'tish).
3. **Statistika va Faol Vaqt bloklari:**
   - **Bugungi faol vaqt:** Jonli animatsiyali sekundomer belgisi bilan (masalan: `24 daq / 30 daq maqsad`).
   - **Streak:** Olov (Flame) belgisi va ketma-ket kunlar soni.
   - **O'zlashtirilgan so'zlar:** Doiraviy progress indikatori.
4. **Haftalik faollik grafigi:** Har bir kunlik o'rganish vaqtining chiroyli ustunli grafigi (Recharts).
5. **Tezkor amallar (Quick Action Pill buttons):** "+ So'z qo'shish", "Fayl yuklash", "Mini Hikoya yaratish".

### 2.2 Takrorlash interfeysi (Daily Review UI)
- **Fokus rejimi (Distraction-Free Mode):** Ortiqcha navigatsiya yashiriladi.
- **Kartochka (Flashcard):**
  - Markazda katta shriftda inglizcha so'z, transkripsiyasi va talaffuz audiosi tugmasi.
  - "Javobni ko'rish" bosilganda mayin `3D Card Flip` animatsiyasi bilan o'zbekcha tarjimasi va misol gap ko'rinadi.
  - 4 ta baholash tugmasi: "Unutdim" (Qizil), "Qiyin" (Sariq), "Yaxshi" (Ko'k), "Oson" (Yashil).
  - Klaviaturaning `1`, `2`, `3`, `4` va `Space` tugmalari bilan boshqarish imkoniyati.
- **Yozma mashq:** Javob kiritish inputi, to'g'ri bo'lsa yashil nur taratish effekti, xato bo'lsa mayin tebranish (shake animation).

### 2.3 To'plamlar (My Batches)
- Har bir to'plam (20 ta so'z) alohida karta shaklida ko'rsatiladi.
- Holat belgilari (Badges): "Yangi", "O'rganilmoqda (60%)", "Mukammal (Mastered)".
- Kartochka ustida mini harakatlar: "O'rganish", "Test topshirish", "Hikoya o'qish".

### 2.4 Mini Hikoyalar o'quvchisi (Story Reader)
- Kitob mutolaasi muhiti: matn o'lchamini o'zgartirish, qulay satrlar oralig'i (`leading-relaxed`).
- Hikoyadagi nishon so'zlar chiroyli rangli tagchiziq yoki xiralashtirilgan fon bilan ajratiladi.
- So'z ustiga bosilganda o'sha joyning o'zida miniatyura (Popover / Tooltip) ochilib, tarjimasi va izohi ko'rsatiladi.
- Matn oxirida interaktiv 3 ta savolli tushunish testi.

### 2.5 Jonli faol vaqt vidjeti (Live Study Time Widget)
- Veb-saytning yuqori o'ng burchagida (Header) joylashadi.
- Yashil miltillovchi nuqta (Active indicator): `00:18:42`.
- Brauzer yashirilsa yoki foydalanuvchi to'xtasa, vaqt to'xtaydi va "Kutish holatida" (Paused) ko'rsatiladi.

---

## 3. Responsive va Mobil tajriba (Mobile-First)

- **Mobil Navigatsiya:** Pastki qulay navigatsiya paneli (Bottom Navigation Bar) — "Dashboard", "Takrorlash", "To'plamlar", "Hikoyalar", "Profil".
- **Sensorli qulaylik (Touch targets):** Barcha tugmalar va kartalar kamida 44x44px o'lchamda, barmoq bilan bosishga mos.
- **Kompakt kartalar:** Kichik ekranlarda ma'lumotlar siqilmasdan, vertikal qulay aylantirish (scroll) tarzida ochiladi.

---

## 4. Animatsiyalar va Inklyuzivlik (A11y & Micro-interactions)

- Framer Motion orqali sahifa almashinuvi (`fade-in`, `slide-up`).
- Ovozli va ekranni o'quvchi qurilmalar (Screen Readers) uchun to'g'ri `aria-label`, `role` va semantik HTML (`<main>`, `<nav>`, `<article>`, `<button>`).
- Foydalanuvchi tizimida "Harakatni kamaytirish" (prefers-reduced-motion) yoqilgan bo'lsa, barcha sakrash va burilish animatsiyalari avtomatik o'chiriladi.
