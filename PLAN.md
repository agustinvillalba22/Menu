# Plan de implementación — Menu

Plan consolidado para los 8 puntos solicitados, con análisis de factibilidad, riesgo, dependencias y orden de ejecución.

---

## Estado de avance (actualizado 2026-09-14, fin de sesión)

### Completado
- **Fase 0** (0a tz helper, 0b R2 genérico) — committed.
- **Fase 1** (1a migración 0008, 1b paletas, 1c iconos, 1d P6+P7 info local + WhatsApp) — committed (6 commits sin push a la fecha).
- **Fase 2 completa — SIN COMMITEAR (el usuario hace los commits/PR):**
  - **2a**: migración `0009` (menus scheduling, tabla promos, orders.menu_id). Decisión de sesión: **`Menu.type` omitido** (sin consumidor real; agregarlo requiere migración futura si aparece).
  - **2b**: flag `MENU_SCHEDULING_ENABLED` (default false) + `resolve_active_menu()` (in-memory sobre `restaurant.menus`, soporta ventanas overnight + weekday_mask + tz) en `services/menu.py`; `_get_default_menu` reescrito (is_default + fallback); `GET /menu/{qr}` y `POST /orders` (estampa `menu_id`) lo consumen.
  - **2c**: P4 promos — CRUD backend (rol editor) + imagen R2 (`promos/{rid}/{pid}/`) + `PublicMenuResponse.promo` (resuelto con `active_promo_for`, newest-wins); frontend: `PublicPromoBanner` (abre modal del item vinculado), `PromosPage` en `/dashboard/promos`.
  - **2d**: P5 — `days_remaining` server-side, badge "Vence en Nd", aviso in-app (≤3 días, descartable).
  - **Fase 0010 (desvío del plan, pedido del usuario — el descuento NO era parte del P4 original):** migración `0010` — `promos.scope` (`none|item|category|catalog`, default none) + `promos.category_id` + `order_items.discount_pct` (snapshot). El descuento se aplica server-side en `create_order` sobre el precio efectivo (base+modificadores, clamp 0, Decimal quantize HALF_UP a centavos); `unit_price_snapshot` guarda precio de lista, `discount_pct` el % aplicado. Cliente espeja la regla en `src/lib/promoDiscount.ts` (card/modal/carrito/checkout). Form con selector de alcance + select de categoría condicional.
- **Infra extra**: `app/models/__init__.py` como registry de mappers, importado desde `core/database.py` (fix de MissingGreenlet con modelos sin importer). `alembic/env.py` importa `app.models.promo`.

### Verificación al cierre
Backend 317/317 · Frontend 161/161 · `tsc` limpio · Docker: imagen backend reconstruida, migraciones hasta `0010 (head)` aplicadas, backfill `is_default=t` verificado.

### Fase 3 — completada (2026-10-13)
- **3a/3b/3c** (M21): CRUD de menús, endpoints de categorías con `menu_id` explícito (`/restaurants/{id}/menus/{menu_id}/...`), `MenuEditorPage` con tabs por menú y panel de configuración. Decisión: las rutas legacy `/categories` y `_get_default_menu` **se mantienen** como wrappers del menú por defecto (cero ruptura), en lugar de eliminarse. `get_category` ahora valida pertenencia al restaurant, no al menú default.
- **Cleanup** (M22): eliminado el mock demo de Boulette (`App.tsx`, `data.ts`, `types.ts` de raíz, `CartDrawer`, `WhatsAppCheckoutModal`, etc.). `/` redirige a `/dashboard` (con sesión) o `/login`.
- Migraciones nuevas: `0014` (turnos de caja), `0015` (nombre único de menú por restaurant).

