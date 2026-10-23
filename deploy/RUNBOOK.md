# Runbook de aprovisionamiento — Oracle Cloud (OCI)

Arquitectura: una VM Ampere A1 (ARM) con Docker Compose y tres contenedores: `db` (Postgres 16), `backend` (FastAPI) y `web` (Caddy con el frontend estático). Caddy es lo único expuesto a internet (80/443) y obtiene los certificados de Let's Encrypt solo. Las imágenes viven en GHCR y el deploy se hace por SSH desde GitHub Actions.

Todos los pasos los ejecuta el usuario, en orden. Reemplazá los marcadores `<...>` con tus datos. No pegues secretos reales en el repo ni en tickets.

Datos que vas a necesitar a lo largo del runbook:

- `<GHCR_OWNER>`: usuario u organización de GitHub dueño del repo, **en minúsculas**.
- `<ACME_EMAIL>`: mail para avisos de Let's Encrypt.
- `<MAIL_BUDGET>`: mail para la alerta de costos.
- `<NAMESPACE>`: namespace de Object Storage de OCI (Perfil → Tenancy → "Object storage namespace").
- `<IP_RESERVADA>`: IP pública reservada (paso 4).

---

## 1. Cuenta OCI y presupuesto

Quién: el usuario.

1. Crear (o validar) la cuenta de OCI. La **región home** debe ser `sa-saopaulo-1` (Brasil Sudeste, São Paulo). No se puede cambiar después y el tier gratuito queda atado a ella.
2. Recomendado: pasar la cuenta a **Pay As You Go** (Billing → Upgrade). No cuesta nada mientras uses solo recursos del Always Free, evita el error "Out of host capacity" y evita que Oracle reclame instancias gratuitas ociosas.
3. **Crear un Budget con alerta a US$ 1**: Billing & Cost Management → Budgets → Create Budget (alcance: tenancy/compartment raíz, monto mensual US$ 1, alerta al 100 % del gasto real) con destinatario `<MAIL_BUDGET>`.

Verificación: Budgets muestra el presupuesto con una regla de alerta de umbral ≤ US$ 1 y el destinatario configurado. Con CLI: `oci budgets budget list --compartment-id <TENANCY_OCID> --target-type COMPARTMENT`.

## 2. Red (VCN)

Quién: el usuario.

1. Networking → Virtual Cloud Networks → "Start VCN Wizard" → *Create VCN with Internet Connectivity* (crea subred pública, Internet Gateway y ruta por defecto `0.0.0.0/0` → IGW). Alternativa manual: VCN + subred pública + Internet Gateway + route table con la ruta por defecto.
2. Editar la **Security List** de la subred pública (o crear un NSG y asignarlo a la VNIC). Ingress permitido, **solo**:
   - TCP 22 (ver nota abajo).
   - TCP 80 desde `0.0.0.0/0`.
   - TCP 443 desde `0.0.0.0/0`.
   - UDP 443 desde `0.0.0.0/0` (HTTP/3).
   Egress: todo abierto. Eliminar cualquier otra regla de ingress que haya creado el asistente (por ejemplo ICMP o 22 abierto de más), salvo que la quieras.
3. **Nota sobre SSH desde GitHub Actions.** Los runners de GitHub salen de un rango amplio de IPs que cambia, así que no se puede fijar un CIDR estable. Decisión por defecto: TCP 22 abierto a `0.0.0.0/0` **solo con autenticación por clave** (sin password, `PermitRootLogin no`, `PasswordAuthentication no`, ver paso 5) y `fail2ban` activo. Trade-off: se acepta ruido de escaneos y la exposición del puerto a cambio de poder desplegar desde Actions sin infraestructura extra. Alternativa (mejora futura): restringir el 22 a tu IP/CIDR de administrador (`ADMIN_CIDR`) y desplegar desde un runner propio o con una regla temporal.

Verificación: la Security List/NSG muestra exactamente las reglas de ingress anteriores. Más adelante, `nmap -Pn -p- <IP_RESERVADA>` desde fuera de tu red muestra abiertos solo 22, 80 y 443.

## 3. Crear la VM

Quién: el usuario.

