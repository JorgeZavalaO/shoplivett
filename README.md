# Shoplivett

Administrador interno de ventas para una tienda de carteras que vende principalmente por **TikTok Live**: clientes, productos, variantes, stock, reservas, pagos (Yape/Plin), envíos agrupados, créditos y reportes. La siguiente fase documentada extiende el sistema hacia finanzas por lotes de importación, costo real, gastos, incidencias y rentabilidad.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript estricto
- Tailwind CSS 4 + `@base-ui/react`
- Prisma 7 + Neon PostgreSQL
- Auth.js v5 (Credentials) con sesión JWT en cookie httpOnly
- Server Actions + Zod + `useActionState`
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

3. Aplica las migraciones y crea los usuarios seed:

   ```bash
   pnpm db:deploy
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
| `pnpm test:domain` | Ejecuta la batería agrupada de tests de dominio (`scripts/run-domain-tests.ts`). |
| `pnpm test:e2e:install` | Descarga Chromium para Playwright. |
| `pnpm test:e2e` | Ejecuta la suite Playwright completa. |
| `pnpm db:generate` | Genera el cliente Prisma. |
| `pnpm db:push` | Sincroniza schema sin historial; solo para bases locales descartables. No usar en CI, staging ni producción. |
| `pnpm db:migrate` | Crea/aplica migraciones con historial. |
| `pnpm db:deploy` | Aplica migraciones versionadas en CI, staging y producción. |
| `pnpm db:studio` | Abre Prisma Studio. |
| `pnpm db:seed` | Crea los usuarios seed (idempotente). |

## Roadmap financiero por lotes

La evolución financiera está documentada en [`docs/PLAN_FINANCIERO_LOTES_SPRINTS.md`](./docs/PLAN_FINANCIERO_LOTES_SPRINTS.md). Ese documento es la fuente operativa para trabajar en múltiples sesiones sobre los próximos sprints.

Decisiones funcionales cerradas para esta fase:

- La utilidad mensual se reconoce cuando el pedido queda en estado `PAID`.
- La salida de stock por lote será FIFO automática.
- La publicidad se registrará como gasto operativo mensual.
- `Order` y `OrderItem` seguirán siendo la fuente de verdad de ventas; no se creará una tabla `Sale` paralela.
- `BusinessSettings` se extenderá para reglas financieras; no se reemplazará por una tabla key-value.

Regla de continuidad: al cerrar cada sprint financiero se debe actualizar el plan en `docs/`, este `README.md`, `CHANGELOG.md` y la versión en `package.json`.

### Auditoría técnica — correcciones 0.30.0

La versión 0.30.0 inicia la corrección de hallazgos P0/P1 de `docs/auditoria/`:

- `AUD-DATA-001`: utilidad de pedidos pagados incluye el pago actual antes de congelar `paymentFeePen` y `netProfitPen`.
- `AUD-PROD-001`: CI E2E usa la misma base PostgreSQL creada por GitHub Actions y el workflow fue validado en GitHub Actions.
- `AUD-SEC-002`: login con rate limiting persistido en PostgreSQL por hash de email+IP, compatible con Vercel multi-instancia.
- `AUD-DATA-014`: validación de pagos bloquea aplicaciones contra pedidos `CANCELLED` o `EXPIRED`.
- `AUD-DATA-013`: cierre de reservas gestiona pagos pendientes vinculados por `PaymentApplication`.

Scripts de regresión agregados:

- `pnpm exec tsx scripts/_with-env.ts scripts/test-auth-rate-limit.ts`
- `pnpm exec tsx scripts/_with-env.ts scripts/test-payment-reservation-closure.ts`

### Auditoría técnica — correcciones 0.31.0

La versión 0.31.0 cierra el bloque de incidencias P0:

- `AUD-DATA-002`: cancelar incidencias revierte efectos transaccionales. `RESTOCK` revierte `soldStock`, `DAMAGE/LOSS` de inventario propio devuelve stock, y créditos de incidencia sin uso quedan anulados.
- `AUD-DATA-003`: `RETURN + RESTOCK` aumenta la disponibilidad exactamente por las unidades devueltas; no incrementa simultáneamente `stock` y decrementa `soldStock`.
- Regla funcional: una incidencia con crédito ya aplicado no puede cancelarse; se bloquea con `CREDIT_ALREADY_USED`.

Regresión actualizada:

- `pnpm exec tsx scripts/_with-env.ts scripts/test-incidents.ts`

### Auditoría técnica — correcciones 0.32.0

La versión 0.32.0 cierra `AUD-SEC-001` definiendo una ventana de sesión corta para JWT:

- `AUTH_SESSION_MAX_AGE_SECONDS = 15 * 60` en `auth.ts`.
- `session.maxAge` y `jwt.maxAge` usan la misma ventana de 15 minutos.
- Usuarios desactivados o degradados conservan acceso como máximo hasta la expiración de esa ventana, sin agregar campos de versionado al schema.

### Auditoría técnica — correcciones 0.33.0

La versión 0.33.0 cierra `AUD-SEC-005`, `AUD-UX-002` y `AUD-UX-003` alineando despacho con permisos reales:

- `DISPATCH` no tiene lectura general declarada de clientes o pedidos en `lib/authorization.ts`.
- El dashboard de despacho ya no enlaza a módulos no autorizados; los pedidos listos abren `/envios/nuevo?orderId=...`.
- `/envios/nuevo` usa un loader de envíos permitido para `ADMIN`/`DISPATCH` y precarga solo pedidos pagados elegibles.

### Auditoría técnica — correcciones 0.34.0

La versión 0.34.0 cierra `AUD-SEC-003` y `AUD-SEC-008`:

- Los recibos de pago nuevos se suben a Blob como privados y se sirven por `/api/payment-receipts/[id]` con sesión `ADMIN`/`SELLER`.
- Las pantallas de pagos y pedidos ya no renderizan `PaymentReceipt.url` directo.
- `next.config.ts` agrega CSP y headers defensivos globales compatibles con Next/Auth y Vercel Blob.

### Auditoría técnica — correcciones 0.35.0

La versión 0.35.0 cierra `AUD-DATA-005` y `AUD-DATA-006` reforzando invariantes de inventario:

- `adjustStock()` impide que el stock total quede por debajo de `reservedStock + soldStock` y usa aislamiento `Serializable`.
- `DAMAGE`/`LOSS` de inventario propio validan disponible real antes de descontar stock.
- Regresión: `pnpm exec tsx scripts/_with-env.ts scripts/test-incidents.ts` con 16/16 tests.

### Auditoría técnica — correcciones 0.36.0

La versión 0.36.0 cierra `AUD-DATA-007` prorrateando descuento y envío en los snapshots de venta:

- `persistQuickSaleLine()` persiste `lineDiscountPen` y `netLineRevenuePen` reales en `OrderItem` usando `distributeOrderDiscount` (`largest remainder`).
- `lib/sales.ts` calcula el reparto del descuento/envío del pedido antes de persistir cada línea, alineando la utilidad bruta/neta con `Order.total`.
- Regresión: `pnpm exec tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` con 11/11 tests.

### Auditoría técnica — correcciones 0.37.0

La versión 0.37.0 cierra `AUD-DATA-004` sincronizando `ProductVariant.stock` con la suma de `ImportBatchItem.quantityAvailable` (opción B + reconciliación):

- `lib/stock-sync.ts` centraliza `applyBatchStockDelta()` y `assertVariantStockInvariant()`.
- `actions/import-batches.ts` (create/add/remove) y `lib/order-batch-allocation.ts` (allocate/release) sincronizan el delta en la misma transacción.
- `lib/financial-reports.ts` y vistas de baja rotación estandarizan la fórmula `available = stock - reservedStock - soldStock`.
- `scripts/reconcile-variant-stock.ts [--apply]` reporta y corrige drift residual.
- Regresiones: `test-order-batch-fifo.ts` 12/12, `test-incidents.ts` 16/16, reconciliación detecta drift en datos seed.

### Auditoría técnica — correcciones 0.38.0

La versión 0.38.0 cierra `AUD-DATA-008`, `AUD-SEC-004` y `AUD-UX-004`:

- `ShipmentOrder.orderId` ya no es `@unique`; `Order.shipmentOrders[]` reemplaza `Order.shipmentOrder?`, preservando historial de envíos cancelados y permitiendo reenvío (`AUD-DATA-008`). La regla de un solo envío activo se mantiene transaccionalmente (`Serializable`).
- `/lives/nuevo` y `/lives/[id]/editar` agregan `requireRole(["ADMIN", "SELLER"])` antes de consultar datos (`AUD-SEC-004`).
- El formulario de ajuste de inventario solo se muestra para `ADMIN` (`AUD-UX-004`).
- Regresión: `pnpm exec dotenv -e .env -- playwright test e2e/flows.spec.ts -g "AUD-DATA-008"` → 1 passed.

### Auditoría técnica — correcciones 0.39.0

La versión 0.39.0 cierra `AUD-SEC-006`, `AUD-SEC-007`, `AUD-SEC-009`, `AUD-DATA-009` y `AUD-FUNC-006`:

- **CSV injection** (`AUD-SEC-006`): `lib/csv-export.ts` neutraliza celdas con prefijo de fórmula (`=`, `+`, `-`, `@`) anteponiendo `'` antes del escape RFC 4180. Regresión en `scripts/test-financial-reports.ts`.
- **Upload hardening** (`AUD-SEC-007`): `lib/blob.ts` valida firmas de archivo (magic bytes PNG/JPEG/WebP), limita archivos por acción a 5 y bytes totales a 15 MB. `actions/payments.ts` y `actions/sales.ts` validan el lote con `validateImageBatch` antes de subir. Regresión en `scripts/test-upload-validation.ts`.
- **Secret scanning** (`AUD-SEC-009`): `.github/workflows/secret-scan.yml` ejecuta Gitleaks en CI. Se confirma que `.env` nunca se compartió y no hay exposición.
- **Costeo 4 decimales exacto** (`AUD-DATA-009`): `lib/money.ts` agrega `toTenThousandths` y `tenThousandthsToCents` para preservar 4dp en `landedUnitCostPen` sin truncar. `lib/order-batch-allocation.ts` usa estos helpers en `allocateOrderItemBatches`. Regresión en `scripts/test-order-batch-fifo.ts`.
- **Costeo manual bloqueado** (`AUD-FUNC-006`): `lib/import-batch-costing.ts` falla con `CostingError("MANUAL_NOT_SUPPORTED")`. `lib/validations.ts` rechaza `MANUAL` en settings y `components/forms/settings-form.tsx` lo filtra del selector con advertencia UX.

