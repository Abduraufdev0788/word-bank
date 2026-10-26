#!/usr/bin/env bash
set -e

echo "=========================================="
echo "⏳ SmartVocab AI Backend: Initialization..."
echo "=========================================="

# 1. Wait for database to be fully up and ready
python wait_for_db.py

# 2. Run Alembic migrations
echo "🔄 Running Alembic database migrations..."
alembic upgrade head

# 3. Start Uvicorn with auto-reload
echo "🚀 Starting Uvicorn server on port 8000 with auto-reload..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
