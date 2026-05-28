FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    WEB_CONCURRENCY=2 \
    DATA_DIR=/tmp/lostfound/data \
    DATABASE_PATH=/tmp/lostfound/data/lost_found.db \
    UPLOAD_DIR=/tmp/lostfound/uploads \
    UPLOAD_CACHE_DIR=/tmp/lostfound/upload-cache \
    UPLOAD_STORAGE_BACKEND=database \
    LOG_DIR=/tmp/lostfound/logs \
    LOG_TO_STDOUT=1 \
    OLLAMA_HOST=http://ollama:11434 \
    OLLAMA_MODEL=llama3:8b \
    OLLAMA_TEXT_MODEL=llama3:8b \
    AI_CHAT_MODEL=llama3:8b

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend
COPY .env.example ./.env.example

RUN mkdir -p /tmp/lostfound/uploads /tmp/lostfound/upload-cache /tmp/lostfound/data /tmp/lostfound/logs

EXPOSE 8000

CMD ["sh", "-c", "gunicorn backend.backend:app --worker-class uvicorn.workers.UvicornWorker --bind ${HOST:-0.0.0.0}:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]