### Auditoría técnica — correcciones 0.39.1

La versión 0.39.1 cierra `AUD-PERF-001`, `AUD-PERF-003` y `AUD-PERF-005` optimizando la performance del dashboard y reportes financieros:

- **N+1 de baja rotación** (`AUD-PERF-001`/`AUD-PERF-005`): `getLowRotationProducts` y `getLowRotationReport` reemplazan `findFirst` por variante con un único `groupBy`, reduciendo queries de O(N) a O(1).
- **Grafo completo de rentabilidad** (`AUD-PERF-003`): `getBatchProfitability` y `getBatchProfitabilityReport` filtran `OrderItemAllocation` en DB por `status = PAID` y rango de fechas antes de cargar lotes.
- **Duplicación de dashboard** (`AUD-PERF-001`): `getFinancialAlerts` acepta `precomputed`; `dashboard/page.tsx` pasa `overview` y `lowRotationCount` ya calculados, evitando recalcularlos.
- Regresión: `pnpm exec dotenv -e .env -- tsx scripts/_with-env.ts scripts/test-perf-fixes.ts` → 5/5 tests (query count constante + wall-clock ≤ 2s).

### Auditoría técnica — correcciones 0.40.0

La versión 0.40.0 cierra `AUD-FUNC-001`, `AUD-FUNC-002`, `AUD-FUNC-005`, `AUD-UX-009`, `AUD-DATA-010`, `AUD-DATA-016`, `AUD-DATA-017`, `AUD-UX-001`, `AUD-UX-005`, `AUD-PERF-010` y `AUD-UX-013` implementando historial real de cliente, UI de créditos, gestión completa de lotes, bloqueo efectivo de clientas `BLOCKED`, revalidación de lotes cerrados bajo concurrencia y correcciones de Fase 1:

