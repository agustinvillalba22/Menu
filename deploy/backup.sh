#!/usr/bin/env bash
# Backup de Postgres: pg_dump -Fc local + copia a OCI Object Storage (rclone).
# Uso: backup.sh [--pre-migration]
#   --pre-migration: dump previo a una migración; solo local, retención 3 días.
# Corre en la VM desde /opt/menu (cron diario 04:00 America/Argentina/Buenos_Aires).
# No imprime valores de .env. Sale != 0 ante cualquier fallo.
set -euo pipefail

MENU_DIR="${MENU_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$MENU_DIR/backups}"
COMPOSE_FILE="docker-compose.prod.yml"
cd "$MENU_DIR"

PRE_MIGRATION=0
case "${1:-}" in
  "") ;;
  --pre-migration) PRE_MIGRATION=1 ;;
  *) echo "Uso: $0 [--pre-migration]" >&2; exit 2 ;;
esac

dc() {
  local args=(-f "$COMPOSE_FILE" --env-file .env)
  [ -f release.env ] && args+=(--env-file release.env)
  docker compose "${args[@]}" "$@"
}

# Lee una clave de .env sin hacer source (el archivo no es shell válido: JSON, etc.).
env_get() {
  local line
  line="$(grep -E "^$1=" .env | tail -n 1 || true)"
  line="${line#*=}"
  line="${line#\'}"; line="${line%\'}"
  line="${line#\"}"; line="${line%\"}"
  printf '%s' "$line"
}

umask 077
mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
suffix=""
[ "$PRE_MIGRATION" -eq 1 ] && suffix="-premig"
out="$BACKUP_DIR/menu-${ts}${suffix}.dump"

cleanup_partial() { rm -f "$out"; }
trap cleanup_partial ERR

# POSTGRES_USER/POSTGRES_DB ya existen dentro del contenedor db (se expanden allí).
# shellcheck disable=SC2016
if ! dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$out"; then
  echo "ERROR: pg_dump falló" >&2
  cleanup_partial
  exit 1
fi
if [ ! -s "$out" ]; then
  echo "ERROR: el dump quedó vacío" >&2
  cleanup_partial
  exit 1
fi
trap - ERR
chmod 600 "$out"
echo "Dump local: $out ($(du -h "$out" | cut -f1))"

# Retención local
find "$BACKUP_DIR" -maxdepth 1 -name 'menu-*-premig.dump' -type f -mtime +3 -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'menu-*.dump' ! -name '*-premig.dump' -type f -mtime +7 -delete

if [ "$PRE_MIGRATION" -eq 1 ]; then
  exit 0
fi

# Remoto
remote="$(env_get BACKUP_RCLONE_REMOTE)"
if [ -z "$remote" ]; then
  echo "ERROR: BACKUP_RCLONE_REMOTE no está definido en .env" >&2
  exit 1
fi
remote_name="${remote%%:*}"
if [ "$remote_name" = "ocibackup" ]; then
  # Remoto S3-compatible de OCI configurado por variables de entorno (sin rclone.conf).
  export RCLONE_CONFIG_OCIBACKUP_TYPE=s3
  export RCLONE_CONFIG_OCIBACKUP_PROVIDER=Other
  RCLONE_CONFIG_OCIBACKUP_ACCESS_KEY_ID="$(env_get OCI_S3_ACCESS_KEY_ID)"
  RCLONE_CONFIG_OCIBACKUP_SECRET_ACCESS_KEY="$(env_get OCI_S3_SECRET_ACCESS_KEY)"
  RCLONE_CONFIG_OCIBACKUP_ENDPOINT="$(env_get OCI_S3_ENDPOINT)"
  export RCLONE_CONFIG_OCIBACKUP_ACCESS_KEY_ID RCLONE_CONFIG_OCIBACKUP_SECRET_ACCESS_KEY RCLONE_CONFIG_OCIBACKUP_ENDPOINT
  export RCLONE_CONFIG_OCIBACKUP_REGION=sa-saopaulo-1
  export RCLONE_CONFIG_OCIBACKUP_NO_CHECK_BUCKET=true
fi

rclone copy "$out" "$remote"
rclone delete --min-age 30d "$remote"
echo "Copia remota OK en $remote_name"
