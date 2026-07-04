# AGENTS.md — Guía operativa para agentes y humanos

Convenciones, comandos y reglas que se deben respetar al modificar este
repositorio. La Fase 1 (seguridad y arquitectura) y Fase 2 (UI y rendimiento)
introdujeron varios invariantes que cualquier cambio nuevo debe respetar.

## Stack

- Next.js 16.2.9 (App Router) + React 19.2
- TypeScript 5.9 (strict)
- Prisma 7.8 + PostgreSQL (Neon + PrismaPg)
- NextAuth 5.0-beta
- Tailwind CSS 4 + `@base-ui/react`
- Sonner (toasts)
- Vercel Blob para archivos
- Despliegue objetivo: Vercel serverless multi-instancia

## Comandos

```bash
# Instalar deps
pnpm install

# Base de datos
pnpm db:generate    # prisma generate
pnpm db:push        # sincronizar schema sin historial; solo BD local descartable
pnpm db:migrate     # crear/aplicar migración
pnpm db:deploy      # aplicar migraciones versionadas en CI/staging/prod
pnpm db:studio      # GUI
pnpm db:seed        # cargar datos de demo

# Desarrollo
pnpm dev            # next dev

# Verificación
pnpm typecheck      # tsc app + tsc e2e
pnpm lint           # eslint
pnpm verify         # typecheck + lint + build
pnpm build          # next build (producción)
pnpm start          # arranca el build de producción

# Pruebas E2E (Playwright)
pnpm test:e2e:install   # descarga el binario de Chromium
pnpm test:e2e          # corre smoke + 8 flujos obligatorios
```

## Reglas de dinero

- **Todas las operaciones internas usan centavos enteros** (`Cents` en
  `lib/money.ts`). Nunca hacer cuentas en `number` con decimales.
- Conversión de strings/Prisma Decimal a centavos: `toCents(value)`.
- Conversión inversa para mostrar: `centsToDecimalString(cents)`.
- Cada dominio de negocio envuelve `toCents` con un nombre específico
  (`paymentToCents`, `creditToCents`, `shipmentToCents`) para preservar
  tipos de error.
- Validación Zod de montos: `lib/validations.ts` define `DecimalString` con
  hasta 2 decimales.

## Roles y permisos

- `lib/permissions.ts` define roles (`ADMIN`, `SELLER`, `DISPATCH`) y
  helpers de guard (`requireUser`, `requireRole`, `requirePaymentValidator`).
- `lib/authorization.ts` define una capa por permiso (`Permission`).
  Convive con la capa por rol. Para código nuevo, preferir
  `assertPermission("payments.validate")` sobre `requireRole([...])` cuando
  aplique a una sola acción.

## Cache y consistencia

- **`lib/settings.ts`** está cacheado con `unstable_cache` y tag
  `SETTINGS_CACHE_TAG`. No usar `globalThis` ni caché en proceso.
- Invalidación: `invalidateSettingsCache()` desde la server action. Internamente
  usa `updateTag` (read-your-own-writes dentro de acciones) y cae a
  `revalidateTag(..., "max")` si no estamos en acción.
- No cachear datos financieros sensibles (saldos, métricas de negocio).
- `revalidatePath` se sigue usando para refrescar páginas concretas.

## Auditoría

- Toda acción crítica debe llamar a `auditAfter(actorId, { action, entity, entityId, metadata })` desde `lib/audit.ts`.
- `auditAfter` usa `after()` de `next/server` y **no bloquea la respuesta**.
  Pensado para serverless.
- Para eventos que requieren consistencia atómica con la transacción de negocio,
  usar `auditInTx(tx, actorId, event)`.
- Enum de acciones en `AuditAction` (Prisma). Añadir nuevas acciones al enum
  cuando se incorporen features nuevas.
- La tabla `AuditLog` es **inmutable**: no exponer update/delete.

## Formularios y acciones

- Acciones de servidor: `actions/*.ts`. Una acción por endpoint semántico.
- Validación: Zod en la action + tipo de resultado tipado (`XActionResult`).
- Formularios client: `components/forms/*-form.tsx` con `useActionState`.
- Componentes compartidos: `components/ui/submit-button.tsx`,
  `form-message.tsx`, `field-error.tsx`, `cancel-link.tsx`.
- Tablas paginadas: `components/tables/paginated-data-table.tsx`.

## Rutas y errores

- `app/not-found.tsx` y `app/(dashboard)/not-found.tsx` para 404.
- En páginas de detalle, llamar `notFound()` si la entidad no existe;
  nunca devolver `null` silencioso.
- `app/error.tsx` y `app/(dashboard)/error.tsx` como boundaries.

## Prisma

- **Toda query pesada debe usar `select` específico** para no traer columnas
  innecesarias (riesgo de PII y de payload).
- Índices compuestos: en `schema.prisma` ya hay varios
  (`(status, createdAt)`, `(customerId, status, expiresAt)`, etc.). No
  añadir índices nuevos sin antes correr `EXPLAIN ANALYZE` y validar el
  costo de escritura.