- **Historial real de cliente** (`AUD-FUNC-001`): `listCustomerOrdersAction` y `listCustomerPaymentsAction` exponen paginación server-side. Los componentes `CustomerOrdersHistory` y `CustomerPaymentsHistory` reemplazan los placeholders en la ficha de cliente con tablas paginadas reales.
- **UI de créditos** (`AUD-FUNC-002`): `CreateManualCreditForm`, `ApplyCreditToOrderForm` y `RefundCreditForm` usando `useActionState`. `CustomerCreditsHistory` se reescribe como client component con formularios inline para crear, aplicar y devolver créditos.
- **Gestión completa de lotes** (`AUD-FUNC-005`): `BatchEditForm` (edición multi-campo), `AddBatchItemForm` (búsqueda de variante + cantidad/costo) y `RemoveBatchItemButton` (ConfirmDialog destructivo). La página de detalle de lote incluye toolbar de acciones y columna de eliminar, ocultos si el lote está `CLOSED`.
- **Bloqueo efectivo de cliente `BLOCKED`** (`AUD-UX-009`): `createQuickSale` rechaza con `OrderError("CUSTOMER_BLOCKED")` si la clienta está bloqueada, revalidando el estado dentro de la transacción `Serializable` (no solo antes de abrirla). Decisión de negocio: bloqueo duro, sin override de ningún rol. `QuickSaleForm` muestra el estado de la clienta seleccionada y deshabilita el submit si está bloqueada. Al seleccionar clienta se muestra su WhatsApp real en vez de campo vacío (`AUD-UX-013`).
- **Lotes cerrados bajo concurrencia** (`AUD-DATA-010`): `assertBatchNotClosed(tx, batchId)` (`lib/import-batches.ts`) centraliza la revalidación de `status !== CLOSED` y se invoca dentro de la transacción `Serializable` de las 4 mutaciones de lote (`updateBatchAction`, `addBatchItemAction`, `removeBatchItemAction`, `recalculateBatchAction`), en vez de validarlo solo antes de abrirla. Se agrega manejo explícito de conflictos de serialización (`P2034`).
- **Gastos transaccionales** (`AUD-DATA-016`): `updateExpenseAction` y `voidExpenseAction` mueven la lectura y validación de `status` dentro de la transacción `Serializable`, cerrando la ventana de carrera entre edición y anulación concurrente.
- **Códigos concurrentes** (`AUD-DATA-017`): `createBatchAction` y `createQuickSale` reintentan la transacción completa al detectar colisión `P2002`, generando nuevo código secuencial en cada intento (hasta 5).
- **WhatsApp por contexto** (`AUD-UX-001`): `getAvailableTemplates` filtra correctamente plantillas que requieren datos ausentes; sin `hasOrder` solo muestra `CREDIT_AVAILABLE` si hay crédito o lista vacía.
- **Confirmación de ajuste** (`AUD-UX-005`): `InventoryAdjustForm` agrega `ConfirmDialog` con resumen (tipo, cantidad, motivo) antes de ejecutar; submit deshabilitado si datos inválidos.
- **Historial paginado** (`AUD-PERF-010`): `getMovementHistory` acepta `{page, perPage}` (default 25); página de inventario canaliza `?movementsPage` con navegación Anterior/Siguiente server-side.
- Regresión: `pnpm tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` → 14/14 tests. `pnpm tsx scripts/_with-env.ts scripts/test-financial-reports.ts` → 12/12 tests. `pnpm tsx scripts/_with-env.ts scripts/test-customer-blocked-sale.ts` → 4/4 tests. `pnpm tsx scripts/_with-env.ts scripts/test-batch-closed-race.ts` → 4/4 tests, incluida una carrera real cierre-vs-edición contra Postgres. `pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts` → 7/7 tests.

