# Shoplivett

Administrador interno de ventas para una tienda de carteras que vende principalmente por **TikTok Live**: clientes, productos, variantes, stock, reservas, pagos (Yape/Plin), envíos agrupados, créditos y reportes.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript estricto
- Tailwind CSS 4 + `@base-ui/react`
- Prisma 7 + Neon PostgreSQL
- Auth.js v5 (Credentials) con sesión JWT en cookie httpOnly
- React Hook Form + Zod
- TanStack Table (Sprint 3+)
- Vercel Blob (Sprint 4+)
- Sonner, Lucide React
- Playwright (Sprint 15, E2E)

## Requisitos

- Node.js 20+
- pnpm 10+
- Una base de datos PostgreSQL en Neon (o local)
- Una Vercel Blob store (Sprint 4+)

## Configuración local

1. Instala dependencias:

   ```bash
   pnpm install
   ```

2. Copia las variables de entorno y completa los valores:

   ```bash
   cp .env.example .env
   ```

   Variables mínimas a completar:

   - `DATABASE_URL` (Neon con `pgbouncer=true`) y `DIRECT_URL` (Neon directo)
   - `AUTH_SECRET` (genera con `openssl rand -base64 32`)
   - `AUTH_URL` con la URL canónica (en local, `http://localhost:3000`)
   - `BLOB_READ_WRITE_TOKEN` desde Vercel → Storage → Blob
   - `SEED_ADMIN_PASSWORD`, `SEED_SELLER_PASSWORD`, `SEED_DISPATCH_PASSWORD`

3. Aplica el schema y crea los usuarios seed:

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