### Pendiente — retomar por acá
- Ideas planteadas en sesión (no planificadas): mostrar badge `-X%` por línea en `OrdersPage` (el campo `discount_pct` ya viene en `OrderItemRead`); activar `MENU_SCHEDULING_ENABLED` por ambiente (el CRUD de menús ya existe, falta decidir cuándo); elegir menú destino en el import CSV (hoy solo importa al menú por defecto).
- Bug menor conocido: `AppearancePage` y `RestaurantInfoPage` muestran el formulario con valores por defecto un instante antes de cargar (parpadeo); fix propuesto: iniciar `loading` en `true`.
- Tier 3 sin empezar: pasarela de pagos, i18n, analytics.
- Recordatorios de entorno: el backend corre horneado en la imagen (sin bind mounts) → `docker compose build backend && docker compose up -d backend` + `alembic upgrade head` tras cada cambio de código/migración; superadmins locales: `owner@test.com` / `password123`.

---

## Decisiones de arquitectura

- **P2 menús**: auto-switch server-side por horario del restaurant.
- **P7 WhatsApp**: persistir en DB + abrir `wa.me` desde el cliente con mensaje pre-armado server-side.
- **P3 dominio**: solo modelo de datos (`custom_domain`, `plan`) + slug; sin infra DNS/TLS en esta etapa.
- **P2 refactor**: estrategia C híbrida (flag global + per-restaurant), 2 fases progresivo.
- **P2 timezone**: vive en `Restaurant`, no en `Menu` (un restaurant tiene una sola tz, menús/promos/horarios la heredan).
- **P7 whatsapp**: `whatsapp_url` en `OrderRead`, armado server-side con snapshots del order.
- **Migraciones**: 2 (0008 restaurant extensions + 0009 menu scheduling & promos).
- **P1 fuentes**: solo las 4 del enum actual (Inter/Playfair/Poppins/DM Sans) + imports en `index.css`. Sin migración.
- **P6+P7**: juntos (comparten modelo, dashboard, PublicMenuResponse).
- **P8 iconos**: Opción A (preset de iconos, no imágenes subidas).

---

## Estado actual del código (puntos de partida)

### Estilo / paletas (P1)
- DB-backed: `MenuStyle` con `font_family` (enum 4 valores), `primary_color`, `secondary_color` (hex nullable). 1:1 con restaurant.
- Owner edita con `<input type="color">` libre + `<select>` de 4 fonts en `src/pages/dashboard/AppearancePage.tsx`.
- Se aplica en `PublicMenuPage.tsx` vía CSS vars (`--color-primario`, `--color-secundario`, `--font-heading`) en un wrapper div.
- `src/index.css` **no importa** Poppins/DM Sans/Inter (gap a cerrar).
- `themesConfig`/`fontsConfig` en `App.tsx` son un modelo anterior distinto, **no reutilizar**.

### Menú / horarios (P2)
- `Menu` solo tiene `id, name, restaurant_id`. Sin `type`, `is_default`, horarios.
- `_get_default_menu` (`services/menu.py:17`) usa `scalar_one()` — asume exactamente 1 menú. 6 llamadas en total (services/menu.py + import_csv.py).
- `routers/public_menu.py:65` hardcodea `restaurant.menus[0]`.
- `_collect_items` (orders) ya itera todos los menús — listo para multi-menú.
- No hay router de CRUD de menús.

### Dominio / plan (P3)
- `Restaurant` no tiene `custom_domain` ni `plan`.
- Ya tiene `slug` (único) usable para subdominios.

### Banner promo (P4, P5)
- `PromoBanner.tsx` solo se usa en `App.tsx` (demo), todo hardcodeado. No está en `PublicMenuPage`.
- No hay modelo de promoción en el backend.

### Header / info local (P6)
- `PublicMenuPage.tsx` muestra solo `restaurant.name` + search + cart. Sin address/hours/open-closed.
- `Restaurant` no tiene `address`, `phone`, `hours`, `timezone`, `logo_url`.
- `Header.tsx` (demo) lo tiene hardcodeado + cálculo client-side.