Fase 3 del mismo ciclo 0.40.0 deja documentadas estas correcciones adicionales:

- **Costo real de envío**: el modelo financiero ahora persiste costo real de envío y lo descuenta de la utilidad neta del pedido.
- **Reportes corregidos**: lives y top productos históricos ya no comparten métricas incorrectas ni muestran revenue dummy en cero.
- **Exportaciones con truncamiento visible**: los reportes financieros limitan a `MAX_REPORT_ROWS = 5000`, exponen `meta.truncated` en UI y agregan aviso visible en CSV.
- **Dashboard dispatch real**: las cards de despacho muestran conteos reales por estado de envío.
- **Modularización Fase 3**: reportes y dashboard financiero se separan en submódulos con barrels y helpers compartidos.
- **Índice financiero pendiente**: `AUD-PERF-004` fue evaluado con `EXPLAIN ANALYZE`, pero no se agregó un índice nuevo todavía por falta de dataset representativo.

Fase 5 del mismo ciclo 0.40.0 completa testing y hardening:

- CI ahora ejecuta `pnpm test:domain` despues de `pnpm db:seed` y antes de Playwright.
- La batería de dominio incluye `scripts/test-db-constraints.ts`, que valida `CHECK` constraints SQL básicos para evitar estados imposibles fuera de la aplicación.
- El smoke E2E limpia sus datos usando el prefijo `E2E-SMOKE` y `cleanupCustomersByPrefix()`.
- Playwright conserva trazas, screenshots y videos utiles en fallo dentro de CI.
- Existe una suite E2E basica de permisos por rol en `e2e/permissions.spec.ts`.

Fase 6 del mismo ciclo 0.40.0 deja alineadas estas mejoras futuras ya ejecutadas:

- Navegacion movil y permisos: `SidebarNav` basada en permisos, `requirePermission()` y menu movil real dentro del `Sheet`.
- Detalle de producto: tabs pesados cargan por seccion y variantes/imagenes se paginan por `query params`.
- UX operativa: categorias y estados de variante ahora piden confirmacion y muestran feedback visible.
- Estados transitorios: loading y error boundaries muestran mensajes mas neutros y contextuales segun modulo.
- Operacion productiva: `vercel.json` y `docs/OPERACIONES_PRODUCCION.md` explicitan duraciones, secretos, deploy, observabilidad minima, backup/restore y rollback.

### Sprint 24 — Dashboard financiero (versión 0.25.0)

El panel `/dashboard` para ADMIN combina las métricas operativas del Sprint 11 con un nuevo bloque financiero. Los agregadores viven en `lib/financial-dashboard.ts` y operan con `select` mínimos, `Cents` enteros y sin cache persistente (cada request recalcula para mantener consistencia entre instancias serverless).

Filtros GET disponibles: `year`, `month`, `salesChannel`, `batchId`, `categoryId`. Se aplican al overview, a los top/bottom productos y a la rentabilidad por lote. El stock valorizado y la rotación baja operan sobre el estado actual.

Bloques principales del panel:

- **Overview del periodo**: ventas, costo real, utilidad bruta, fees, empaque, gastos, pérdidas y utilidad neta real con margen en bps.
- **Stock valorizado**: valor total a costo aterrizado (promedio ponderado por unidades disponibles) con fallback a `ProductVariant.cost` para variantes sin lote, desglose por categoría, conteo de variantes con/sin lote.
- **Capital en lotes**: inversión total acumulada, valor disponible en lotes no `CLOSED`, unidades disponibles/recibidas y desglose por estado.
- **Rentabilidad por lote**: unidades vendidas, ingreso asignado, costo asignado, margen y ROI por lote.
- **Top productos** y **productos con menor margen** dentro del periodo.
- **Productos sin rotación** (umbral por defecto 60 días) con valor en stock y días desde la última venta.
- **Alertas**: margen por debajo del objetivo, utilidad negativa, productos con margen bajo y productos sin rotación.

Los tests de dominio viven en `scripts/test-financial-dashboard.ts` (12/12). Se ejecutan con `pnpm tsx scripts/_with-env.ts scripts/test-financial-dashboard.ts`.

### Sprint 25 — Reportes financieros y exportación CSV (versión 0.26.0)

El módulo `/reportes` extiende las secciones operativas del Sprint 13 con 8 reportes financieros descargables. Los agregadores viven en `lib/financial-reports.ts` y usan costo congelado (`OrderItem.totalCostPen` / `grossProfitPen`) para mantener la regla del Sprint 21.

Secciones nuevas (acceso solo ADMIN):