1. Compute → Instances → Create instance.
2. Imagen: **Canonical Ubuntu 24.04** (aarch64). Shape: **VM.Standard.A1.Flex**. Mínimo recomendado **1 OCPU / 6 GB**; el Always Free permite hasta 4 OCPU / 24 GB en total, así que podés dar más holgura (por ejemplo 2 OCPU / 12 GB).
3. Boot volume: 50 a 100 GB (el Always Free incluye 200 GB entre todos los volúmenes).
4. Red: la VCN y la subred pública del paso 2, con IP pública asignada (se reemplaza por la reservada en el paso 4).
5. Pegar tu clave SSH pública de administrador (o subir el archivo `.pub`).
6. **Si aparece "Out of host capacity"**: reintentar en otro horario, probar otro Availability Domain, bajar la cantidad de OCPU/RAM, o completar el upgrade a Pay As You Go (paso 1). **No** resolverlo cambiando de región: la home no cambia.

Verificación: la instancia queda en estado *Running* y `ssh ubuntu@<IP_PUBLICA_ACTUAL>` entra con tu clave de administrador (`uname -m` devuelve `aarch64`).

## 4. IP pública reservada

Quién: el usuario.

1. Networking → IP management → Reserved public IPs → Reserve public IP address (`sa-saopaulo-1`).
2. En la instancia: Attached VNICs → VNIC primaria → IPv4 Addresses → Edit → "No public IP" y luego "Reserved public IP" eligiendo la reservada. Anotarla como `<IP_RESERVADA>`.

Verificación: Reserved public IPs muestra la IP como *Assigned* a la VNIC de la VM, y `ssh ubuntu@<IP_RESERVADA>` entra. Tras reiniciar la VM la IP no cambia.

## 5. Primer acceso y hardening

Quién: el usuario. Todo por SSH como `ubuntu` (usuario inicial con sudo).

1. Crear el usuario de deploy **sin sudo**:
   ```bash
   sudo adduser --disabled-password --gecos "" deploy
   sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
   ```
   Se agrega al grupo `docker` cuando `bootstrap-vm.sh` instala Docker (paso siguiente). Riesgo documentado: pertenecer al grupo `docker` equivale a root efectivo en la VM; se acepta por simplicidad.
2. Deshabilitar password y root por SSH:
   ```bash
   sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
   PasswordAuthentication no
   PermitRootLogin no
   KbdInteractiveAuthentication no
   EOF
   sudo sshd -t && sudo systemctl reload ssh
   ```
   Mantené abierta la sesión actual hasta confirmar que podés abrir una nueva.
3. Copiar y ejecutar el bootstrap (desde tu máquina, con el repo clonado):
   ```bash
   scp deploy/bootstrap-vm.sh ubuntu@<IP_RESERVADA>:/tmp/
   ssh ubuntu@<IP_RESERVADA> 'sudo DEPLOY_USER=deploy bash /tmp/bootstrap-vm.sh'
   ```
   Instala Docker Engine + Compose, `rclone`, `fail2ban`, `unattended-upgrades` (solo seguridad) e `iptables-persistent`; crea swap de 2 GB, `/opt/menu` y `/opt/menu/backups`; agrega a `deploy` al grupo `docker`; abre en iptables solo 22, 80, 443/tcp y 443/udp antes de la regla `REJECT` de la imagen; e instala el cron de backup. Es idempotente: se puede volver a correr. Con `ADMIN_CIDR=<tu_cidr>` el 22 queda restringido a ese rango.
4. Doble firewall: la imagen de Ubuntu de OCI trae sus propias reglas iptables además de la Security List/NSG. Ambas deben tener 80/443 abiertos.
5. Informativo: OCI **bloquea el puerto 25 saliente**. El backend no envía mails, así que no hay nada que hacer; si en el futuro se envían mails, usar el 587 o un servicio por HTTP.

Verificación: `sudo iptables -S INPUT` lista una regla ACCEPT por cada puerto 22, 80, 443/tcp y 443/udp antes del `REJECT`; `id deploy` muestra el grupo `docker` y no `sudo`; `ssh -o PreferredAuthentications=password ubuntu@<IP_RESERVADA>` es rechazado; `docker compose version` funciona; `swapon --show` muestra un único `/swapfile` de 2 GB.

## 6. DNS en Cloudflare

Quién: el usuario. Zona `gurmeapp.com`.

