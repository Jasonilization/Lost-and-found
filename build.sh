#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[build] %s\n' "$*"
}

die() {
  printf '[build] Error: %s\n' "$*" >&2
  exit 1
}

shell_quote() {
  printf '%q' "$1"
}

load_env_defaults() {
  local file="$1"
  local line
  local key
  local value

  if [[ -f "$file" ]]; then
    log "Loading environment defaults from ${file}"
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%$'\r'}"
      line="${line#"${line%%[![:space:]]*}"}"
      [[ -z "$line" || "$line" == \#* ]] && continue
      [[ "$line" == export\ * ]] && line="${line#export }"
      [[ "$line" == *=* ]] || continue

      key="${line%%=*}"
      value="${line#*=}"
      key="${key%"${key##*[![:space:]]}"}"
      [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

      if [[ -z "${!key-}" ]]; then
        export "$key=$value"
      fi
    done < "$file"
  fi
}

make_version() {
  local timestamp
  local vcs_ref
  timestamp="$(date -u '+%Y%m%d%H%M%S')"
  vcs_ref="$(git rev-parse --short=12 HEAD 2>/dev/null || printf 'nogit')"
  printf '%s-%s\n' "$timestamp" "$vcs_ref"
}

write_image_env() {
  local output_file="$1"
  local output_dir
  output_dir="$(dirname "$output_file")"
  mkdir -p "$output_dir"

  {
    printf 'APP_IMAGE=%s\n' "$(shell_quote "$APP_IMAGE")"
    printf 'IMAGE_VERSION=%s\n' "$(shell_quote "$IMAGE_VERSION")"
    printf 'IMAGE_REGISTRY=%s\n' "$(shell_quote "$IMAGE_REGISTRY")"
    printf 'IMAGE_REPOSITORY=%s\n' "$(shell_quote "$IMAGE_REPOSITORY")"
    printf 'DOCKER_PLATFORM=%s\n' "$(shell_quote "$DOCKER_PLATFORM")"
    printf 'BUILD_TIMESTAMP=%s\n' "$(shell_quote "$BUILD_TIMESTAMP")"
    printf 'BUILD_ID=%s\n' "$(shell_quote "$BUILD_ID")"
    printf 'VCS_REF=%s\n' "$(shell_quote "$VCS_REF")"
  } > "$output_file"
}

require_mac_desktop_context() {
  local docker_context

  command -v docker >/dev/null 2>&1 || die "docker is not available on PATH."
  docker info >/dev/null 2>&1 || die "Docker daemon is not running or is not reachable."

  [[ "$(uname -s)" == "Darwin" ]] || die "build.sh is Mac-only. Run deploy.sh on clanker instead."

  docker_context="$(docker context show 2>/dev/null || true)"
  [[ "$docker_context" == "desktop-linux" ]] || die "Refusing to build on Docker context '${docker_context:-unknown}'. Switch to desktop-linux on the Mac."
}

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
load_env_defaults "$ENV_FILE"

require_mac_desktop_context

IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-lostfound}"
IMAGE_VERSION="${IMAGE_VERSION:-${VERSION:-$(make_version)}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/arm64}"
BUILD_TIMESTAMP="${BUILD_TIMESTAMP:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
VCS_REF="${VCS_REF:-$(git rev-parse --short=12 HEAD 2>/dev/null || printf 'nogit')}"
BUILD_ID="${BUILD_ID:-${IMAGE_VERSION}}"
IMAGE_ENV_FILE="${IMAGE_ENV_FILE:-${ROOT_DIR}/.deploy/lostfound-image.env}"

[[ -n "$IMAGE_REGISTRY" ]] || die "IMAGE_REGISTRY is required, for example IMAGE_REGISTRY=docker.io/yourname or IMAGE_REGISTRY=clanker:5000."
[[ "$IMAGE_REPOSITORY" != */* ]] || die "IMAGE_REPOSITORY should be the repository name only, for example lostfound."

APP_IMAGE="${IMAGE_REGISTRY%/}/${IMAGE_REPOSITORY}:${IMAGE_VERSION}"
export APP_IMAGE BUILD_TIMESTAMP BUILD_ID VCS_REF

log "Building ${APP_IMAGE} for ${DOCKER_PLATFORM}"
docker buildx build \
  --load \
  --platform "$DOCKER_PLATFORM" \
  --build-arg "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}" \
  --build-arg "BUILD_ID=${BUILD_ID}" \
  --build-arg "VCS_REF=${VCS_REF}" \
  -t "$APP_IMAGE" \
  .

log "Pushing ${APP_IMAGE}"
docker push "$APP_IMAGE"

write_image_env "$IMAGE_ENV_FILE"

log "Wrote deployment image metadata to ${IMAGE_ENV_FILE}"
log "Deploy on clanker with: APP_IMAGE=${APP_IMAGE} ./deploy.sh"
