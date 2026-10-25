# SmartVocab AI — Joylashtirish va DevOps Qo'llanmasi (DEPLOYMENT.md)

**Versiya:** 1.0.0  
**Tizim:** Linux (Ubuntu 24.04 LTS)  
**Konteynerizatsiya:** Docker & Docker Compose  
**Reverse Proxy:** Nginx (HTTPS / Let's Encrypt)  

---

## 1. Ishlab chiqarish infratuzilmasi (Production Architecture)

SmartVocab AI mustaqil Docker tarmoqlarida izolyatsiya qilingan holda ishlaydi:

- **Nginx Reverse Proxy:** Foydalanuvchilarning tashqi HTTPS so'rovlarini qabul qilib, statik frontend fayllarni tarqatadi va `/api/v1` so'rovlarini FastAPI backendiga yo'naltiradi.
- **FastAPI Backend (Konteyner):** `uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000` rejimida ishlaydi.
- **Telegram Bot (Konteyner):** Backend API bilan ichki tarmoq orqali asinxron muloqot qiladi.
- **PostgreSQL Database:** Shaxsiy ma'lumotlar bazasi, persistent volume (`smartvocab_pgdata`) bilan himoyalangan.

---

## 2. Portlar to'qnashuvini oldini olish (Port Allocation)

Serverda boshqa loyihalar bo'lishi mumkinligini hisobga olgan holda:
- Backend ichki port: `8000` (faqat docker network ichida yoki xavfsiz proksi ortida).
- PostgreSQL: Agar hostda 5432 band bo'lsa, ichki tarmoqda saqlanadi yoki tashqi host uchun `5433` portiga yo'naltiriladi.
- Nginx: Tashqi `80` va `443` (SSL) portlari.

---

## 3. Ishga tushirish bosqichlari (Deployment Steps)

### 1. Repozitoriyani serverga yuklash
```bash
git clone https://github.com/Abduraufdev0788/word-bank.git
cd word-bank
```

### 2. Ishlab chiqarish muhit o'zgaruvchilarini sozlash
```bash
cp .env.example .env
nano .env # Ishlab chiqarish parollari, JWT SECRET va GEMINI_API_KEY kiritiladi
```

### 3. Docker orqali barcha xizmatlarni ko'tarish
```bash
docker compose up -d --build
```

### 4. Ma'lumotlar bazasi migratsiyalarini qo'llash
```bash
docker compose exec backend alembic upgrade head
```

### 5. Xizmatlar salomatligini tekshirish (Healthcheck)
```bash
curl -f http://localhost:8000/api/v1/health || exit 1
docker compose ps
```

---

## 4. Zaxira nusxalash (Backup & Restore)

### Avtomatlashtirilgan kunlik zaxira (Cron):
```bash
#!/bin/bash
# /opt/scripts/backup_smartvocab.sh
BACKUP_DIR="/var/backups/smartvocab"
DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR

docker compose exec -T db pg_dump -U smartvocab_user smartvocab_db | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 14 kundan eski zaxiralarni avtomatik tozalash
find $BACKUP_DIR -name "*.sql.gz" -mtime +14 -delete
```

### Zaxiradan tiklash (Restore):
```bash
gunzip < /var/backups/smartvocab/db_20261024.sql.gz | docker compose exec -T db psql -U smartvocab_user -d smartvocab_db
```

---

## 5. Yangilash va Ortga qaytarish (Rollback Strategy)

1. Yangi versiyani olish: `git pull origin main`.
2. Yangi konteynerlarni yig'ish: `docker compose build`.
3. Migratsiyani qo'llash: `docker compose exec backend alembic upgrade head`.
4. Agar yangi versiyada kritik nosozlik aniqlansa:
   ```bash
   git checkout <oldingi_commit_hash>
   docker compose down
   docker compose up -d --build
   # Zarur bo'lsa oxirgi barqaror DB zaxirasini tiklash
   ```
