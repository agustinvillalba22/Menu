#!/usr/bin/env bash
# Restauración de un dump de Postgres (formato custom).
# Uso: restore.sh <archivo.dump> [--verify]
#   --verify  restaura en un postgres:16 temporal y valida; no toca la DB productiva.
#   (sin flag) restauración REAL: pide escribir RESTAURAR, detiene backend y web,
#              recrea la base, restaura y corre alembic upgrade head.
set -euo pipefail

MENU_DIR="${MENU_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
COMPOSE_FILE="docker-compose.prod.yml"

usage() { echo "Uso: $0 <archivo.dump> [--verify]" >&2; exit 2; }

[ $# -ge 1 ] && [ $# -le 2 ] || usage
DUMP="$1"
VERIFY=0
if [ $# -eq 2 ]; then
  [ "$2" = "--verify" ] || usage
  VERIFY=1
fi
[ -f "$DUMP" ] && [ -s "$DUMP" ] || { echo "ERROR: archivo inexistente o vacío: $DUMP" >&2; exit 2; }
DUMP="$(realpath "$DUMP")"

if [ "$VERIFY" -eq 1 ]; then
  name="menu-restore-verify-$$-$RANDOM"
  # shellcheck disable=SC2329
  cleanup() { docker rm -f -v "$name" >/dev/null 2>&1 || true; }
  trap cleanup EXIT

  # Sin puertos publicados, volumen anónimo, password descartable.
  docker run -d --name "$name" -e POSTGRES_PASSWORD=verify postgres:16 >/dev/null

  # -h 127.0.0.1: el servidor temporal de init solo escucha en socket unix.
  ready=0
  for _ in $(seq 1 60); do
    if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
      ready=1; break
    fi
    sleep 1
  done
  [ "$ready" -eq 1 ] || { echo "ERROR: postgres temporal no arrancó" >&2; exit 1; }

  docker exec -i "$name" pg_restore --no-owner --exit-on-error -U postgres -d postgres < "$DUMP"
  docker exec "$name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM alembic_version LIMIT 1" >/dev/null
  n="$(docker exec "$name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -c "SELECT count(*) FROM users")"
  echo "users: $n"
  echo OK
  exit 0
fi

# ---- Restauración real ----
cd "$MENU_DIR"
dc() {
  local args=(-f "$COMPOSE_FILE" --env-file .env)
  [ -f release.env ] && args+=(--env-file release.env)
  docker compose "${args[@]}" "$@"
}

echo "ATENCION: esto REEMPLAZA la base de datos de producción con $DUMP."
echo "Se detendrán backend y web. Recomendado: correr antes --verify sobre este dump."
printf 'Escribí RESTAURAR para continuar: '
read -r answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

dc up -d --wait --wait-timeout 60 db
echo "==> Dump previo del estado actual (por si la restauración falla)"
"$MENU_DIR/backup.sh" --pre-migration || { echo "ERROR: no se pudo respaldar el estado actual; se aborta sin cambios." >&2; exit 1; }
echo "Si la restauración falla, recuperá con: $0 \"\$(ls -t $MENU_DIR/backups/*-premig.dump | head -1)\""
dc stop web backend
# shellcheck disable=SC2016
dc exec -T db sh -c 'dropdb --force --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
# shellcheck disable=SC2016
dc exec -T db sh -c 'pg_restore --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DUMP"
dc run --rm --no-deps backend alembic upgrade head
dc up -d --remove-orphans
echo "Restauración completa. Verificá /health y la app."
