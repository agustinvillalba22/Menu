#!/usr/bin/env bash
# Prepara una VM Ubuntu 24.04 (arm64) nueva. Correr UNA vez como root:
#   sudo DEPLOY_USER=deploy ./bootstrap-vm.sh
# Idempotente: re-ejecutarlo no duplica swap, reglas de iptables ni cron.
# No genera ni toca /opt/menu/.env.
#
# Variables opcionales:
#   DEPLOY_USER  usuario de deploy ya creado (default: deploy)
#   ADMIN_CIDR   si se define, el puerto 22 solo se abre a ese CIDR
#
# NOTA TECNICA: los puertos publicados por Docker pasan por las cadenas
# DOCKER/FORWARD y NO quedan filtrados por las reglas INPUT de abajo. La
# protección real de db/backend es no publicarlos (docker-compose.prod.yml)
# más la Security List/NSG de OCI.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "ERROR: correr como root (sudo)" >&2; exit 1; }

DEPLOY_USER="${DEPLOY_USER:-deploy}"
ADMIN_CIDR="${ADMIN_CIDR:-}"
MENU_DIR="/opt/menu"
export DEBIAN_FRONTEND=noninteractive

id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "ERROR: el usuario $DEPLOY_USER no existe" >&2; exit 1; }

echo "==> Paquetes base"
apt-get update -y
apt-get install -y ca-certificates curl gnupg rclone unattended-upgrades cron fail2ban
echo iptables-persistent iptables-persistent/autosave_v4 boolean false | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean false | debconf-set-selections
apt-get install -y iptables-persistent

echo "==> Docker Engine + Compose"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -s /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

echo "==> Actualizaciones automáticas (solo seguridad)"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
# Origins por defecto de Ubuntu: -security (y ESM). No se habilita -updates.

echo "==> Swap 2 GB"
if ! swapon --show=NAME --noheadings | grep -q '^/swapfile$'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
sysctl -w vm.swappiness=10 >/dev/null

echo "==> Directorios"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0755 "$MENU_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$MENU_DIR/backups"

echo "==> iptables (INPUT)"
has_accept() { # proto port
  iptables -S INPUT | grep -E -- "-p $1 .*--dport $2( |$).*-j ACCEPT" >/dev/null
}
reject_pos() {
  iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}'
}
add_rule() { # proto port [source]
  local proto="$1" port="$2" src="${3:-}" pos
  local spec=(-p "$proto")
  [ -n "$src" ] && spec+=(-s "$src")
  spec+=(-m "$proto" --dport "$port" -m comment --comment menu-bootstrap -j ACCEPT)
  iptables -C INPUT "${spec[@]}" 2>/dev/null && return 0
  pos="$(reject_pos)"
  if [ -n "$pos" ]; then iptables -I INPUT "$pos" "${spec[@]}"; else iptables -A INPUT "${spec[@]}"; fi
}

if [ -n "$ADMIN_CIDR" ]; then
  add_rule tcp 22 "$ADMIN_CIDR"
  # Quita las reglas de 22 abiertas a todos (la nuestra ya está insertada: sin lockout).
  while true; do
    n="$(iptables -L INPUT --line-numbers -n | awk '$2=="ACCEPT" && $3=="tcp" && $5=="0.0.0.0/0" && /dpt:22( |$)/ && !/menu-bootstrap/{print $1; exit}')"
    [ -n "$n" ] || break
    iptables -D INPUT "$n"
  done
else
  has_accept tcp 22 || add_rule tcp 22
fi
has_accept tcp 80  || add_rule tcp 80
has_accept tcp 443 || add_rule tcp 443
has_accept udp 443 || add_rule udp 443
netfilter-persistent save

echo "==> Cron de backup (04:00 America/Argentina/Buenos_Aires)"
tmp="$(mktemp)"
{ crontab -u "$DEPLOY_USER" -l 2>/dev/null | grep -v -e 'menu-backup' -e '^CRON_TZ=' || true; } > "$tmp"
{
  echo 'CRON_TZ=America/Argentina/Buenos_Aires'
  echo "0 4 * * * $MENU_DIR/backup.sh >> $MENU_DIR/backups/backup.log 2>&1 # menu-backup"
} >> "$tmp"
crontab -u "$DEPLOY_USER" "$tmp"
rm -f "$tmp"
systemctl enable --now cron

echo "==> Listo. Cerrá y reabrí la sesión SSH de $DEPLOY_USER para que aplique el grupo docker."
