# School Lost and Found

A local FastAPI-based lost-and-found system for school use. The backend serves the API and frontend together, stores data in SQLite, saves uploaded files locally, and can optionally connect to Ollama for AI-assisted tagging and chat.

## Requirements

- Python 3.10 or newer
- `pip`
- Docker and Docker Compose plugin for container deployment (optional)
- Ollama for AI features (optional)
- Node.js is not required for the current frontend

## Project Structure

```text
backend/
frontend/
data/
uploads/
logs/
tests/
Dockerfile
docker-compose.yml
deploy.sh
deploy.ps1
lostfound.service
nginx.conf
requirements.txt
start.sh
```

Runtime data is stored in:

- `data/lost_found.db` for SQLite
- `uploads/` for user files
- `logs/` for runtime logs

## Quick Start

```bash
git clone <https://github.com/Jasonilization/Lost-and-found>
cd Lost-and-found
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` will:

- create `.env` from `.env.example` if it does not exist
- create `.venv` if needed
- install Python dependencies
- create `uploads/`, `logs/`, and `data/`
- initialize the SQLite database safely
- start the backend with Gunicorn

The app will then be available on `http://localhost:8000` unless you change `PORT` in `.env`.

## Environment

The app reads deployment settings from `.env`. A starter file is included in `.env.example`.

Important variables:

```env
PORT=8000
WEB_CONCURRENCY=2
HOST=0.0.0.0
DATA_DIR=./data
DATABASE_PATH=./data/lost_found.db
UPLOAD_DIR=./uploads
LOG_DIR=./logs
ADMIN_USERNAME=
ADMIN_PASSWORD=
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b
OLLAMA_TEXT_MODEL=llama3:8b
OLLAMA_IMAGE_MODEL=llava
AI_CHAT_MODEL=llama3:8b
```

If `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set and no admin exists yet, the backend will bootstrap the first admin account on startup.

For LAN or external Ollama servers, set `OLLAMA_HOST` to the reachable server URL, such as `http://192.168.1.20:11434`. For Docker on a host-running Ollama, set it to the host address reachable from the container. The app detects downloaded models through Ollama's HTTP API instead of local model paths.

## Docker Run

```bash
cp .env.example .env
docker-compose up --build
```

The compose setup:

- builds the app from `Dockerfile`
- exposes port `8000`
- persists `uploads/`
- persists `logs/`
- persists `data/` so the database survives restarts

## Dev Mode

For local development with Uvicorn:

```bash
./start.sh
```

Or manually:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
export HOST=0.0.0.0
export PORT=8000
uvicorn backend.backend:app --host 0.0.0.0 --port 8000
```

The frontend is served by the backend at `/`.

## Production Notes

- `deploy.sh` is the simplest Linux deployment path.
- `lostfound.service` is included as a systemd starting point and is recommended for persistent service management.
- `nginx.conf` is optional and can be used as a reverse proxy in front of Gunicorn.
- `/uploads` can be served directly by Nginx if you use the sample config.
- Ollama is optional. If it is not running, the app still starts and falls back to non-AI behavior where supported.

## Systemd

Example service install flow:

```bash
sudo cp lostfound.service /etc/systemd/system/lostfound.service
sudo systemctl daemon-reload
sudo systemctl enable lostfound
sudo systemctl start lostfound
```

Update `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` inside `lostfound.service` to match your server path.

## Nginx

The included `nginx.conf` proxies requests to `127.0.0.1:8000` and serves `/uploads/` directly.

Typical flow:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/lostfound
sudo ln -s /etc/nginx/sites-available/lostfound /etc/nginx/sites-enabled/lostfound
sudo nginx -t
sudo systemctl reload nginx
```

Update the uploads alias path to match your deployment directory.

## Testing

```bash
.venv/bin/python -m unittest discover -s tests
```

## Troubleshooting

If port `8000` is already in use:

- change `PORT` in `.env`
- or stop the process already using that port

If Ollama is not running:

- the app should still boot
- AI tagging and AI chat features may fall back or be limited
- set `OLLAMA_HOST` for LAN/external servers, or start local Ollama with `ollama serve`

If uploaded images do not appear:

- confirm `UPLOAD_DIR` exists
- confirm `uploads/background.png` and other user files are present where the backend expects them
- if using Docker, confirm `./uploads:/app/uploads` is mounted

If the database seems to reset:

- confirm `DATABASE_PATH` points into `data/`
- if using Docker, confirm `./data:/app/data` is mounted

If logs are missing:

- confirm `LOG_DIR` exists
- confirm the process user can write to `logs/`