- **Ventas por mes** (RF-S25-01): `date_trunc` sobre `Order.profitCalculatedAt` con revenue, costo, utilidad bruta, fees, empaque, utilidad neta y margen bps por mes.
- **Utilidad por producto** (RF-S25-02): top por utilidad bruta con filtro de categoría y mínimo de unidades.
- **Rentabilidad por lote** (RF-S25-03): unidades vendidas, ingreso asignado, costo asignado, margen y ROI por lote.
- **Stock valorizado** (RF-S25-04): valor del stock actual a costo aterrizado con fallback a `ProductVariant.cost`.
- **Sin rotación** (RF-S25-05): variantes sin ventas en el umbral, con valor en stock y días desde la última venta.
- **Gastos** (RF-S25-06): gastos operativos con filtros de año, mes, categoría, tipo y estado.
- **Clientes** (RF-S25-07): resumen financiero por cliente (facturado, cobrado, saldo pendiente, crédito disponible).
- **Devoluciones** (RF-S25-08): devoluciones y pérdidas con totales neto/recuperado/perdido (excluye canceladas).

Cada sección incluye un botón **Descargar CSV** que apunta a `app/api/reportes/[section]/route.ts` (RF-S25-09). El handler replica los filtros GET del UI, aplica escape RFC 4180 (comillas, comas, saltos de línea) y devuelve el archivo con `Content-Type: text/csv; charset=utf-8`, BOM UTF-8 y CRLF para máxima compatibilidad con Excel en Windows.

Los tests de dominio viven en `scripts/test-financial-reports.ts` (11/11). Se ejecutan con `pnpm tsx scripts/_with-env.ts scripts/test-financial-reports.ts`.

### Sprint 26 — UX, alertas, badges y responsive financiero (versión 0.27.0)

El sistema ahora expone el riesgo financiero con un lenguaje visual consistente y reutilizable, sin romper la UI existente.

Base reutilizable:

- `lib/financial-ui.ts` concentra la clasificación visual de margen, lote, stock, rotación e impacto de incidencias.
- `components/financial/` agrega badges compactos para margen, salud del lote, salud del stock, rotación e impacto financiero.

Integraciones principales:

- **Venta rápida**:
  - la búsqueda de variantes ahora incluye costo real estimado, precio mínimo, precio sugerido, margen actual y origen del costo;
  - el carrito recalcula el precio unitario efectivo después del descuento y avisa si una línea queda por debajo del precio mínimo;
  - el submit queda deshabilitado mientras falten clienta, carrito o adelanto.
- **Lotes**:
  - el detalle `/lotes/[id]` muestra badge de salud del lote junto al estado;
  - aparece un banner si el precio vigente deja productos por debajo del margen mínimo objetivo;
  - la tabla usa badges de margen y stock en lugar de solo color de texto.
- **Dashboard y reportes**:
  - tablas de rentabilidad usan badges de margen y lote;
  - stock y baja rotación usan badges de stock/rotación;
  - devoluciones e incidencias muestran badge de impacto;
  - los reportes financieros incluyen avisos contextuales ligeros cuando detectan margen bajo, rentabilidad baja, stock legado o productos sin rotación.

Responsive:

- Se mantiene el lenguaje visual actual (`Card`, `Badge`, `Table`, `overflow-x-auto`, `flex-wrap`) sin crear layouts paralelos.
- Los badges compactos mejoran la lectura en móvil en `/ventas`, `/lotes/[id]`, `/dashboard` y `/reportes`.

Los tests puros de esta capa viven en `scripts/test-financial-ui.ts` (8/8). Se ejecutan con `pnpm tsx scripts/test-financial-ui.ts`.

### Sprint 27 — Seed financiero, pruebas y cierre (versión 0.28.0)

El Sprint 27 deja la fase financiera verificable, reproducible y documentada. Cierra el plan con un seed financiero idempotente y cobertura de los 7 escenarios financieros obligatorios.

Seed financiero (`prisma/seed.ts`):

- 4 lotes: `LOTE-FIN-2025-001-OLD/NEW` (rentable, costos aterrizados), `LOTE-FIN-2025-002` (margen bajo), `LOTE-FIN-2025-003` (parcial COMPLETE) y `LOTE-FIN-2025-004` (cerrado CLOSED).
- 12 productos/variantes en 5 categorías (Carteras de mano, Mochilas, Accesorios, Billeteras, Riñoneras).
- 3 clientas (`+51915000001`, `+51916000002`, `+51917000003`).
- 5 ventas PAID con `profitCalculatedAt` y snapshots de costo congelado en PEN (cubre rentable, margen bajo, descuento, delivery asumido y venta de paquete).
- 5 gastos operativos del mes (publicidad, alquiler, internet, empaque, envíos).
- 2 incidencias (DAMAGE con movimiento ADJUSTMENT y RETURN con emisión de crédito al cliente).
- 1 live demo cerrado y settings financieros recalibrados para que los márgenes del demo reflejen la realidad.
- Ejecución idempotente: volver a correr `pnpm db:seed` no duplica filas y reporta los elementos ya existentes.

Pruebas del Sprint 27 (`scripts/test-financial-sprint27.ts`, 7/7):

