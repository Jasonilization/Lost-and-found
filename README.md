<<<<<<< HEAD
# School Lost and Found

A lightweight local lost-and-found system for school use. It runs with a FastAPI backend, a plain HTML/CSS/JavaScript frontend, SQLite storage, and optional Ollama keyword tagging.

## Folder Structure

```text
backend/
  __init__.py
  backend.py
  database.py
  ollama_tagger.py
frontend/
  index.html
  script.js
  style.css
uploads/
data/
requirements.txt
README.md
```

Runtime files:

- `data/lost_found.db` stores reports.
- `uploads/` stores uploaded images.
- `backend/database.db` and `backend/yolov8n.pt` are old project artifacts and are not used by the simplified app.

## Dependencies

Install the Python dependencies into a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

`sqlite3` is part of Python's standard library, so it should not be installed with `pip`.

## Install Ollama On macOS

Ollama's official macOS docs recommend installing the macOS app from the Ollama download page. After launch, the app can add the `ollama` command to your PATH.

Fast install option:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Then pull the small model used by this project:

```bash
ollama pull smollm2:135m
```

Start Ollama:

```bash
ollama serve
```

The backend connects to:

```text
http://localhost:11434
```

If Ollama is not running, uploads still work. The backend falls back to basic keyword tags.

## Run The App

Terminal 1, start Ollama:

```bash
ollama serve
```

Terminal 2, start the backend:

```bash
source .venv/bin/activate
uvicorn backend.backend:app --host 0.0.0.0 --port 8000
```

Terminal 3, start the frontend:

```bash
python3 -m http.server 5173 --directory frontend
```

Open on the Mac:

```text
http://localhost:5173
```

Open from another device on the same network:

```text
http://YOUR_MAC_OR_PI_IP:5173
```

The frontend automatically calls the backend at the same hostname on port `8000`.

## API Connection

The frontend uses browser `fetch()` calls:

- `GET /health` checks backend status.
- `GET /filters` loads category and status options.
- `POST /items/report` submits report JSON and may include an optional base64 image payload.
- `GET /items` loads gallery and search results.

Uploaded images are served by FastAPI from:

```text
http://HOSTNAME:8000/uploads/...
```

## Location System

Users can choose a predefined location or enter a room code.

Predefined locations:

- New Sports Hall
- Sports Hall
- Long Court
- Library
- Morris Forum

Room codes:

- `S302` means `Senior Building - Room S302`
- `P101` means `Primary Building - Room P101`
- `A204` means `Innovation Building - Room A204`

Room codes must be one letter, `S`, `P`, or `A`, followed by exactly three digits.

## Raspberry Pi 2GB Notes

- Use `smollm2:135m` for low memory use.
- Keep `OLLAMA_USE_IMAGE=0`; image analysis models are too heavy for a 2GB Pi.
- The app keeps prompts short and limits Ollama output.
- If Ollama is slow, stop it and use fallback keyword tagging only; the app will keep saving reports.

Optional environment variables:

```bash
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=smollm2:135m
export OLLAMA_USE_IMAGE=0
```

## Troubleshooting

Backend says `ModuleNotFoundError`:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

Frontend says backend is offline:

```bash
uvicorn backend.backend:app --host 0.0.0.0 --port 8000
```

Ollama tagging is not working:

```bash
ollama serve
ollama list
ollama pull smollm2:135m
```

Port already in use:

```bash
lsof -i :8000
lsof -i :5173
```

Another device cannot connect:

- Use the Mac or Pi LAN IP address, not `localhost`.
- Make sure backend was started with `--host 0.0.0.0`.
- Check firewall prompts on macOS and allow Python/Ollama when asked.
=======
# Lost-and-found
for school
>>>>>>> 0dd9b10727fea60ac1c0d3451f86087363573383