1. Crear dos registros `A`: `app` → `<IP_RESERVADA>` y `api` → `<IP_RESERVADA>`, **Proxy status: DNS only (nube gris)**, TTL Auto. Caddy obtiene los certificados por HTTP-01, así que el puerto 80 debe llegar directo a la VM.
2. **Landing**: `gurme.com.ar` (delegado a Cloudflare) irá a Cloudflare Pages más adelante. Hoy solo se reserva el apex y `www` para Pages (CNAME a `<proyecto>.pages.dev` cuando exista). No se hace nada más en esta etapa.

Verificación: `dig +short app.gurmeapp.com` y `dig +short api.gurmeapp.com` devuelven `<IP_RESERVADA>`.

## 7. GHCR (registro de imágenes)

Quién: el usuario.

1. En GitHub: Settings → Developer settings → Personal access tokens → *Tokens (classic)* → permiso **solo `read:packages`**. Guardalo en un gestor de contraseñas.
2. En la VM, como `deploy`:
   ```bash
   ssh ubuntu@<IP_RESERVADA>
   sudo -iu deploy
   echo '<PAT>' | docker login ghcr.io -u <TU_USUARIO_GITHUB> --password-stdin
   ```
3. Los paquetes `menu-backend` y `menu-web` se crean en el primer push del workflow (privados por defecto). Después del primer deploy (paso 13) verificar que cada paquete quede vinculado al repositorio (Package settings → Connect repository) y que el workflow tenga acceso de escritura.

Verificación: `docker login` responde `Login Succeeded`; `cat ~/.docker/config.json` (como `deploy`) contiene la entrada `ghcr.io` (no pegues su contenido en ningún lado).

## 8. Clave de deploy y secrets de GitHub

Quién: el usuario.

1. En tu máquina, generar una clave **dedicada** al deploy, sin passphrase y usada solo por CI:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "ci-deploy" -f ./oci_deploy_key
   ```
2. Agregar la pública a `deploy` en la VM (solo ese usuario, sin sudo; el deploy corre con `deploy.sh`):
   ```bash
   ssh ubuntu@<IP_RESERVADA> "sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null" < ./oci_deploy_key.pub
   ssh ubuntu@<IP_RESERVADA> 'sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys'
   ```
   Mejora futura opcional (no es un paso pendiente; `ssh-entry.sh` no existe hoy): restringir la clave con `restrict,command="/opt/menu/ssh-entry.sh"` si algún día se agrega un script de entrada. Mínimo exigido: usuario `deploy` no-root, sin sudo, solo grupo `docker`.
3. Obtener `known_hosts` fijado y **verificar el fingerprint contra la consola de OCI** (Instance → "Console connection" o el fingerprint que muestra el arranque) o contra `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` ejecutado en la VM:
   ```bash
   ssh-keyscan -t ed25519 <IP_RESERVADA> > ./oci_known_hosts
   ssh-keygen -lf ./oci_known_hosts
   ```
4. En GitHub: Settings → Environments → New environment **`production`** (más adelante se le puede agregar aprobación manual sin tocar el workflow). En ese entorno, Secrets:
   - `OCI_HOST`: `<IP_RESERVADA>`
   - `OCI_SSH_USER`: `deploy`
   - `OCI_SSH_KEY`: contenido completo de `./oci_deploy_key` (clave privada)
   - `OCI_SSH_KNOWN_HOSTS`: contenido de `./oci_known_hosts`

   Esos cuatro son los únicos secrets en GitHub; los de la aplicación viven solo en la VM.
5. Borrar de tu máquina `oci_deploy_key` (y su `.pub`) una vez cargados los secrets.

Verificación: `ssh -i ./oci_deploy_key -o BatchMode=yes deploy@<IP_RESERVADA> 'id'` (antes de borrarla) funciona; `ssh -o BatchMode=yes deploy@<IP_RESERVADA> 'sudo -n true'` falla (sin sudo); con una clave distinta a la de CI no hay acceso; el entorno `production` muestra los cuatro secrets.

## 9. `/opt/menu/.env`

Quién: el usuario.

1. Copiar la plantilla y completarla a mano en la VM (como `deploy`):
   ```bash
   scp deploy/.env.prod.example ubuntu@<IP_RESERVADA>:/tmp/.env.new
   ssh ubuntu@<IP_RESERVADA> 'sudo install -m 600 -o deploy -g deploy /tmp/.env.new /opt/menu/.env && rm /tmp/.env.new'
   sudo -iu deploy nano /opt/menu/.env
   ```
2. Generar los secretos con los comandos de la plantilla:
   - `SECRET_KEY`: `openssl rand -hex 48`
   - `POSTGRES_PASSWORD`: `openssl rand -hex 24` (alfanumérica; debe coincidir en `DATABASE_URL`)
   - `MP_TOKEN_ENCRYPTION_KEY`: `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
