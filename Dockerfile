FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    WEB_CONCURRENCY=2 \
    DATA_DIR=/app/data \
    DATABASE_PATH=/app/data/lost_found.db \
    UPLOAD_DIR=/app/uploads \
    LOG_DIR=/app/logs

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend
COPY uploads ./uploads
COPY data ./data
COPY .env.example ./.env.example

RUN mkdir -p /app/uploads /app/data /app/logs

EXPOSE 8000

CMD ["sh", "-c", "gunicorn backend.backend:app --worker-class uvicorn.workers.UvicornWorker --bind ${HOST:-0.0.0.0}:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]
