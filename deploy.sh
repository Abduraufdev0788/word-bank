#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 SmartVocab AI — Serverga o'rnatish boshlandi"
echo "=========================================="

# 1. Docker va Docker Compose mavjudligini tekshirish
if ! command -v docker &> /dev/null; then
    echo "⚠️ Docker topilmadi. Docker o'rnatilmoqda..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# 2. .env fayli mavjudligini tekshirish
if [ ! -f .env ]; then
    echo "📝 .env fayli topilmadi. .env.example dan nusxalanmoqda..."
    cp .env.example .env
    echo "⚠️ Iltimos, .env faylini ochib, kerakli kalitlarni (GEMINI_API_KEY, TELEGRAM_BOT_TOKEN) tekshiring!"
fi

# 3. Konteynerlarni yig'ish va ishga tushirish
echo "📦 Konteynerlar yig'ilmoqda va ishga tushirilmoqda..."
docker compose down || true
docker compose up -d --build

# 4. Statusni tekshirish
echo "⏳ Xizmatlar ko'tarilishi kutilmoqda..."
sleep 10
docker compose ps

echo "=========================================="
echo "✅ SmartVocab AI muvaffaqiyatli ishga tushdi!"
echo "🌐 Veb-sayt: http://SERVER_IP"
echo "🤖 Telegram Bot: Ishga tushirildi"
echo "=========================================="