3. Completar R2, `ACME_EMAIL=<ACME_EMAIL>`, `GHCR_OWNER=<GHCR_OWNER>` y las variables de backups (pasos 10 a 12).
4. **Credenciales de Mercado Pago: solo de PRUEBA** (cuenta y aplicación de prueba). No copiar el `.env` de desarrollo ni definir `MP_TEST_SELLER_ACCESS_TOKEN`.
5. `chmod 600 /opt/menu/.env` y dueño `deploy`.

Verificación: `ls -l /opt/menu/.env` muestra `-rw------- deploy deploy`; `grep -c CAMBIAR /opt/menu/.env` devuelve `0` (ningún placeholder sin completar; no imprimas el archivo).

## 10. Cloudflare R2 — CORS del bucket

Quién: el usuario.

1. R2 → bucket de imágenes → Settings → CORS Policy → agregar:
   ```json
   [
     {
       "AllowedOrigins": ["https://app.gurmeapp.com"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Agregar `http://localhost:3000` a `AllowedOrigins` solo si seguís desarrollando contra el mismo bucket.
2. Confirmar que `R2_PUBLIC_URL` (dominio público o `r2.dev`) tiene lectura pública y es `https` (el SPA corre en https; una URL `http` quedaría bloqueada por contenido mixto).

Verificación: preflight desde la terminal con un presigned URL o con la URL pública del bucket:
`curl -si -X OPTIONS -H 'Origin: https://app.gurmeapp.com' -H 'Access-Control-Request-Method: PUT' -H 'Access-Control-Request-Headers: content-type' '<R2_PUBLIC_URL>/<objeto>'` devuelve `Access-Control-Allow-Origin: https://app.gurmeapp.com`; con `Origin: https://otro.example` no devuelve ese header.

## 11. Mercado Pago (cuenta de prueba)

Quién: el usuario. Solo credenciales de PRUEBA; este proyecto no usa credenciales productivas.

1. En Mercado Pago Developers → tu aplicación de prueba:
   - Redirect URI (OAuth): `https://api.gurmeapp.com/payments/mercadopago/callback`
   - Webhook (URL de notificaciones): `https://api.gurmeapp.com/webhooks/mercadopago`
2. Copiar el secreto de firma de webhooks a `MP_WEBHOOK_SECRET` en `/opt/menu/.env`, y `Client ID`/`Client Secret` de la aplicación de prueba a `MP_CLIENT_ID`/`MP_CLIENT_SECRET`. `PUBLIC_API_URL` y `FRONTEND_URL` ya vienen en la plantilla.
3. Hacer esto **después** del primer deploy (paso 13) para poder probar el webhook contra la API real.

Verificación: en el panel de la aplicación (Webhooks → Simular notificación) o en el historial de notificaciones, la URL `https://api.gurmeapp.com/webhooks/mercadopago` responde `200` a una notificación simulada.

## 12. Object Storage para backups

Quién: el usuario.

1. Storage → Buckets → Create: nombre `menu-backups`, región `sa-saopaulo-1`, tier *Standard*, **privado**.
2. IAM: crear un usuario dedicado (por ejemplo `menu-backup`), un grupo con ese usuario y una política mínima:
   ```
   Allow group menu-backup-group to manage objects in compartment <COMPARTMENT> where target.bucket.name='menu-backups'
   Allow group menu-backup-group to read buckets in compartment <COMPARTMENT> where target.bucket.name='menu-backups'
   ```
3. En ese usuario: Customer secret keys → Generate. Copiar el *secret* en el momento (no se vuelve a mostrar). Cargar en `/opt/menu/.env`:
   - `OCI_S3_ACCESS_KEY_ID`: el Access Key de la Customer Secret Key.
   - `OCI_S3_SECRET_ACCESS_KEY`: el secret.
   - `OCI_S3_ENDPOINT=https://<NAMESPACE>.compat.objectstorage.sa-saopaulo-1.oraclecloud.com`
   - `BACKUP_RCLONE_REMOTE=ocibackup:menu-backups` (con ese nombre de remoto `backup.sh` configura `rclone` solo, sin `rclone.conf`).