### WhatsApp (P7)
- Checkout público (`PublicCheckoutModal.tsx`) solo persiste vía API. No hay WhatsApp en el flujo real.
- `WhatsAppCheckoutModal.tsx` es demo-only con número hardcodeado en `data.ts:617`.
- `Restaurant` no tiene `whatsapp_phone`.

### Iconos de categoría (P8)
- `MenuFilter.tsx` (demo) usa `iconMap` id→Lucide hardcoded. `PublicMenuPage` chips son texto-only.
- `Category` no tiene campo de icono.

---

## Dependencias compartidas (infra a construir primero)

### 1. Helper de timezone — `services/datetime.py` (P2, P4, P5, P6)
```python
def now_in(restaurant_tz: str | None) -> datetime:
    tz = ZoneInfo(restaurant_tz or settings.DEFAULT_TIMEZONE)
    return datetime.now(tz)
```
Centraliza el riesgo de tz en un solo lugar testeable con `freezegun`. `DEFAULT_TIMEZONE` en `.env`.

### 2. Servicio genérico de imagen R2 — `services/image_upload.py` (P4, P6)
Extraer de `item_image.py` lo reutilizable: `ALLOWED_CONTENT_TYPES`, `MAX_IMAGE_BYTES`, upload-url/confirm/delete genéricos. `item_image.py` queda como wrapper delgado. Lo consumen:
- P4: `promos/{restaurant_id}/{promo_id}/{uuid}.{ext}`
- P6: `logos/{restaurant_id}/{uuid}.{ext}`

### 3. Extensión de `PublicMenuResponse` (P4, P6, P7)
Hoy: `{restaurant, style, categories}`. Una sola edición agrega:
- P6: `restaurant.address`, `restaurant.phone`, `restaurant.logo_url`, `restaurant.hours`, `restaurant.is_open_now`
- P4: `promo: PublicPromoRead | null`

### 4. Modelo `Restaurant` — columnas nuevas (P3, P6, P7)
- P3: `custom_domain`, `plan`
- P6: `address`, `phone`, `logo_url`, `timezone`
- P7: `whatsapp_phone`

`timezone` (P6) también lo usan P2, P4, P5.

---

## Migraciones

### `0008_restaurant_extensions`
- `Restaurant` += `address`, `phone`, `whatsapp_phone`, `logo_url`, `timezone`, `custom_domain`, `plan` (enum free/pro/premium default free).
- Tabla `business_hours` (`id`, `restaurant_id` FK CASCADE, `weekday` 0-6, `open_time`, `close_time`).
- `Category` += `icon` (enum nullable).
- Revertible sin afectar scheduling/promos.

### `0009_menu_scheduling_and_promos`
- `Menu` += `type` (enum), `is_default` (bool default false), `start_time`, `end_time`, `weekday_mask` (nullable).
- Tabla `promos` (`id`, `restaurant_id` FK CASCADE, `title`, `subtitle`, `description`, `discount_pct`, `image_url`, `item_id` FK SET NULL, `is_active`, `starts_at`, `ends_at`, timestamps).
- `Order` += `menu_id` (FK SET NULL, nullable).
- Menú existente queda `is_default=true, start_time=null` (modo back-compat).

---

## Orden de ejecución

### Fase 0 — Prerequisitos (infra compartida)
- **0a** `services/datetime.py` + `DEFAULT_TIMEZONE` en `.env` + `core/config.py`. Tests con `freezegun`.
- **0b** `services/image_upload.py`: extraer lo genérico de `item_image.py`. `item_image.py` queda como wrapper.

