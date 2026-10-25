FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY bot/ ./bot/

ENV PYTHONPATH=/app

CMD ["python", "-m", "bot.main"]