1. Lote rentable `LOTE-FIN-2025-001-OLD` con margen > 50% en la venta asignada (FIN27-0001).
2. Margen bajo `LOTE-FIN-2025-002` con margen < 15% en la venta asignada (FIN27-0004).
3. Descuento en FIN27-0002 con `lineDiscountPen` poblado y `grossProfitPen` = neto - costo.
4. Delivery asumido en FIN27-0002 con `shippingAmount` sumado al total y a la línea de pedido.
5. Lote parcial `LOTE-FIN-2025-003` en COMPLETE con `quantityAvailable` > 0 y `quantityReceived` > `quantityAvailable`.
6. Lote cerrado `LOTE-FIN-2025-004` en CLOSED sin allocations.
7. Incidencia DAMAGE con movimiento ADJUSTMENT negativo y reducción de stock de la variante.

Los tests previos (`test-costing`, `test-order-batch-fifo`, `test-expenses`, `test-incidents`, `test-financial-dashboard`, `test-financial-reports`, `test-financial-ui`) se ajustaron para ser resilientes al seed compartido y siguen pasando: 68/68. Sumando los 7 del Sprint 27, la suite total de tests de dominio es **75/75** cubriendo costeo, FIFO, utilidad mensual por PAID, gastos mensuales, dashboard financiero, reportes financieros, UX financiero y los 7 escenarios de cierre.

Para correr todo el bloque:

```bash
pnpm db:deploy && pnpm db:seed
pnpm tsx scripts/_with-env.ts scripts/test-financial-sprint27.ts
pnpm verify
```

El sistema responde las preguntas clave del negocio a través de `/dashboard` y `/reportes` (cuánto gané este mes, qué lote fue más rentable, qué producto dejó más utilidad, qué producto se vende con poco margen, cuánto dinero hay en stock, cuánto capital está detenido, qué productos no están rotando, cuánto se gasta en publicidad mensual, cuánto cuestan realmente los envíos, cuál es el margen neto por canal, qué clientes compran más).

### Auditoría técnica (versión 0.29.0)

Auditoría completa de los 27 sprints del proyecto. Documentación en [`docs/auditoria/`](./docs/auditoria/) con 8 archivos:

- `README.md`: índice con reglas de uso, convención de IDs y nivel de riesgo.
- `01-resumen-ejecutivo.md`: resumen del sistema, stack, módulos y blockers críticos.
- `02-hallazgos.md`: 40+ hallazgos con IDs únicos (`AUD-SEC-*`, `AUD-DATA-*`, etc.), severidad, evidencia y criterios de aceptación.
- `03-plan-accion.md`: plan de corrección en 6 fases ordenadas por impacto.
- `04-backlog-correcciones.md`: backlog técnico priorizado con 74+ items.
- `05-plan-pruebas.md`: matriz de pruebas obligatorias por hallazgo crítico.
- `06-riesgos-produccion.md`: riesgos bloqueantes, checklist de deploy y plan de rollback.
- `07-registro-decisiones.md`: registro de decisiones técnicas con alternativas evaluadas.

Nivel de riesgo actual: **Alto** — la mayoría de hallazgos P0/P1 están corregidos (0.30.0–0.39.0). Quedan pendientes P1 de rendimiento (`AUD-PERF-001/003/005`) y otros riesgos operativos documentados en `docs/auditoria/`.

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
5. No compartas `.env` reales en zips, tickets o sesiones remotas. El repo incluye `.env.example` sin secretos y CI ejecuta secret scanning para detectar fugas en archivos rastreados.
6. Define el comando de build en Vercel como `pnpm verify` para que typecheck y lint fallen rápido en CI.
7. Tras el primer deploy, ejecuta `pnpm db:deploy && pnpm db:seed` desde la consola one-shot de Vercel CLI (o un workflow puntual) para crear las tablas y los usuarios iniciales.
8. Si una base existente fue creada previamente con `db:push`, valida que su schema coincida con `prisma/schema.prisma` en staging y marca el baseline como aplicado con `pnpm prisma migrate resolve --applied 20260704000000_init` antes de usar `pnpm db:deploy` para migraciones futuras.
9. Usa `docs/OPERACIONES_PRODUCCION.md` como runbook minimo para checklist de secretos, deploy, observabilidad, backup/restore y rollback.

> La aplicación está pensada para correr en multi-instancia serverless. Toda la caché compartida se apoya en la cache de Next.js con tags (`lib/settings.ts`); no uses `globalThis`.

## Pruebas E2E

La suite oficial es Playwright y vive en `e2e/`. Hay seis specs:

- `e2e/smoke.spec.ts`: smoke E2E (login + alta de cliente) con cleanup de clientas `E2E-SMOKE`.
- `e2e/flows.spec.ts`: los 8 flujos obligatorios de Sprint 15 (venta con adelanto, venta pagada, pago a varios pedidos, sobrepago, reserva vencida, envío agrupado, rechazo de pago, ajuste de stock) ejecutados contra el motor de dominio y la base de datos real.
- `e2e/batch-fifo.spec.ts`: flujos E2E de lotes y asignacion FIFO sobre inventario por batch.
- `e2e/concurrency.spec.ts`: escenarios de concurrencia obligatoria de la Fase 3A (doble validación, edición+rechazo paralelo, cancelación atómica de envío, transición de estado única).
- `e2e/ui-flows.spec.ts`: flujos de UI real de Fase 4 (validación de pago y cancelación de envío con motivo desde la página).
- `e2e/permissions.spec.ts`: redirección a login para anónimos y matriz básica de acceso por rol (`ADMIN`, `SELLER`, `DISPATCH`).

### Prerrequisitos