### Fase 1 — Migración 0008 + puntos de bajo riesgo
- **1a** Migración `0008_restaurant_extensions`.
- **1b** P1 paletas: `AppearancePage.tsx` → grid de combos curados. `src/lib/themePresets.ts`. Imports en `index.css` (Poppins/DM Sans/Inter). Sin backend.
- **1c** P8 iconos: chips renderizan icono según `category.icon`. Dashboard form para elegir.
- **1d** P6+P7 juntos:
  - Backend: `Restaurant` info CRUD, `BusinessHours` CRUD, `is_open_now` server-side, `whatsapp_phone` validación, `whatsapp_url` en `OrderRead`.
  - `PublicMenuResponse` extendido.
  - Dashboard: página "Información del local" (address, phone, whatsapp, logo upload R2, tz, grilla horarios).
  - Frontend público: header con logo/address/horario/pill Abierto-Cerrado. Checkout: botón "Confirmar por WhatsApp" post-persistencia.

### Fase 2 — Migración 0009 + scheduling + promos
- **2a** Migración `0009_menu_scheduling_and_promos`.
- **2b** P2 menús (fase 1 del refactor):
  - `.env` `MENU_SCHEDULING_ENABLED=false`.
  - `_resolve_active_menu(restaurant, session, now)` con flag: off → menú `is_default=true`; on + menús con `start_time` → filtra por `now` en tz; on + sin `start_time` → fallback `is_default=true`.
  - `routers/public_menu.py:65`: `restaurant.menus[0]` → `await _resolve_active_menu(...)`.
  - `_get_default_menu`: `scalar_one()` → `select(Menu).where(is_default==True).first()` con fallback. 1 línea.
  - Tests con freezegun. Existentes pasan intactos (flag off).
- **2c** P4 banner promo:
  - Modelo `Promo` (CRUD), `PublicMenuResponse.promo`.
  - `PromoBanner.tsx` refactorizado a props. Color fijo amarillo/negro.
  - Dashboard form (texto, imagen R2, % desc, vigencia, item vinculado).
- **2d** P5 notif vencimiento: `promo.ends_at` + `days_remaining` server-side. Badge + toast in-app al cargar dashboard.

### Fase 3 — Refactor core fase 2 (post-estable)
- **3a** Endpoints v2 con `menu_id` explícito (`/restaurants/{id}/menus/{menu_id}/...`) + wrappers legacy que llaman `_get_default_menu`.
- **3b** Frontend `MenuEditorPage` con selector de menú (tabs), pegando a endpoints v2.
- **3c** CRUD de menús (`POST/GET/PATCH/DELETE /restaurants/{id}/menus`). Cleanup wrappers legacy + `_get_default_menu`.

---

## Detalle por punto

### P1 — Paletas de colores predefinidas · 🟢
- **Factibilidad**: directa. Frontend only.
- **Cambios**: `AppearancePage.tsx` (rewrite del form), nuevo `src/lib/themePresets.ts`, `src/index.css` (imports). Sin backend.
- **Riesgo**: bajo. No rompe datos existentes (siguen siendo 2 hex válidos).

### P2 — Menús múltiples con horarios · 🔴
- **Factibilidad**: alta. Toca lógica core.
- **Cambios**: modelo + service + router + migración + frontend editor + tests.
- **Riesgo mitigado**: estrategia C (flag off = back-compat total), refactor progresivo (fase 1 toca 1 punto del router público, fase 3 aísla la migración a `menu_id`).
- **Punto crítico**: `_get_default_menu` con `scalar_one()` — ajuste de 1 línea en fase 1, eliminación en fase 3.

### P3 — Dominio propio + plan · 🟢
- **Factibilidad**: directa. Solo adds columns.
- **Cambios**: migración 0008, `models/restaurant.py`, `schemas/restaurant.py`, `schemas/public_menu.py`, tests.
- **Riesgo**: bajo. `plan` enum deja la puerta a gating de features futuro.

### P4 — Banner promocional configurable · 🟡
- **Factibilidad**: media. Modelo nuevo + R2 + front.
- **Cambios**: migración 0009, modelo `Promo` + schemas + service + router, `PublicMenuResponse.promo`, `PromoBanner.tsx` refactor, dashboard form.
- **Riesgo**: medio. R2 reusado del genérico (fase 0b). Manejo de "promo activa" con `now` y tz (helper de fase 0a).

