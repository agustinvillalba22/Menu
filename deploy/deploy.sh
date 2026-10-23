#!/usr/bin/env bash
# Despliega un tag de imagen en la VM. Corre desde /opt/menu.
# Uso: deploy.sh <tag> [--skip-migrations] [--health-url URL]
#   <tag>: sha-<7..40 hex> o vX.Y.Z
# Rollback manual = deploy.sh <tag-anterior> --skip-migrations
# (el rollback de imagen NO revierte la base de datos).
set -euo pipefail

usage() { echo "Uso: $0 <tag> [--skip-migrations] [--health-url URL]" >&2; exit 2; }

[ $# -ge 1 ] || usage
TAG="$1"; shift
if ! [[ "$TAG" =~ ^sha-[0-9a-f]{7,40}$ || "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: tag inválido (se espera sha-<hex 7-40> o vX.Y.Z)" >&2
  exit 2
fi

SKIP_MIGRATIONS=0
HEALTH_URL="https://api.gurmeapp.com/health"
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-migrations) SKIP_MIGRATIONS=1; shift ;;
    --health-url) [ $# -ge 2 ] || usage; HEALTH_URL="$2"; shift 2 ;;
    *) usage ;;
  esac
done

MENU_DIR="${MENU_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$MENU_DIR"
COMPOSE_FILE="docker-compose.prod.yml"

dc() { docker compose -f "$COMPOSE_FILE" --env-file .env --env-file release.env "$@"; }

PREVIOUS_TAG=""
if [ -f release.env ]; then
  PREVIOUS_TAG="$(sed -n 's/^IMAGE_TAG=//p' release.env | tail -n 1)"
fi

restore_release() {
  if [ -n "$PREVIOUS_TAG" ]; then
    printf 'IMAGE_TAG=%s\n' "$PREVIOUS_TAG" > release.env
  else
    rm -f release.env
  fi
}

echo "==> Desplegando $TAG (anterior: ${PREVIOUS_TAG:-ninguno})"
printf 'IMAGE_TAG=%s\n' "$TAG" > release.env

if ! dc pull backend web; then
  echo "ERROR: pull falló; release.env restaurado" >&2
  restore_release
  exit 1
fi

echo "==> Levantando db"
if ! dc up -d --wait --wait-timeout 60 db; then
  echo "ERROR: db no quedó healthy; release.env restaurado" >&2
  restore_release
  exit 1
fi

echo "==> Backup previo a la migración"
if ! "$MENU_DIR/backup.sh" --pre-migration; then
  echo "ERROR: backup previo falló; no se migra. release.env restaurado" >&2
  restore_release
  exit 1
fi

if [ "$SKIP_MIGRATIONS" -eq 0 ]; then
  echo "==> alembic upgrade head (imagen nueva)"
  if ! dc run --rm --no-deps backend alembic upgrade head; then
    echo "ERROR: la migración falló. release.env restaurado; los contenedores no se recrearon." >&2
    restore_release
    exit 1
  fi
else
  echo "==> Migraciones omitidas (--skip-migrations)"
fi

rollback() {
  echo "ERROR: $1" >&2
  if [ -n "$PREVIOUS_TAG" ]; then
    echo "==> Volviendo a $PREVIOUS_TAG" >&2
    restore_release
    dc up -d --remove-orphans || true
  else
    echo "No hay tag previo al cual volver." >&2
  fi
  echo "ATENCION: la base de datos NO se revirtió (las migraciones aplicadas siguen vigentes)." >&2
  exit 1
}

echo "==> Recreando contenedores"
dc up -d --remove-orphans || rollback "up -d falló"

echo "==> Esperando backend healthy (hasta 60 s)"
healthy=0
for _ in $(seq 1 30); do
  cid="$(dc ps -q backend || true)"
  if [ -n "$cid" ]; then
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)"
    if [ "$status" = "healthy" ]; then healthy=1; break; fi
  fi
  sleep 2
done
[ "$healthy" -eq 1 ] || rollback "backend no llegó a healthy en 60 s"

echo "==> Verificando $HEALTH_URL"
if ! curl -fsS --retry 10 --retry-delay 3 --retry-connrefused --retry-all-errors -o /dev/null "$HEALTH_URL"; then
  rollback "health check público falló ($HEALTH_URL)"
fi

if [ -n "$PREVIOUS_TAG" ]; then
  printf '%s\n' "$PREVIOUS_TAG" > previous_tag
fi
docker image prune -f >/dev/null
echo "==> Deploy OK: $TAG"