- Base de datos **aislada** distinta a la de desarrollo. Se recomienda:
  - copiar `.env.e2e.example` a `.env.e2e`
  - apuntar `E2E_DATABASE_URL` y `E2E_DIRECT_URL` a una base dedicada
- Node 20+ y pnpm 10+ (declarados en `engines` y `packageManager`).

### Comandos

```bash
pnpm test:e2e:install                                # una sola vez
pnpm db:deploy && pnpm db:seed                      # sobre la base E2E
pnpm test:domain                                    # regresiones de dominio previas a Playwright
pnpm test:e2e                                       # build + start, contra .env local
pnpm test:e2e:env                                   # usa .env.e2e (recomendado)
pnpm test:e2e:dev                                   # levanta next dev en lugar de build+start
```

`E2E_BASE_URL` permite apuntar a un servidor ya levantado. En CI (`.github/workflows/ci.yml`) el flujo es `pnpm db:deploy && pnpm db:seed && pnpm test:domain && pnpm test:e2e` con Playwright levantando el build.

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
lib/                   auth, prisma, validations, roles, permissions, authorization-core, authorization, settings, phone, customer-helpers, blob, utils
prisma/                schema.prisma y seed
types/                 Enums compartidos del dominio
docs/                  Planes de sprints, roadmap financiero, requisitos funcionales/no funcionales, flujos y auditoría técnica
CHANGELOG.md           Historial de versiones
```

## Módulos

### Autenticación (Sprint 1)

Sistema de login con sesión JWT en cookie httpOnly, roles y protección de rutas:

- **Login** en `/login` con email y contraseña, validación por campo y redirección automática (`?from=...`).
- **Roles**: ADMIN, SELLER, DISPATCH. Cada rol accede a diferentes módulos del sidebar.
- **Middleware** (`proxy.ts`) protege todas las rutas del dashboard; usuarios no autenticados son redirigidos a login.
- **Permisos**: helpers `requireUser()`, `requireRole()`, `canValidatePayments()`, `canManageConfiguration()`, `canManageShipments()`. Matriz de permisos por acción en `lib/authorization-core.ts` con `hasPermissionSync()` y `rolesFor()`.
- **Hash de contraseñas** con bcryptjs.
- **Panel de desarrollo** en `/login` con credenciales seed (oculto en producción).
- **Server actions**: `loginAction` y `logoutAction`.

### Configuración del negocio (Sprint 2)

Modelo singleton `BusinessSettings` con ajustes centralizados del negocio:

- **Página** `/configuracion` accesible solo por ADMIN.
- **Formulario** dividido en 4 secciones: reservas, moneda y catálogo, envíos, pagos.
- **Campos**: días de reserva (1–60), adelanto mínimo, moneda (3 letras), prefijo de código, envío gratis + umbral, métodos de pago y envío habilitados, roles que validan pagos, crédito por sobrepago y devolución.
- **Validación** integral con Zod en server action `updateSettingsAction`.
- **Caché distribuible de Next.js** (`lib/settings.ts`) con tags e invalidación explícita; no usar caché en proceso ni `globalThis`.
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
- Cards enlazan solo a rutas permitidas por rol; en despacho, los pedidos listos abren creación de envío y las métricas informativas sin ruta restringida quedan sin enlace.
- Listas rápidas (top 5) para pagos pendientes, reservas por vencer, pedidos listos para envío y envíos en proceso, con badge de estado y link permitido segun rol.
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

### Sprint 23 — Incidencias, devoluciones, daños y pérdidas

- Vista `/incidencias` (sólo `ADMIN`) con tabla paginada, filtros (tipo, estado, decisión, mes) y resumen de total perdido/recuperado de la página (excluye canceladas).
- Vista `/incidencias/nuevo` con `IncidentForm` (buscadores async para pedido, variante y clienta; selección de línea de pedido; tipo y decisión validados).
- Vista `/incidencias/[id]` con detalle, botones de resolver y cancelar (motivo obligatorio, `ConfirmDialog`).
- Modelo `Incident` con soft delete (status = CANCELLED) e integraciones transaccionales:
  - `RETURN + RESTOCK`: devuelve unidades a `stock` y reduce `soldStock` con `InventoryMovement` tipo `IN`.
  - `RETURN + CREDIT`: crea `CustomerCredit` con origin `MANUAL` y vincula al `Incident.creditId`.
  - `RETURN + REPLACE`/`DISCARDED`: solo registro.
  - `DAMAGE`/`LOSS` en stock propio: reduce `stock` y registra `InventoryMovement` tipo `ADJUSTMENT`.
  - `DAMAGE`/`LOSS`/`CLAIM` post-venta: solo registra los montos `lost`/`recovered`.
- Módulo de dominio `lib/incidents.ts` con `createIncident`, `resolveIncident`, `cancelIncident`, `listIncidents`, `getIncidentDetail` y `getMonthlyIncidentSummary` (desglose por tipo, separación perdido vs recuperado, neto del periodo).
- `lib/dashboard.ts` y `lib/expenses.ts` (`getFinancialPeriod`) restan el `lostAmount` de las incidencias no canceladas al calcular la utilidad neta real del mes.
- Dashboard admin: nueva card "Pérdidas por incidencias del mes" y card combinada "Gastos + pérdidas del mes" con enlace a `/incidencias`.
- Acciones `createIncidentAction`, `resolveIncidentAction`, `cancelIncidentAction` con `Serializable` + `auditInTx`. Validaciones Zod dedicadas (`IncidentCreateSchema`, `IncidentResolveSchema`, `IncidentCancelSchema`).
- Enums de auditoría `INCIDENT_CREATED`, `INCIDENT_RESOLVED` y `INCIDENT_CANCELLED` con sus etiquetas en `/auditoria`.
- Script de tests `scripts/test-incidents.ts` con 11 tests de dominio (validación, integración con stock, créditos, filtros, agregadores, transiciones de estado con guardas).

### Sprint 22 — Gastos operativos mensuales

- Vista `/gastos` (sólo `ADMIN`) con tabla paginada, filtros (categoría, tipo, estado, mes) y resumen del total activo de la página.
- Vista `/gastos/nuevo` con `ExpenseForm` (categoría fija o variable, fecha, detalle, monto, medio de pago, notas).
- Vista `/gastos/[id]` con detalle, edición y anulación (soft delete vía `status = VOIDED`) con motivo obligatorio.
- Modelo `Expense` con soft delete para preservar auditoría y los totales históricos. La anulación descuenta el gasto de los agregadores financieros en el mismo instante.
- Módulo de dominio `lib/expenses.ts` con:
  - `listExpenses` (filtros por mes/categoría/tipo/estado y query, paginación).
  - `getMonthlyExpenseSummary` (total, desglose por categoría ordenado por monto, separación fijo vs variable).
  - `getFinancialPeriod` (revenue, costo real, utilidad bruta, gastos, utilidad neta real y margen bps) que descuenta los gastos operativos del mes de la utilidad operativa de los pedidos `PAID`.
- `lib/dashboard.ts` añade al dashboard admin las cards "Ventas del mes", "Utilidad bruta del mes", "Gastos operativos del mes" y "Utilidad neta real del mes" con margen bps y tono verde/rojo.
- Acciones `createExpenseAction`, `updateExpenseAction` y `voidExpenseAction` con transacciones `Serializable`, `auditInTx` y `revalidatePath`. Validaciones Zod dedicadas (`ExpenseCreateSchema`, `ExpenseUpdateSchema`, `ExpenseVoidSchema`).
- Enums de auditoría `EXPENSE_CREATED`, `EXPENSE_UPDATED` y `EXPENSE_VOIDED` con sus etiquetas en `/auditoria`.
- Script de tests `scripts/test-expenses.ts` con 7 tests de dominio (validación, agregadores, filtros, financial period).
- Helper `scripts/_with-env.ts` para correr los scripts de tests cargando `.env` en local (los scripts existentes como `test-order-batch-fifo.ts` siguen funcionando con el mismo wrapper).

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

### Configuración financiera base (Sprint 18)

Extensión del módulo `/configuracion` con los parámetros financieros que gobernarán los siguientes sprints de la fase por lotes:

- **Tipo de cambio** USD → PEN configurable (`defaultExchangeRate`), con hasta 4 decimales.
- **Márgenes objetivo** en basis points (mínimo aceptable y objetivo recomendado) para los badges y reportes financieros.
- **Costos estándar**: costo de empaque (`standardPackagingCostPen`) y método de asignación de costos por defecto (`BY_VALUE`, `BY_WEIGHT`, `MIXED`, `MANUAL`) con porcentajes de valor/peso cuando se elige el método mixto (deben sumar 100).
- **Comisión por medio de pago** (Yape, Plin, Efectivo, Otro) almacenada en `Json` como basis points y mostrada en porcentaje en la UI.
- **Canales de venta** habilitados (`TIKTOK_LIVE`, `INSTAGRAM_LIVE`, `TIENDA`, `WHATSAPP_DIRECTO`, `OTRO`).
- Auditoría `SETTINGS_UPDATED` extendida con el detalle `previous` / `next` para todos los campos nuevos.
- Nuevos helpers en `lib/settings.ts` (`getDefaultExchangeRate`, `getTargetMargins`, `getDefaultCostAllocationMethod`, `getMixedAllocationPercents`, `getStandardPackagingCost`, `getPaymentMethodFees`, `getEnabledSalesChannels`) listos para los Sprints 19, 20 y 21.

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
- ✅ Sprint 16 — Reservas, rechazos y recordatorios
- ✅ Sprint 17 — Plan financiero por lotes e importaciones
- ✅ Sprint 18 — Configuración financiera base
- ✅ Sprint 19 — Lotes de importación MVP
- ✅ Sprint 20 — Motor de costeo aterrizado
- ✅ Sprint 21 — Integración lote, stock y venta FIFO
- ✅ Sprint 22 — Gastos operativos mensuales (`/gastos`)
- ✅ Sprint 23 — Incidencias, devoluciones, daños y pérdidas (`/incidencias`)
- ✅ Sprint 24 — Dashboard financiero
- ✅ Sprint 25 — Reportes financieros y exportación CSV
- ✅ Sprint 26 — UX, alertas, badges y responsive financiero
- ✅ Sprint 27 — Seed financiero, pruebas y cierre
- ✅ Auditoría técnica completa (`docs/auditoria/`)

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

Versión actual: **0.39.0**. Rastreada en `package.json` y [CHANGELOG](./CHANGELOG.md).
