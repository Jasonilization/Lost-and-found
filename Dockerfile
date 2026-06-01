FROM python:3.12-slim

ARG BUILD_TIMESTAMP=unknown
ARG BUILD_ID=local
ARG VCS_REF=unknown

LABEL org.opencontainers.image.title="lostfound-web" \
    org.opencontainers.image.created="${BUILD_TIMESTAMP}" \
    org.opencontainers.image.revision="${VCS_REF}" \
    org.opencontainers.image.version="${BUILD_ID}"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
    APP_BUILD_ID=${BUILD_ID} \
    APP_VCS_REF=${VCS_REF} \
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
    PUBLIC_API_BASE_URL= \
    CORS_ALLOWED_ORIGINS=* \
    CORS_ALLOWED_METHODS=GET,POST,PATCH,DELETE,OPTIONS \
    API_DEBUG_LOGGING=1 \
    REQUEST_DEBUG_LOGGING=1 \
    REQUEST_DEBUG_PAYLOAD_MAX_CHARS=4000 \
    OLLAMA_HOST=http://ollama:11434 \
    OLLAMA_MODEL=llama3:8b \
    OLLAMA_TEXT_MODEL=llama3:8b \
    OLLAMA_TIMEOUT=120 \
    AI_CHAT_MODEL=llama3:8b

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /tmp/lostfound/uploads /tmp/lostfound/upload-cache /tmp/lostfound/data /tmp/lostfound/logs

COPY backend ./backend
COPY frontend ./frontend
RUN rm -rf ./frontend/dist ./frontend/build
COPY uploads/background.png /tmp/lostfound/uploads/background.png
COPY uploads/map.png /tmp/lostfound/uploads/map.png
COPY .env.example ./.env.example
COPY docker-entrypoint.sh /usr/local/bin/lostfound-entrypoint

RUN chmod +x /usr/local/bin/lostfound-entrypoint

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/lostfound-entrypoint"]
CMD ["gunicorn"]