4. **Lifecycle rule** en el bucket: Resources → Lifecycle Policy Rules → Create → acción *Delete*, objetos con antigüedad > 30 días (el script además borra remotos con `rclone delete --min-age 30d`).
5. El free tier incluye 10 GB de Object Storage Standard; mantener el tamaño total de dumps por debajo (la alerta del Budget avisa si se excede).

Verificación: con las variables del `.env` cargadas, `rclone lsd ocibackup:` (remoto temporal por variables de entorno `RCLONE_CONFIG_OCIBACKUP_*`) lista `menu-backups`; la política de lifecycle figura como activa. La verificación completa se hace en el paso 15 con el primer backup.

## 13. Primer deploy

Quién: el usuario.

1. Verificar que están hechos los pasos 5 a 12 y que `/opt/menu/.env` está completo.
2. GitHub → Actions → **Deploy** → Run workflow (rama `main`, sin `tag`), o hacer push a `main` con el workflow `CI` en verde. El workflow construye las imágenes `linux/arm64`, las sube a GHCR, copia `docker-compose.prod.yml` y los scripts a `/opt/menu/` y ejecuta `deploy.sh`.
3. Revisar que los paquetes de GHCR quedaron vinculados al repo (paso 7.3).
4. Tarda unos segundos extra la primera vez: Caddy pide los certificados de Let's Encrypt.

Verificación: el job termina en verde (incluye smoke test); `curl -vI https://api.gurmeapp.com/health` (sin `-k`) muestra un certificado emitido por Let's Encrypt y `200`; `curl -fsS https://api.gurmeapp.com/health` devuelve `{"status":"ok"}`; `curl -sI https://app.gurmeapp.com/menu/cualquiera` devuelve `200`; en la VM `cat /opt/menu/release.env` muestra `IMAGE_TAG=sha-<7>`; `docker compose -f docker-compose.prod.yml ps` no muestra puertos publicados para `db` ni `backend`.

## 14. Bootstrap de datos

Quién: el usuario.

1. Entrar a `https://app.gurmeapp.com`, registrar el primer usuario por la UI.
2. Promoverlo a superadmin desde la VM, como `deploy`, en `/opt/menu`:
   ```bash
   cd /opt/menu
   docker compose -f docker-compose.prod.yml --env-file .env --env-file release.env \
     exec backend python scripts/promote_superadmin.py <email>
   ```

Verificación: el comando termina sin error y al iniciar sesión con ese usuario aparece el panel `/admin`. En el navegador, la cookie `access_token` está guardada con `Secure; HttpOnly; SameSite=Lax` y no hay errores de CORS en la consola.

## 15. Backups

Quién: el usuario.

1. Correr un backup a mano, como `deploy`, en `/opt/menu`:
   ```bash
   ./backup.sh
   ```
2. Confirmar el objeto en el bucket (consola de OCI o `rclone ls`) y el archivo local en `/opt/menu/backups/` (permisos `600`).
3. Probar la restauración **sin tocar producción**:
   ```bash
   ./restore.sh /opt/menu/backups/<archivo>.dump --verify
   ```
4. El cron diario (04:00 `America/Argentina/Buenos_Aires`) lo instaló `bootstrap-vm.sh`; el log queda en `/opt/menu/backups/backup.log`. Retención: 7 días local (3 para los dumps previos a migración) y 30 días remota.
5. **Repetir la prueba de restore (`--verify`) una vez al mes.** Anotarlo en tu calendario.

Verificación: `./backup.sh` sale con código 0; `ls -l /opt/menu/backups` muestra un `.dump` de tamaño > 0 y modo `-rw-------`; el objeto aparece en `menu-backups`; `./restore.sh <dump> --verify` imprime `OK` y `docker ps -a` no deja ningún contenedor `menu-restore-verify-*`; `crontab -l` (como `deploy`) tiene una única entrada `menu-backup`.

## 16. Actualizaciones del sistema operativo

Quién: el usuario.

