# Shoplivett

Administrador interno de ventas para una tienda de carteras que vende principalmente por **TikTok Live**: clientes, productos, variantes, stock, reservas, pagos (Yape/Plin), envíos agrupados, créditos y reportes.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript estricto
- Tailwind CSS 4 + shadcn/ui (base-nova)
- Prisma 7 + Neon PostgreSQL
- Auth.js v5 (Credentials) con sesión JWT en cookie httpOnly
- React Hook Form + Zod
- TanStack Table (Sprint 3+)
- Vercel Blob (Sprint 4+)
- Sonner, Lucide React

## Requisitos

- Node.js 20+
- pnpm 10+
- Una base de datos PostgreSQL en Neon (o local)

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

   - `DATABASE_URL` y `DIRECT_URL` (Neon)
   - `AUTH_SECRET` (genera con `openssl rand -base64 32`)
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
| `pnpm lint` | ESLint sobre el proyecto. |
| `pnpm db:generate` | Genera el cliente Prisma. |
| `pnpm db:push` | Aplica el schema a la base de datos. |
| `pnpm db:migrate` | Crea/aplica migraciones con historial. |
| `pnpm db:studio` | Abre Prisma Studio. |
| `pnpm db:seed` | Crea los usuarios seed (idempotente). |

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
- **Rechazo** con motivo obligatorio; no afecta saldos ni stock.
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
- ⏳ Sprints 11–15 — ver `docs/PLAN_DESARROLLO_SPRINTS.md`

## Versión

La versión actual se rastrea en `package.json` y en el [CHANGELOG](./CHANGELOG.md).