- Transacciones para operaciones que afectan múltiples tablas: usar
  `prisma.$transaction(async (tx) => { ... })` con `Serializable` cuando
  haya riesgo de carrera (stock, pagos, lives).
- Cierre de reservas no pagadas (vencimiento, cancelación manual, rechazo de
  pago que deja la reserva sin sustento) debe canalizarse por
  `closeUnpaidReservation(...)` de `lib/order-expiry.ts`. Esto garantiza que
  liberar stock, rechazar pagos pendientes y cambiar el estado del pedido
  se ejecuten de forma atómica y auditable.

## Despliegue y entorno

- Variables esperadas (ver `lib/prisma.ts`):
  - `DATABASE_URL` (Neon + `pgbouncer=true`)
  - `DIRECT_URL` (Neon conexión directa, usada por `prisma migrate`)
  - `AUTH_SECRET`, `AUTH_URL` (Auth.js v5)
  - `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
  - `SEED_ADMIN_PASSWORD`, `SEED_SELLER_PASSWORD`, `SEED_DISPATCH_PASSWORD`
- `proxy.ts` (Next 16) protege todas las rutas del dashboard (incluye
  `/dashboard`, `/clientes`, `/productos`, `/categorias`, `/inventario`,
  `/lives`, `/ventas`, `/pedidos`, `/pagos`, `/envios`, `/reportes`,
  `/auditoria`, `/configuracion`). NO renombrar a `middleware.ts` ni
  duplicarlo.
- **Estrategia Prisma vigente**: el schema se versiona en
  `prisma/migrations`. Bases limpias, CI, staging y producción usan
  `pnpm db:deploy`. Cambios de schema nuevos se crean con `pnpm db:migrate`.
  `pnpm db:push` queda reservado para bases locales descartables; no usarlo
  contra bases compartidas ni productivas.
- **Auth host trust**: `auth.ts` lee `AUTH_TRUST_HOST` desde env. Por
  compatibilidad, cualquier valor distinto de `"false"` se considera
  confiable. En Vercel, dejar el valor por defecto.
- En Vercel multi-instancia, evitar cualquier caché en proceso (`globalThis`).
  Toda caché compartida debe ir por Next cache + tags o por una KV externa.
- Checklist de deploy a Vercel:
  1. Crear proyecto y enlazar repo.
  2. Crear Postgres Neon + `DATABASE_URL` con `pgbouncer=true` + `DIRECT_URL`.
  3. Configurar `AUTH_SECRET` (32 bytes base64) y `AUTH_URL` con la URL canónica.
  4. Crear Vercel Blob y exponer `BLOB_READ_WRITE_TOKEN`.
  5. Asignar `SEED_*_PASSWORD` y correr `pnpm db:deploy && pnpm db:seed`
     en una consola one-shot (Vercel CLI o workflow).
  6. Definir comando build = `pnpm verify` para fallar rápido en CI.

## Pruebas

- La suite oficial es **Playwright** (`@playwright/test`).
- Specs viven en `e2e/`. Hay dos archivos:
  - `e2e/smoke.spec.ts`: smoke E2E (login + alta de cliente).
  - `e2e/flows.spec.ts`: los 8 flujos obligatorios de Sprint 15
    (venta con adelanto, venta pagada, pago a varios pedidos, sobrepago,
    reserva vencida, envío agrupado, rechazo de pago, ajuste de stock).
- Los flujos usan el motor de dominio (`lib/sales`, `lib/payments`,
  `lib/shipments`, `lib/order-expiry`, `lib/inventory`) contra la base
  de datos real, no UI completa, para mantenerlos rápidos y reproducibles.
- Antes de añadir tests unitarios, evaluar la prioridad con el equipo
  (Vitest sería el candidato natural para reglas puras de dominio).

## Cambios recientes

- **Fase 1**: seguridad y arquitectura. Proxy, validaciones, transacciones.
- **Fase 2**: UI compartida (`SubmitButton`, `PaginatedDataTable`), accesibilidad
  y rendimiento de `lib/live.ts` y `lib/dashboard.ts`.
- **Fase 3**: cache distribuible de settings, sistema de auditoría con
  `after()`, índices compuestos, `not-found` pages, capa de permisos
  paralela.
- **Fase 4 (Sprint 15)**: suite Playwright (smoke + 8 flujos), suite de
  componentes UI reutilizable (`ConfirmDialog`, `AsyncSearchList`,
  `EmptyState`), refuerzo de `useTransition`/`useActionState` con
  manejo explícito de `pending` y errores, scripts de verificación
  (`typecheck`, `verify`, `test:e2e`) y guía de deploy a Vercel.
- **Fase 3**: cache distribuible de settings, sistema de auditoría con
  `after()`, índices compuestos, `not-found` pages, capa de permisos
  paralela.