1. `unattended-upgrades` aplica solo actualizaciones de seguridad (lo configura el bootstrap). No reinicia solo.
2. Política de reinicios: **reinicio manual una vez por mes** (kernel). Los contenedores tienen `restart: unless-stopped`, así que el stack vuelve solo. Hacerlo en un horario de poco uso: habrá algunos minutos de interrupción.

Verificación: `systemctl status unattended-upgrades` activo; `apt-config dump | grep Unattended` muestra `Unattended-Upgrade "1"`; tras `sudo reboot`, sin intervención, `curl -fsS https://api.gurmeapp.com/health` responde `200` en menos de 3 minutos y `docker compose -f docker-compose.prod.yml ps` muestra los tres servicios arriba.

## 17. Rollback

Quién: el usuario. Hay dos herramientas distintas; elegir según qué salió mal.

**A. Volver a una imagen anterior (código).** Usar cuando un deploy introdujo un bug pero la base de datos está bien. Actions → **Deploy** → Run workflow → `tag=sha-<anterior>` y `skip_migrations=true`. No construye nada: solo vuelve a desplegar ese tag existente en GHCR. El tag anterior está en `/opt/menu/previous_tag` y en el historial de ejecuciones de Actions. También se puede hacer a mano en la VM: `/opt/menu/deploy.sh sha-<anterior> --skip-migrations`.

- Importante: el rollback de imagen **no revierte la base de datos**. Las migraciones son *expand-only* (compatibles hacia atrás), por lo que el código anterior debe seguir funcionando. Un `alembic downgrade` es manual y solo si esa migración lo permite.
- Si el health check falla durante un deploy, `deploy.sh` ya vuelve solo al tag anterior (y avisa que la base no se revirtió).

**B. Restaurar la base de datos desde un backup.** Usar cuando hay pérdida o corrupción de datos. Antes de restaurar, validar el dump con `./restore.sh <dump> --verify`. Luego, en `/opt/menu`:
```bash
./restore.sh /opt/menu/backups/<archivo>.dump
```
Pide escribir literalmente `RESTAURAR`, detiene `backend` y `web`, recrea la base, restaura, corre `alembic upgrade head` y vuelve a levantar. Se pierden los datos posteriores al backup (RPO = 24 h). Los dumps previos a migración (`*-premig.dump`) sirven para volver al estado justo antes de un deploy.

Verificación: tras A, `cat /opt/menu/release.env` muestra el tag elegido y `curl -fsS https://api.gurmeapp.com/health` responde `200`. Tras B, `/health` responde `200`, la app carga y `docker compose -f docker-compose.prod.yml exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "select count(*) from users"'` devuelve el conteo esperado.

## 18. Fase posterior (NO implementar ahora): proxy naranja de Cloudflare

Ruta futura, solo documentada. Hoy todo queda en DNS only. Cloudflare Tunnel está **descartado**.

1. SSL/TLS de la zona en modo **Full (strict)**.
2. Pasar **solo `app.`** a proxy naranja primero y probar.
3. Pasar **`api.`** después de comprobar que los webhooks de Mercado Pago siguen llegando (verificar IP/headers y respuesta `200`).
4. Para conocer la IP real del cliente, configurar en Caddy `trusted_proxies` con los rangos de Cloudflare y leer `CF-Connecting-IP`. Hoy el backend no tiene lógica que dependa de la IP del cliente.
5. Certificados: HTTP-01 sigue funcionando detrás del proxy naranja si el puerto 80 está abierto; alternativas: DNS-01 o un Origin Certificate de Cloudflare.
6. Abrir 80/443 solo a los rangos de Cloudflare (Security List/NSG e iptables).

---

## Riesgos aceptados y pendientes

- **Sin rate limiting** en login, registro, endpoints públicos de pedidos ni webhook. Recomendado resolverlo antes de abrir al público (milestone aparte).
- Pertenecer al grupo `docker` equivale a root efectivo; el puerto 22 queda abierto a internet con solo clave.
- Instancia única (sin alta disponibilidad): RPO 24 h; RTO = tiempo de re-aprovisionar con este runbook más el restore.
- Cada deploy implica una breve interrupción al recrear los contenedores (sin zero-downtime).
- Si no se pasa a Pay As You Go, Oracle puede reclamar instancias Always Free ociosas.
