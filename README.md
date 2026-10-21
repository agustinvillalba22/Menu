# Menu

Plataforma de menú digital con QR para bares y restaurants. El cliente escanea el QR y ve el menú sin necesidad de loguearse; el owner/editor gestiona todo desde un dashboard web.

Monorepo:
- `backend/` — API FastAPI + PostgreSQL (SQLAlchemy async + Alembic).
- `src/` — frontend Vite + React 19 + TypeScript, Tailwind CSS.

## Prerrequisitos

- **Docker** + **Docker Compose** (corre PostgreSQL y el backend).
- **Node.js** 20+ y **npm** (corre el frontend, siempre nativo — nunca en Docker).
- Una cuenta de **Cloudflare** con un bucket **R2** ya creado, si vas a trabajar con imágenes de producto (ver sección R2 más abajo). No hace falta para el resto de la app.

## Levantar el ambiente

### 1. Variables de entorno

Copiá los dos `.env.example` y completalos:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

- **`.env`** (raíz, usado por el frontend): `VITE_API_URL=http://localhost:8000` alcanza para desarrollo local, no requiere cambios.
- **`backend/.env`**: completá `SECRET_KEY` con cualquier string largo random, y las variables `R2_*` si vas a trabajar con imágenes (ver más abajo). El resto de los defaults ya apuntan a la DB de Docker Compose.

Ambos `.env` están gitignorados — nunca se commitean.

### 2. Backend + base de datos (Docker)

```bash
docker compose up -d
```

Esto levanta `db` (PostgreSQL 16) y `backend` (FastAPI en `http://localhost:8000`, con reload automático). Verificá que arrancó bien:

```bash
curl http://localhost:8000/docs
```

**Migraciones:** se corren dentro del contenedor del backend:

```bash
docker compose exec backend alembic upgrade head
```

Corré esto la primera vez y cada vez que aparezca una migración nueva (`backend/alembic/versions/`).

**Si reinstalás dependencias del backend** (cambia `backend/requirements.txt`), hay que reconstruir la imagen — un simple `docker compose up -d` no reinstala nada dentro de un contenedor ya creado:

```bash
docker compose build backend && docker compose up -d backend
```

Lo mismo aplica después de cambiar cualquier variable en `backend/.env` — las env vars se leen solo al arrancar el proceso, así que hace falta recrear el contenedor (`docker compose up -d backend`, no hace falta rebuild si solo cambió el `.env`).

### 3. Frontend (nativo, no Docker)

```bash
npm install
npm run dev
```

Sirve en `http://localhost:3000`.

### 4. Cuenta de prueba

Registrate desde `/register`, o si ya existe una cuenta sembrada en tu DB:

```
owner@test.com / password123
```

Esa cuenta es owner de "Boulette Pizzeria" (datos de ejemplo) y también tiene `is_superadmin=true`, para poder probar `/admin` (gestión de usuarios/restaurants) con la misma cuenta.

Para promover cualquier usuario a superadmin manualmente:

```bash
docker compose exec backend python scripts/promote_superadmin.py <email>
```

## Cloudflare R2 (imágenes de producto)

Las imágenes de ítem se suben directo del navegador a R2 vía presigned URL (el binario nunca pasa por nuestra API). Para que funcione en local necesitás:

1. **Bucket R2 creado** en el dashboard de Cloudflare, y un **API token** con permisos de lectura/escritura sobre ese bucket (te da `Account ID`, `Access Key ID`, `Secret Access Key`).
2. Completar en `backend/.env`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
   R2_BUCKET_NAME=...
   R2_PUBLIC_URL=...
   ```
3. **Public Access** habilitado en el bucket (Settings → Public access → Allow Access, subdominio `r2.dev` es lo más rápido) — copiá esa URL en `R2_PUBLIC_URL`. Sin esto, las imágenes se suben bien pero `image_url` queda como una ruta relativa rota (no se ve la imagen en el menú aunque el archivo sí exista en el bucket).
4. **CORS del bucket** (Settings → CORS Policy) — sin esto, el navegador bloquea el upload con un 403 en el preflight `OPTIONS`. Regla mínima para desarrollo local:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Cuando se deployee el frontend a un dominio real, agregar ese origin también.

Después de cambiar `backend/.env`, recreá el contenedor (`docker compose up -d backend`) para que tome los valores nuevos.

## Mercado Pago (cobro de pedidos)

Cada restaurante conecta su propia cuenta de Mercado Pago desde el dashboard (Pasarela de pagos) y el dinero va directo a esa cuenta; la plataforma no cobra comisión. Es opcional: si las variables no están completas, la opción de pagar con Mercado Pago no aparece y el resto de la app funciona igual.

1. En [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) creá una aplicación (Checkout Pro). Copiá el **Client ID** y el **Client Secret**.
2. En la configuración de la aplicación cargá como **Redirect URI** `<PUBLIC_API_URL>/payments/mercadopago/callback`, y en Webhooks la URL `<PUBLIC_API_URL>/webhooks/mercadopago` (evento *Pagos*); copiá la **clave secreta** del webhook.
3. Generá la clave de cifrado de tokens:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
4. Completá en `backend/.env`:
   ```
   MP_CLIENT_ID=...
   MP_CLIENT_SECRET=...
   MP_WEBHOOK_SECRET=...
   MP_TOKEN_ENCRYPTION_KEY=...
   PUBLIC_API_URL=https://tu-backend-publico
   FRONTEND_URL=http://localhost:3000
   ```
   `PUBLIC_API_URL` tiene que ser accesible desde internet (en local, un túnel tipo ngrok o Cloudflare Tunnel). Para probar usá cuentas de prueba de Mercado Pago (vendedor y comprador).
5. Corré las migraciones (`docker compose exec backend alembic upgrade head`) y recreá el contenedor del backend para que tome las variables nuevas.

### Logging y cookie de sesión

Variables opcionales en `backend/.env`:

- `LOG_LEVEL` (default `INFO`): nivel de logging del backend. Cada request se loguea en una línea (método, ruta, status, duración y `request_id`) y la respuesta incluye el header `X-Request-ID`.
- `COOKIE_SAMESITE` (`lax` por defecto, también `strict` o `none`): atributo SameSite de la cookie de sesión. `none` exige `COOKIE_SECURE=true`; si no, el backend no arranca.

## Tests

**Backend** (pytest, corre contra SQLite in-memory, no necesita Postgres levantado):
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # si no existe todavía
pip install -r requirements.txt
python -m pytest
```

**Frontend** (Vitest):
```bash
npm run test -- --run
npx tsc --noEmit   # chequeo de tipos estricto
```
