$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

$EnvFile = Join-Path $RootDir ".env"
$VenvDir = Join-Path $RootDir ".venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$GunicornExe = Join-Path $VenvDir "Scripts\gunicorn.exe"

if (-not (Test-Path $EnvFile)) {
  Copy-Item ".env.example" ".env"
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') {
    return
  }
  $parts = $_.Split('=', 2)
  [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1])
}

$uploadDir = if ($env:UPLOAD_DIR) { $env:UPLOAD_DIR } else { ".\uploads" }
$logDir = if ($env:LOG_DIR) { $env:LOG_DIR } else { ".\logs" }
$dataDir = if ($env:DATA_DIR) { $env:DATA_DIR } else { ".\data" }

if (-not $env:OLLAMA_HOST) {
  $env:OLLAMA_HOST = if ($env:OLLAMA_URL) { $env:OLLAMA_URL } else { "http://localhost:11434" }
}
if ($env:OLLAMA_HOST -notmatch '^https?://') {
  $env:OLLAMA_HOST = "http://$($env:OLLAMA_HOST)"
}
$env:OLLAMA_HOST = $env:OLLAMA_HOST.TrimEnd("/")
if (-not $env:OLLAMA_MODEL) {
  $env:OLLAMA_MODEL = if ($env:OLLAMA_TEXT_MODEL) { $env:OLLAMA_TEXT_MODEL } else { "llama3:8b" }
}
if (-not $env:OLLAMA_TEXT_MODEL) {
  $env:OLLAMA_TEXT_MODEL = $env:OLLAMA_MODEL
}
if (-not $env:AI_CHAT_MODEL) {
  $env:AI_CHAT_MODEL = $env:OLLAMA_MODEL
}

New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if (-not (Test-Path $PythonExe)) {
  py -3 -m venv $VenvDir
}

& $PythonExe -m pip install --upgrade pip
& $PythonExe -m pip install -r requirements.txt
& $PythonExe -c "from backend.database import init_db; init_db()"

$hostValue = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$portValue = if ($env:PORT) { $env:PORT } else { "8000" }
$workerValue = if ($env:WEB_CONCURRENCY) { $env:WEB_CONCURRENCY } else { "2" }

& $GunicornExe backend.backend:app `
  --worker-class uvicorn.workers.UvicornWorker `
  --bind "${hostValue}:${portValue}" `
  --workers $workerValue