### P5 — Notificación de vencimiento de promo · 🟡
- **Factibilidad**: media. Depende de P4.
- **Cambios**: `promo.ends_at` + `days_remaining` server-side, badge + toast in-app.
- **Riesgo**: bajo-medio. Cálculo de tz (helper de fase 0a). Sin email/push (in-app only).

### P6 — Header info local · 🟡
- **Factibilidad**: media. Modelo + service + front.
- **Cambios**: migración 0008, `Restaurant` += address/phone/logo_url/tz, tabla `business_hours`, `is_open_now` server-side, `PublicMenuResponse` extendido, dashboard "Información del local", header público.
- **Riesgo**: medio. Cálculo de `is_open_now` con tz (helper de fase 0a). Logo R2 (servicio genérico de fase 0b). Tests con freezegun para bordes (split shifts, DST).

### P7 — WhatsApp + registry · 🟡
- **Factibilidad**: media. Modelo + service + front.
- **Cambios**: `Restaurant.whatsapp_phone` (migración 0008), `OrderRead.whatsapp_url` armado server-side con `urllib.parse.quote`, `PublicCheckoutModal` botón "Confirmar por WhatsApp" post-persistencia.
- **Riesgo**: medio. Validación del número (regex `^\d{6,15}$`). Encoding del mensaje. Registry sin cambios (`OrdersPage` sigue igual).
- **Modelo**: persistir SIEMPRE en DB + abrir `wa.me` desde el cliente. Si `whatsapp_phone` es null, botón no se muestra.

### P8 — Iconos de categoría · 🟢
- **Factibilidad**: directa. Opción A (preset, no imágenes).
- **Cambios**: `Category.icon` (enum nullable, migración 0008), `PublicCategoryRead.icon`, chips en `PublicMenuPage` + dashboard form.
- **Riesgo**: bajo.

---

## Riesgos transversales

- **Timezone**: P2, P4, P5, P6 dependen de `now_in(restaurant_tz)`. Centralizado en `services/datetime.py` (fase 0a). Tests con `freezegun`.
- **R2 factorización**: P4 (promo image), P6 (restaurant logo) reusan `services/image_upload.py` (fase 0b). Extraer antes de tocar P4/P6.
- **`_get_default_menu`**: refactor más invasivo (P2). Fase 1: ajuste 1 línea. Fase 3: eliminación con wrappers legacy. Flag off = back-compat total.
- **Datos existentes**: restaurantes/menús actuales quedan con `is_default=true, start_time=null` → siempre activos. Migración no destructiva.
- **`App.tsx` legacy**: P4-P8 aplican al menú público real, no al demo. Considerar eliminar `App.tsx`/`data.ts`/`WhatsAppCheckoutModal`/`CartDrawer` legacy en cleanup posterior.

## Riesgo final por fase
- **Fase 0**: 🟢 (2 helpers nuevos, sin tocar existente).
- **Fase 1**: 🟢-🟡 (migración aditiva + P1/P8 frontend + P6/P7 que reutilizan patrones existentes).
- **Fase 2**: 🟡 (P2 fase 1 con flag off = back-compat; P4/P5 suma tablas).
- **Fase 3**: 🟡-🔴 (migración de endpoints a `menu_id` — cambio más invasivo pero aislado al final, con wrappers legacy).

## Lo que NO se hace en este plan
- Infra DNS/TLS/proxy para dominios reales (P3 queda en modelo + slug).
- Notificaciones email/push (P5 es in-app only).
- Job periódico de auto-desactivación de promos (implícita vía `now BETWEEN starts_at AND ends_at`).
- Eliminación del demo `App.tsx`/`data.ts`/`WhatsAppCheckoutModal` legacy (cleanup posterior).