4. Inicia el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

   Abre [http://localhost:3000](http://localhost:3000); serás redirigido a `/login`.

## Credenciales seed

Por defecto, el seed crea tres usuarios (solo para desarrollo):

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administrador | `admin@shoplivett.local` | `SEED_ADMIN_PASSWORD` |
| Vendedora | `seller@shoplivett.local` | `SEED_SELLER_PASSWORD` |
| Despacho | `dispatch@shoplivett.local` | `SEED_DISPATCH_PASSWORD` |

> ⚠️ No uses estas credenciales en producción. En `NODE_ENV=production` el panel "Usuarios de desarrollo" no se muestra en `/login`.

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo (Turbopack). |
| `pnpm build` | Build de producción. |
| `pnpm start` | Inicia el build de producción. |
| `pnpm typecheck` | TypeScript sobre `app` y `e2e`. |
| `pnpm lint` | ESLint sobre el proyecto. |
| `pnpm verify` | `typecheck` + `lint` + `build`. |
| `pnpm test:e2e:install` | Descarga Chromium para Playwright. |
| `pnpm test:e2e` | Ejecuta la suite Playwright (smoke + 8 flujos Sprint 15). |
| `pnpm db:generate` | Genera el cliente Prisma. |
| `pnpm db:push` | Aplica el schema a la base de datos. |
| `pnpm db:migrate` | Crea/aplica migraciones con historial. |
| `pnpm db:studio` | Abre Prisma Studio. |
| `pnpm db:seed` | Crea los usuarios seed (idempotente). |

## Deploy en Vercel

1. Crea un proyecto nuevo en Vercel y enlázalo a este repositorio.
2. Crea la base de datos en [Neon](https://neon.tech) y copia dos cadenas:
   - `DATABASE_URL` con `?sslmode=require&pgbouncer=true&connect_timeout=10` (cadena pooled, la que usa el runtime).
   - `DIRECT_URL` sin pooler (cadena directa, la que usa `prisma migrate`).
3. Configura las variables de entorno en Vercel (Project Settings → Environment Variables):
   - `DATABASE_URL`, `DIRECT_URL`
   - `AUTH_SECRET` (32 bytes base64) y `AUTH_URL` con la URL canónica (ej. `https://shoplivett.vercel.app`).
   - `BLOB_READ_WRITE_TOKEN` desde Vercel → Storage → Create Database → Blob.
   - `SEED_ADMIN_PASSWORD`, `SEED_SELLER_PASSWORD`, `SEED_DISPATCH_PASSWORD` (sólo se usan en el seed inicial).
4. Crea el store de Vercel Blob (mismo Storage → Create Database) y copia su `BLOB_READ_WRITE_TOKEN`.
5. Define el comando de build en Vercel como `pnpm verify` para que typecheck y lint fallen rápido en CI.
6. Tras el primer deploy, ejecuta `pnpm db:push && pnpm db:seed` desde la consola one-shot de Vercel CLI (o un workflow puntual) para crear las tablas y los usuarios iniciales.

> La aplicación está pensada para correr en multi-instancia serverless. Toda la caché compartida se apoya en la cache de Next.js con tags (`lib/settings.ts`); no uses `globalThis`.

## Pruebas E2E

La suite oficial es Playwright y vive en `e2e/`. Hay cuatro specs:

- `e2e/smoke.spec.ts`: smoke E2E (login + alta de cliente).
- `e2e/flows.spec.ts`: los 8 flujos obligatorios de Sprint 15 (venta con adelanto, venta pagada, pago a varios pedidos, sobrepago, reserva vencida, envío agrupado, rechazo de pago, ajuste de stock) ejecutados contra el motor de dominio y la base de datos real.
- `e2e/concurrency.spec.ts`: escenarios de concurrencia obligatoria de la Fase 3A (doble validación, edición+rechazo paralelo, cancelación atómica de envío, transición de estado única).
- `e2e/ui-flows.spec.ts`: flujos de UI real de Fase 4 (validación de pago y cancelación de envío con motivo desde la página).

### Prerrequisitos

- Base de datos **aislada** distinta a la de desarrollo. Se recomienda:
  - copiar `.env.e2e.example` a `.env.e2e`
  - apuntar `E2E_DATABASE_URL` y `E2E_DIRECT_URL` a una base dedicada
- Node 20+ y pnpm 10+ (declarados en `engines` y `packageManager`).

### Comandos

```bash
pnpm test:e2e:install                                # una sola vez
pnpm db:push && pnpm db:seed                        # sobre la base E2E
pnpm test:e2e                                       # build + start, contra .env local
pnpm test:e2e:env                                   # usa .env.e2e (recomendado)
pnpm test:e2e:dev                                   # levanta next dev en lugar de build+start
```

`E2E_BASE_URL` permite apuntar a un servidor ya levantado. En CI (`.github/workflows/ci.yml`) el flujo es `pnpm db:push && pnpm db:seed && pnpm test:e2e` con Playwright levantando el build.

## Estructura

```
app/
  (auth)/login/        Página de inicio de sesión
  (dashboard)/         Rutas protegidas (layout valida sesión)
    dashboard/         Panel principal con resumen por rol
    clientes/          Listado, alta, edición y detalle de clientas
    configuracion/     Ajustes de negocio (solo ADMIN)
  api/auth/[...nextauth]/  Handler de Auth.js
auth.ts                Configuración de Auth.js v5
proxy.ts               Middleware (Next 16) de protección de rutas
actions/               Server actions (auth, settings, customers, etc.)
components/            UI, layout, forms, tables, dashboard
lib/                   auth, prisma, validations, permissions, settings, phone, customer-helpers, blob, utils
prisma/                schema.prisma y seed
types/                 Enums compartidos del dominio
docs/                  Plan de sprints, requisitos funcionales y no funcionales, flujos
CHANGELOG.md           Historial de versiones
```

## Módulos

### Autenticación (Sprint 1)

Sistema de login con sesión JWT en cookie httpOnly, roles y protección de rutas:

- **Login** en `/login` con email y contraseña, validación por campo y redirección automática (`?from=...`).
- **Roles**: ADMIN, SELLER, DISPATCH. Cada rol accede a diferentes módulos del sidebar.
- **Middleware** (`proxy.ts`) protege todas las rutas del dashboard; usuarios no autenticados son redirigidos a login.
- **Permisos**: helpers `requireUser()`, `requireRole()`, `canValidatePayments()`, `canManageConfiguration()`, `canManageShipments()`.
- **Hash de contraseñas** con bcryptjs.
- **Panel de desarrollo** en `/login` con credenciales seed (oculto en producción).
- **Server actions**: `loginAction` y `logoutAction`.

### Configuración del negocio (Sprint 2)

Modelo singleton `BusinessSettings` con ajustes centralizados del negocio:

- **Página** `/configuracion` accesible solo por ADMIN.
- **Formulario** dividido en 4 secciones: reservas, moneda y catálogo, envíos, pagos.
- **Campos**: días de reserva (1–60), adelanto mínimo, moneda (3 letras), prefijo de código, envío gratis + umbral, métodos de pago y envío habilitados, roles que validan pagos, crédito por sobrepago y devolución.
- **Validación** integral con Zod en server action `updateSettingsAction`.
- **Caché en memoria** (`lib/settings.ts`) con invalidación automática tras guardar.
- **Helpers**: `getReservationDays()`, `getEnabledPaymentMethods()`, `getPaymentValidatorRoles()`, `isPaymentValidator()`, `getFreeShippingRule()`, etc.
- **Labels legibles** para métodos de pago (Yape, Plin, Efectivo, Otro) y envío (Delivery propio, Olva, Shalom, Motorizado, Recojo en tienda).

### Clientes (Sprint 3)

CRUD completo de clientas con:

- Búsqueda por nombre o WhatsApp (insensible a acentos y mayúsculas).
- Normalización automática del WhatsApp al formato E.164 peruano (`+519XXXXXXXXX`).
- Estado configurable: Activa, Frecuente, Riesgosa, Bloqueada.
- Soft delete (`isActive`) en lugar de eliminación física.
- Detalle con tarjetas de deuda acumulada y crédito disponible (se llenarán con datos reales en los Sprints 7 y 9).
- Listado paginado (20 por página) con TanStack Table.

Páginas:

- `/clientes` — Listado y búsqueda.
- `/clientes/nuevo` — Alta de clienta.
- `/clientes/[id]` — Detalle, cambio de estado y dar de baja.
- `/clientes/[id]/editar` — Edición de datos.

### Productos y categorías (Sprint 4)

- **Categorías** con slug autogenerado, activar/desactivar y conteo de productos.
- **Productos** con nombre, descripción, categoría, activar/desactivar.
- **Variantes** con código autogenerado formato `PREFIX-CAT-COLOR-NNNN` (ej. `CART-MANO-NEG-0001`), color, material, tamaño, precio, costo, stock inicial, código de barras opcional.
- **Imágenes** subidas a Vercel Blob (PNG, JPEG, WebP; máx 5 MB) con imagen principal automática.
- **Detalle de producto** con tabs: Información, Variantes, Imágenes.
- Crear variante registra un movimiento `IN` en `InventoryMovement` (preparado para Sprint 5).
- Estado de variante: Activa, Oculta, Archivada.

Páginas:

- `/categorias`, `/categorias/nueva`, `/categorias/[id]/editar`
- `/productos`, `/productos/nuevo`, `/productos/[id]`, `/productos/[id]/editar`
- `/productos/[id]/variantes/nueva`, `/productos/[id]/variantes/[variantId]/editar`

### Inventario (Sprint 5)

- Resumen por variante: **Stock**, **Reservado**, **Vendido**, **Disponible**.
- Ajuste manual con motivo obligatorio (ingreso o ajuste +/-).
- Historial completo de movimientos por variante.
- Operaciones internas (`reserveStock`, `releaseStock`, `confirmSaleStock`, `cancelStock`) disponibles para los Sprints 7–9 con aislamiento **Serializable** para evitar condiciones de carrera.

Páginas:

- `/inventario` — Listado paginado de variantes con métricas.
- `/inventario/[variantId]` — Detalle con cards de stock, historial y form de ajuste.

### Lives (Sprint 6)

- Gestión de sesiones de live con estados **Abierto**, **Cerrado** y **Cancelado**.
- Regla del MVP: solo puede existir **un live abierto a la vez**.
- Asignación opcional de responsable (`ADMIN` o `SELLER`).
- Detalle del live con métricas preparadas para Sprint 7/8: pedidos, vendido, cobrado y pendiente.
- Helpers reutilizables para Sprints 7 y 8: `getOpenLive`, `assertLiveIsOpen`.

Páginas:

- `/lives` — Listado, búsqueda y filtro por estado.
- `/lives/nuevo` — Crear live.
- `/lives/[id]` — Detalle con acciones de cerrar/cancelar.
- `/lives/[id]/editar` — Editar live abierto.

### Pedidos y venta rápida (Sprint 7)

- **Venta rápida** con búsqueda asíncrona de clienta y variantes, carrito, cálculo de totales y adelanto.
- Pedidos con número autogenerado (`ORD-YYYYMMDD-NNNN`), estado, items, pagos y capturas.
- Reglas de adelanto configurables desde `BusinessSettings`.
- Transacción atómica: crear pedido, items, pago pendiente y reserva de stock en un solo paso.
- Detalle de pedido con resumen financiero, items, pagos y capturas.

Páginas:

- `/ventas` — Pantalla de venta rápida (detecta live activo automáticamente).
- `/pedidos` — Listado con búsqueda, filtro por estado y paginación.
- `/pedidos/[id]` — Detalle completo del pedido.

### Pagos y capturas (Sprint 8)

- **Pagos manuales** con múltiples capturas (Vercel Blob), método configurable desde
  `BusinessSettings` (Yape, Plin, Efectivo, Otro) y número de operación opcional.
- **Aplicación a uno o varios pedidos** de la misma clienta vía `PaymentApplication`.
- **Validación transaccional** (`Serializable`): al validar se recalculan `validatedPaid`,
  `balance` y `Order.status` (`RESERVED` / `PARTIALLY_PAID` / `PAID`), y el stock reservado
  se mueve a vendido cuando el pedido queda `PAID`.
- **Rechazo** con motivo obligatorio. Si el pedido asociado no tiene pagos validados ni otros pagos pendientes que lo sostengan, se cancela la reserva, se libera el stock reservado y se rechazan los pagos pendientes del pedido (transaccional, dentro de la misma `Serializable` que el rechazo). En cualquier otro caso, no se liberan saldos ni stock.
- Permisos de validación leídos desde `BusinessSettings.paymentValidatorRoles`.

Páginas:

- `/pagos` — Listado con búsqueda y filtros por estado.
- `/pagos/nuevo` — Alta manual con buscador de clienta y pedidos.
- `/pagos/[id]` — Detalle con aplicaciones, capturas, auditoría y acciones de validar / rechazar (con elección de tratamiento del excedente).

### Créditos y reservas vencidas (Sprint 9)

- **Créditos por sobrepago** generados al validar un pago cuyo monto supera los saldos aplicados. Se crean con estado `AVAILABLE` y se descuentan al aplicarlos.
- **Créditos manuales** para registrar ajustes administrativos desde la ficha de la clienta.
- **Devoluciones** registradas como `CustomerCredit` con `status = REFUNDED` y motivo obligatorio.
- **Aplicación manual** de crédito a un pedido de la misma clienta, con recálculo de saldos y movimiento de stock si el pedido queda `PAID`.
- **Reservas vencidas** listadas en `/pedidos/vencidos`; cancelación transaccional que libera stock (`InventoryMovement` `EXPIRE`), rechaza pagos pendientes y deja el pedido en `EXPIRED` con saldo `0`.
- Permisos de devolución y sobrepago gobernados por `BusinessSettings.allowOverpaymentCredit` y `allowRefund`.
- Aplicación nunca automática: cada movimiento de crédito se ejecuta desde una acción del usuario.

Páginas:

- `/pedidos/vencidos` — Panel con cancelación de reservas.
- `/clientes/[id]` — Historial de créditos con aplicaciones y motivos de devolución.

### Envíos agrupados (Sprint 10)

- **Envíos** que agrupan uno o varios pedidos pagados de la misma clienta.
- Reglas de integridad:
  - todos los pedidos deben pertenecer a la misma clienta
  - todos los pedidos deben estar en `PAID`
  - un pedido sólo puede estar en un envío activo a la vez
- Cálculo de **envío gratis** automático al crear:
  - se evalúa contra `BusinessSettings.freeShippingEnabled` y `freeShippingThreshold`
  - se persiste la regla aplicada en `Shipment.freeShippingRule`
  - permite override manual con `forceFreeShipping`
- Estados con flujo estricto:
  - `PENDING` → `PREPARING` → `READY` → `SHIPPED` → `DELIVERED`
  - `CANCELLED` permitido hasta antes de `DELIVERED`
- Tracking y agencia persistidos; snapshots de dirección/distrito/referencia tomados de la clienta al crear.
- Botón "Crear envío con este pedido" desde el detalle de pedido pagado (sólo `ADMIN`/`DISPATCH`).
- Detalle de envío con timeline de cambios de estado.
- Detalle de cliente muestra el historial de envíos con pedidos incluidos.

Páginas:

- `/envios` — Listado con búsqueda y filtros por estado.
- `/envios/nuevo` — Alta con buscador de clienta y pedidos elegibles.
- `/envios/[id]` — Detalle, pedidos incluidos, snapshots, tracking y acciones de estado.

### Dashboard operativo (Sprint 11)

- Vista `/dashboard` con datos reales y diferenciación por rol.
- Métricas principales:
  - **ADMIN**: ventas del día, pagos validados del día, pagos pendientes, reservas vencidas, reservas por vencer, deuda acumulada, créditos disponibles, pedidos listos para despacho.
  - **SELLER**: ventas del día, pagos pendientes, reservas por vencer/vencidas, deuda, créditos, pedidos del día, pagos validados del día.
  - **DISPATCH**: pedidos listos para despacho, envíos en proceso, pagos validados del día, reservas vencidas, accesos rápidos a envíos por estado.
- Definición funcional:
  - `Ventas del día` = suma de pedidos **creados** hoy.
  - `Pagos validados del día` = suma de pagos **validados** hoy.
- Cards enlazan a vistas filtradas existentes (`/pagos?status=PENDING`, `/pedidos?status=...`, `/envios?status=...`).
- Listas rápidas (top 5) para pagos pendientes, reservas por vencer, pedidos listos para envío y envíos en proceso, con badge de estado y link al detalle.
- Carga eficiente con `Promise.all` server-side, sólo agregados y listas cortas.

### Mensajes para WhatsApp (Sprint 12)

- Capa reusable en `lib/whatsapp.ts` con:
  - `buildWhatsappLink(phone, text)` que normaliza el número a E.164 antes de armar el enlace `wa.me`.
  - `buildWhatsappMessage(input)` con 8 plantillas tipadas para los casos del MVP.
  - Sanitización de variables opcionales (no quedan huecos en el mensaje).
- `components/whatsapp/whatsapp-actions.tsx` con dos componentes:
  - `WhatsAppActions`: selector de plantilla, vista previa y botones **Abrir WhatsApp** / **Copiar mensaje** (con feedback vía Sonner).
  - `WhatsAppQuickButton`: botón compacto para abrir el chat directo desde una fila o quick list.
- Integraciones:
  - Detalle de pedido, pago, envío, reservas vencidas y cliente con panel de plantillas contextual.
  - Botón rápido en cada fila de clientes, pedidos, pagos y envíos.
  - Botón rápido en quick lists del dashboard (pagos pendientes, reservas por vencer, pedidos listos, envíos en proceso).
- Cumplimiento de RNF del Sprint 12:
  - `RNF-S12-01` plantillas constantes listas para una futura edición desde configuración.
  - `RNF-S12-02` sólo copia o abre WhatsApp Web; no envía mensajes.
  - `RNF-S12-03` variables vacías se sustituyen sin romper el mensaje.
  - `RNF-S12-04` números se normalizan a formato `wa.me` compatible.

### Reportes (Sprint 13)

- Vista `/reportes` (sólo `ADMIN`) con shell de secciones: Resumen, Pagos, Saldos pendientes, Créditos, Ventas por live, Stock actual, Productos más vendidos.
- Capa dedicada `lib/reports.ts` con agregadores server-side y operaciones en centavos:
  - `getReportSummary` resume ventas (pedidos creados), cobros validados, deuda activa, créditos disponibles y reservas vencidas.
  - `getPaymentsReport` con desglose por método/estado, búsqueda y filtro de fecha.
  - `getPendingBalancesReport` con top 10 clientas con mayor deuda.
  - `getCreditsReport` con desglose por estado y origen.
  - `getLivesReport` con pedidos, cobrado y pendiente por live.
  - `getStockReport` con totales de stock/reservado/vendido/disponible por variante.
  - `getTopProductsReport` por periodo (vía `OrderItem` + `groupBy`) o acumulado histórico (`soldStock`).
- Cumple RNF del Sprint 13:
  - `RNF-S13-01` "cobros validados" sólo cuenta pagos `VALIDATED` con `validatedAt` en el rango.
  - `RNF-S13-02` todas las consultas usan índices existentes y `select` mínimos.
  - `RNF-S13-03` los datos se devuelven como objetos tabulares; queda lista una futura exportación a Excel.
  - `RNF-S13-04` se diferencia explícitamente "vendido" (pedidos), "cobrado" (pagos validados) y "pendiente" (saldos).

### Auditoría y seguridad operativa (Sprint 14)

- Vista `/auditoria` (sólo `ADMIN`) con listado paginado, filtros por rango de fecha, acción, entidad, actor y búsqueda libre.
- Capa dedicada `lib/audit-report.ts` con `listAuditLog` (server-side, `select` mínimos) y `listAuditActors` para los filtros.
- Capa `actions/audit-report.ts` con `requireRole("ADMIN")` que delega en `lib/audit-report.ts`.
- Cubrimiento de acciones críticas:
  - `PAYMENT_VALIDATED` y `PAYMENT_REJECTED` dentro de la transacción de `lib/payments.ts` con `auditInTx` (atomicidad con el cambio financiero).
  - `ORDER_CREATED` dentro de la transacción de `lib/sales.ts` con `auditInTx`.
  - `SHIPMENT_CREATED`, `SHIPMENT_STATUS_CHANGED`, `SHIPMENT_CANCELLED` dentro de la transacción de `lib/shipments.ts` con `auditInTx`.
  - `PRODUCT_PRICE_CHANGED` y `CUSTOMER_DEACTIVATED` con `auditAfter` desde `actions/products.ts` y `actions/customers.ts`.
  - `CREDIT_CREATED`, `CREDIT_APPLIED`, `CREDIT_REFUNDED`, `INVENTORY_ADJUSTED`, `RESERVATION_EXPIRED`, `SETTINGS_UPDATED`, `PAYMENT_APPLICATIONS_UPDATED` ya estaban cubiertas en sprints previos.
- Endurecimiento de permisos en actions de dominio:
  - `actions/customers.ts`, `actions/products.ts`, `actions/categories.ts` sustituyen `requireUser` por `requireRole(["ADMIN", "SELLER"])` (soft delete de clienta queda restringido a `ADMIN`).
  - Pages internas críticas ahora validan rol en server component: clientes, productos, categorías, ventas, inventario detalle.
- Cumple RNF del Sprint 14:
  - `RNF-S14-01` la UI de auditoría es sólo lectura: no existe ninguna ruta de update/delete sobre `AuditLog`.
  - `RNF-S14-02` cada evento incluye `actorId`, `action`, `entity`, `entityId`, `metadata` y `createdAt`.
  - `RNF-S14-03` el módulo `/auditoria` y sus actions sólo son accesibles para `ADMIN`; el sidebar lo oculta para otros roles.
  - `RNF-S14-04` las operaciones críticas (pagos, pedidos, envíos) registran la auditoría dentro de la misma transacción de Prisma, evitando inconsistencias entre el cambio de negocio y el log.

## Estado de sprints

- ✅ Sprint 0 — Base técnica
- ✅ Sprint 1 — Autenticación, usuarios y roles
- ✅ Sprint 2 — Configuración del negocio
- ✅ Sprint 3 — Clientes
- ✅ Sprint 4 — Categorías, productos y variantes
- ✅ Sprint 5 — Inventario por variante
- ✅ Sprint 6 — Sesiones de Live
- ✅ Sprint 7 — Pedidos, reservas y venta rápida
- ✅ Sprint 8 — Pagos, capturas y aplicación a pedidos
- ✅ Sprint 9 — Créditos, sobrepagos y reservas vencidas
- ✅ Sprint 10 — Envíos agrupados
- ✅ Sprint 11 — Dashboard operativo
- ✅ Sprint 12 — Mensajes para WhatsApp
- ✅ Sprint 13 — Reportes
- ✅ Sprint 14 — Auditoría y seguridad operativa
- ✅ Sprint 15 — Pulido, pruebas y despliegue

### Sprint 15 — Pulido, pruebas y despliegue

Capa de cierre del proyecto. Entregables:

- Componentes UI reutilizables: `ConfirmDialog` (AlertDialog) para acciones críticas, `AsyncSearchList` con loading + empty state + error local, `EmptyState` con CTA opcional.
- Confirmaciones explícitas en acciones destructivas: baja de clienta, cerrar/cancelar live, activar/desactivar producto, borrado de imagen, validar pago, rechazar pago, cancelación de reserva/envío, transición a `DELIVERED`.
- Búsquedas async con feedback de loading y mensajes de "sin resultados" en `quick-sale`, `create-payment`, `create-shipment`.
- Manejo explícito de `pending`/`error` en server actions con `useActionState` y `useTransition`, sin efectos que seteen estado directamente.
- Suite de pruebas E2E con **Playwright** (`@playwright/test`):
  - `e2e/smoke.spec.ts` (login + alta de cliente).
  - `e2e/flows.spec.ts` con los 8 flujos obligatorios del plan, ejecutados contra el motor de dominio (`lib/sales`, `lib/payments`, `lib/shipments`, `lib/order-expiry`, `lib/inventory`) y la base de datos real.
- Scripts de verificación: `pnpm typecheck` (app + e2e), `pnpm lint`, `pnpm verify` (typecheck + lint + build), `pnpm test:e2e`.
- Documentación de deploy a Vercel en `README.md` (variables, comandos, checklist) y `AGENTS.md` (reglas para multi-instancia).
- `playwright.config.ts` con `webServer` que aplica el schema y el seed antes de correr.

## Versión

La versión actual se rastrea en `package.json` y en el [CHANGELOG](./CHANGELOG.md).
