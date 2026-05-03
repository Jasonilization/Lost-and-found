# School Lost and Found

A local lost-and-found system for school use. It runs as a single FastAPI app that serves both the backend API and the frontend, uses SQLite for storage, and can use Ollama for optional AI-assisted tagging and chat features.

## Project Structure

```text
backend/
  __init__.py
  ai_assistant.py
  ai_moderation.py
  backend.py
  database.py
  moderation.py
  ollama_tagger.py
frontend/
  index.html
  script.js
  style.css
data/
  *.log
uploads/
tests/
requirements.txt
start.sh
```

Important runtime paths:

- `data/lost_found.db` is the active SQLite database used by the app.
- `backend/database.db` is a legacy artifact from an older project layout and is not used by the current backend.
- `uploads/` stores user-uploaded files.
- `data/*.log` stores audit and moderation logs.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Or use the startup script, which will create `.venv` automatically if needed:

```bash
./start.sh
```

## First-Boot Admin Setup

The app never hardcodes admin credentials.

On startup, the backend checks whether any admin user already exists.

- If an admin exists, bootstrap does nothing.
- If no admin exists, bootstrap creates exactly one admin user from environment variables.
- If the variables are missing, no admin is created.

Bootstrap environment variables:

```bash
export ADMIN_USERNAME="admin_username"
export ADMIN_PASSWORD="choose-a-strong-password"
./start.sh
```

The password is stored hashed through the existing auth system.

## Running The App

Start the app:

```bash
./start.sh
```

Then open:

```text
http://localhost:8000
```

The frontend is served directly by FastAPI from `/`.

## Ollama

The backend checks `http://localhost:11434` by default.

If Ollama is not running:

- the app still starts
- report tagging falls back to local keyword tagging
- AI chat features may fall back to non-model responses

Optional environment variables:

```bash
export OLLAMA_URL="http://localhost:11434"
export OLLAMA_TEXT_MODEL="llama3:8b"
export AI_CHAT_MODEL="llama3:8b"
```

## Testing

```bash
.venv/bin/python -m unittest discover -s tests
```

## Troubleshooting

If dependencies fail to install:

```bash
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

If you want to inspect the current database:

```bash
sqlite3 data/lost_found.db ".tables"
```

If you see `backend/database.db`, treat it as old data from an earlier version unless you intentionally migrate it yourself.
