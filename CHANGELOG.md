# Changelog

Todos los cambios notables de Shoplivett se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.25.0] - Sprint 24 - Dashboard financiero

### Añadido
- Modulo de agregadores financieros `lib/financial-dashboard.ts` con selectores minimos y manejo interno en centavos enteros (`Cents`):
  - `getFinancialOverview({ year, month, salesChannel, batchId, categoryId })` que devuelve ventas, costo real, utilidad bruta, fees de medio de pago, costo de empaque, gastos operativos, perdidas por incidencias, utilidad neta real y margen bps (RF-S24-01 a RF-S24-06). Filtros `salesChannel`, `batchId` y `categoryId` se aplican solo a las ventas; gastos y perdidas comparten el mismo rango temporal.
  - `getStockValuation()` que calcula el valor del stock actual a costo aterrizado (promedio ponderado por unidades disponibles) con fallback a `ProductVariant.cost` para stock legado, desglose por categoria, unidades totales, conteo de variantes con y sin lote y subtotal del stock legado (RF-S24-07).
  - `getOpenBatchCapital()` que resume la inversion total acumulada, unidades disponibles/recibidas, valor disponible en lotes no `CLOSED` y desglose por estado (RF-S24-08).
  - `getProductProfitability({ order, limit, ... })` que devuelve el top o bottom de productos por utilidad bruta en el periodo, considerando solo `OrderItem` con `costSource` BATCH o LEGACY (RF-S24-09).
  - `getLowRotationProducts(days, limit)` que detecta variantes con stock sin ventas en el periodo, incluyendo valor del stock, dias desde la ultima venta y SKU (RF-S24-10).
  - `getBatchProfitability({ year, month, limit })` que asigna utilidad a cada lote reconocido en el periodo con unidades vendidas, ingreso, costo asignado, margen y ROI.
  - `getFinancialAlerts({ year, month })` que resume margen por debajo del objetivo, utilidad neta negativa, productos con margen bajo y productos sin rotacion, leyendo `minimumTargetMarginBps` y `objectiveTargetMarginBps` directamente de `BusinessSettings` (con fallback a defaults para entornos fuera de Next).
- `lib/financial-dashboard-shared.ts` con constantes cliente-seguras: `LOW_ROTATION_THRESHOLD_DAYS`, `DEFAULT_TOP_PRODUCTS_LIMIT`, `DEFAULT_LOW_ROTATION_LIMIT`, `DEFAULT_BATCH_PROFITABILITY_LIMIT`, `MARGIN_BPS_LOW_THRESHOLD` (15%) y `MARGIN_BPS_HIGH_THRESHOLD` (30%).
- Helpers de filtros en `lib/financial-dashboard.ts`: `safeYearMonth`, `safeAllString`, `safeSalesChannel`, `monthRange` y `SALES_CHANNEL_FILTER_OPTIONS`. El listado dinamico de lotes y categorias se obtiene via `listBatchOptions()` y `listCategoryOptionsForFilter()` con `select` especificos.
- UI `/dashboard` para ADMIN extendida con:
  - Filtros GET persistentes (`year`, `month`, `salesChannel`, `batchId`, `categoryId`) que aplican a ventas, top/bottom productos y rentabilidad por lote.
  - Cards de overview financiero: ventas, costo, utilidad bruta, gastos, perdidas, fees, empaque y utilidad neta real con margen bps (RF-S24-01 a RF-S24-06).
  - Cards de stock: valor total, unidades, variantes con lote, stock legado y desglose por categoria (RF-S24-07).
  - Cards de capital: capital inmovilizado en lotes abiertos, inversion total acumulada, conteo de lotes por estado (RF-S24-08).
  - Tabla de rentabilidad por lote con ROI y enlace al detalle de `/lotes/[id]`.
  - Top productos rentables / productos con menor margen (RF-S24-09).
  - Productos sin rotacion con valor en stock y dias desde la ultima venta (RF-S24-10).
  - Lista de alertas con niveles `destructive`, `warning` e `info` (margen por debajo del objetivo, utilidad negativa, productos con margen bajo, productos sin rotacion).
- Componentes nuevos: `components/dashboard/financial-filters.tsx`, `components/dashboard/financial-overview-cards.tsx` y `components/dashboard/financial-alerts.tsx` que reutilizan los `DashboardMetricCard`, `Card`, `Table` y `Badge` existentes.
- `scripts/test-financial-dashboard.ts` con 12 tests de dominio (12/12 pasan) que cubren `monthRange`, `safeYearMonth`, `safeSalesChannel`, overview con y sin filtro de canal, valorizacion de stock, capital en lotes, top/bottom productos, baja rotacion, rentabilidad por lote y alertas. Los tests previos de `test-expenses.ts` (7/7), `test-order-batch-fifo.ts` (10/10), `test-incidents.ts` (11/11) y `test-costing.ts` (27/27) siguen pasando.

### Cambiado
- `app/(dashboard)/dashboard/page.tsx` ahora acepta `searchParams` (`year`, `month`, `salesChannel`, `batchId`, `categoryId`) y los propaga al `AdminDashboard`. El panel admin combina los cards operativos del Sprint 11 con el nuevo bloque financiero (overview, stock, capital, rentabilidad, alertas) y mantiene las listas rapidas y accesos rapidos existentes.
- `getFinancialAlerts` consulta `BusinessSettings` directamente con `prisma.businessSettings.findUnique` (sin `unstable_cache`) para que la funcion sea testeable fuera del contexto Next. El resto del dashboard sigue consumiendo `getSettings()` cacheado.

### Decisiones
- Los filtros `salesChannel`/`batchId`/`categoryId` no afectan a gastos ni a incidencias: ambas agregaciones se mantienen siempre dentro del rango del mes seleccionado para que la "utilidad neta real" siga siendo comparable.
- La valorizacion de stock usa promedio ponderado por unidades disponibles en `ImportBatchItem` (cuando la variante tiene lotes calculados) y cae a `ProductVariant.cost` para variantes sin lote. Esto preserva la regla de Sprint 21: "fallback temporal a `ProductVariant.cost` para stock legado sin lote".
- El capital en lotes abiertos suma `quantityAvailable * landedUnitCostPen` solo para lotes cuyo estado no es `CLOSED`; la inversion total acumulada incluye todos los lotes aunque esten cerrados.
- Sin cache persistente: cada peticion a `/dashboard` ejecuta los agregadores. Los filtros viven en la URL (searchParams) sin estado en proceso, de modo que es seguro en multiples instancias serverless.
- `lowRotation` y `alerts` usan un umbral de 60 dias por defecto (constante `LOW_ROTATION_THRESHOLD_DAYS`) y se basan en `OrderItem.createdAt` de pedidos `PAID` para identificar la ultima venta.

### Verificacion
- `pnpm tsx scripts/_with-env.ts scripts/test-financial-dashboard.ts` → 12/12 tests pasan.
- `pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts` → 7/7 tests previos siguen pasando.
- `pnpm tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` → 10/10 tests previos siguen pasando.
- `pnpm tsx scripts/_with-env.ts scripts/test-incidents.ts` → 11/11 tests previos siguen pasando.
- `pnpm tsx scripts/_with-env.ts scripts/test-costing.ts` → 27/27 tests previos siguen pasando.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera del sprint).
- `pnpm build` → 31/31 paginas, ruta `/dashboard` registra los parametros GET esperados.

## [0.24.0] - Sprint 23 - Incidencias, devoluciones, daños y pérdidas

### Añadido
- Modelo `Incident` en `prisma/schema.prisma` con campos `incidentDate`, `type`, `status`, `decision`, `orderId`/`orderItemId`/`variantId`/`customerId` opcionales, `quantity`, `description`, `recoveredAmount`, `lostAmount`, `restockQuantity`, `creditId`, `notes`, `createdById`, `resolvedAt`/`resolvedById`/`resolutionNotes`, `cancelledAt`/`cancelledById`/`cancelledReason` y timestamps.
- Enums `IncidentType` (`RETURN`, `DAMAGE`, `LOSS`, `CLAIM`, `EXCHANGE`), `IncidentStatus` (`OPEN`, `RESOLVED`, `CANCELLED`) y `IncidentReturnDecision` (`RESTOCK`, `CREDIT`, `REPLACE`, `DISCARDED`, `NONE`).
- Índices compuestos en `Incident`: `(status, incidentDate)`, `(type, incidentDate)` y FKs indexadas para acelerar filtros y agregadores.
- Enums de auditoría `INCIDENT_CREATED`, `INCIDENT_RESOLVED` y `INCIDENT_CANCELLED` con etiquetas y tonos en `/auditoria`.
- Validaciones Zod en `lib/validations.ts`: `IncidentCreateSchema`, `IncidentResolveSchema`, `IncidentCancelSchema` (con `superRefine` para reglas de decisión).
- Módulo de dominio `lib/incidents.ts` con selectores específicos (`INCIDENT_LIST_SELECT`, `INCIDENT_DETAIL_SELECT`) y funciones:
  - `createIncident` transaccional con `Serializable`. Integra en una sola operación:
    - `RETURN + RESTOCK`: devuelve unidades a `stock` y reduce `soldStock` (con fallback si `soldStock` es menor al restock), registra `InventoryMovement` tipo `IN` con la referencia de la incidencia.
    - `RETURN + CREDIT`: crea `CustomerCredit` con origin `MANUAL` y vincula al `Incident.creditId`.
    - `RETURN + REPLACE`/`DISCARDED`/`NONE`: solo registro.
    - `DAMAGE`/`LOSS` en stock propio (sin pedido): reduce `stock` y registra `InventoryMovement` tipo `ADJUSTMENT`. Falla con `INSUFFICIENT_STOCK` si no hay unidades.
    - `DAMAGE`/`LOSS`/`CLAIM` post-venta (con pedido): solo registra montos `lost`/`recovered` sin tocar stock.
  - `resolveIncident` y `cancelIncident` idempotentes con `auditInTx`.
  - `listIncidents` con filtros (mes, tipo, estado, decisión, query) y totales (perdido/recuperado) que excluyen canceladas.
  - `getIncidentDetail` para la vista de detalle.
  - `getMonthlyIncidentSummary` con desglose por tipo y neto (recuperado - perdido).
  - `IncidentError` tipado para errores de dominio.
- Acciones de servidor en `actions/incidents.ts`:
  - `createIncidentAction` con `Serializable` + `auditInTx` (`INCIDENT_CREATED`).
  - `resolveIncidentAction` y `cancelIncidentAction` con motivo obligatorio y `auditInTx` (`INCIDENT_RESOLVED`/`INCIDENT_CANCELLED`).
  - `listIncidentsAction` y `getIncidentDetailAction` con `requireRole(["ADMIN"])`.
  - Acciones auxiliares: `searchOrdersForIncidentAction`, `searchVariantsForIncidentAction`, `searchCustomersForIncidentAction` y `getOrderItemsForOrderAction` para los selectores async del formulario.
- UI `/incidencias` con tabla paginada, filtros (tipo, estado, decisión, mes) y resumen de total perdido / recuperado de la página.
- UI `/incidencias/nuevo` con `IncidentForm` (buscadores async para pedido, variante y clienta; selector de línea de pedido; selección de decisión según tipo).
- UI `/incidencias/[id]` con detalle, botones de resolver y cancelar (`ResolveIncidentButton`/`CancelIncidentButton` con `ConfirmDialog`).
- `lib/incidents-shared.ts` con etiquetas y opciones cliente-seguras (mismo patrón que `expenses-shared.ts`).
- Componentes: `IncidentStatusBadge`, `IncidentTypeBadge`, `IncidentsTable`, `IncidentForm`, `ResolveIncidentButton`, `CancelIncidentButton`.
- Sidebar: entrada `/incidencias` (icono `AlertOctagon`, módulo "Sprint 23") visible solo para `ADMIN`.
- Proxy: `/incidencias` añadido a los prefijos protegidos.
- Dashboard admin: nueva card "Pérdidas por incidencias del mes" con enlace a `/incidencias` y card combinada "Gastos + pérdidas del mes". `FinancialPeriod` y `getDashboardMetrics` ahora restan `lostAmount` de las incidencias no canceladas al calcular la utilidad neta real.
- Script de tests `scripts/test-incidents.ts` con 11 tests de dominio: validación Zod, integración con stock (DAMAGE reduce stock + ADJUSTMENT movement, RESTOCK devuelve a stock y reduce soldStock), emisión de `CustomerCredit` con `Incident.creditId`, filtros de listado excluyendo canceladas, agregador mensual por tipo, y transiciones de estado con guardas (RESOLVED → no se cancela, CANCELLED → no se resuelve).

### Decisiones
- Las decisiones de devolución (`RESTOCK`, `CREDIT`, etc.) son explícitas: `RETURN` las admite, mientras que `DAMAGE`/`LOSS`/`CLAIM` fijan `decision = NONE` automáticamente.
- `RESTOCK` exige variante y `restockQuantity` (validado por `superRefine`); `CREDIT` exige clienta y un `recoveredAmount` > 0 (que se traduce a `CustomerCredit` con origin `MANUAL`).
- Las anulaciones (`CANCELLED`) **no revierten** movimientos de stock ni créditos ya emitidos: solo cierran la incidencia como cancelada y la ocultan de los agregadores financieros. Esto preserva la trazabilidad histórica.
- `lostAmount` se resta de la utilidad neta real del periodo en `getFinancialPeriod` y `getDashboardMetrics`, completando el ciclo "ventas → costos → gastos → pérdidas → utilidad neta real".
- Una incidencia resuelta no se puede cancelar (regla de negocio). Una cancelada no se puede resolver.

### Verificación
- `pnpm db:generate` y `pnpm db:push` aplican el schema (enums, modelo `Incident`, índices, acciones de auditoría).
- `pnpm tsx scripts/_with-env.ts scripts/test-incidents.ts` → 11/11 tests pasan.
- `pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts` → 7/7 tests previos siguen pasando.
- `pnpm tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` → 10/10 tests previos siguen pasando.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera de los archivos del sprint).
- `pnpm build` → 31/31 páginas, rutas `/incidencias`, `/incidencias/nuevo` y `/incidencias/[id]` registradas.

## [0.23.0] - Sprint 22 - Gastos operativos mensuales

### Añadido
- Modelo `Expense` en `prisma/schema.prisma` con campos `expenseDate`, `category`, `expenseType`, `status`, `description`, `amount` (Decimal 12,2), `paymentMethod`, `notes`, `createdById`, `voidedAt`, `voidedById` y `voidReason`. Soporta altas, ediciones y anulaciones (soft delete vía `status = VOIDED`) preservando trazabilidad.
- Enums `ExpenseCategory` (`RENT`, `PAYROLL`, `ADVERTISING`, `UTILITIES`, `INTERNET`, `PACKAGING`, `SHIPPING`, `OFFICE_SUPPLIES`, `PROFESSIONAL_SERVICES`, `TAXES`, `MAINTENANCE`, `OTHER`), `ExpenseType` (`FIXED`, `VARIABLE`) y `ExpenseStatus` (`ACTIVE`, `VOIDED`).
- Índices compuestos en `Expense`: `(status, expenseDate)` y `(expenseDate, category)` para acelerar los agregadores mensuales y los filtros de la lista.
- Enums de auditoría `EXPENSE_CREATED`, `EXPENSE_UPDATED` y `EXPENSE_VOIDED` con etiquetas y tonos en `/auditoria`.
- Validaciones Zod en `lib/validations.ts`: `ExpenseCreateSchema`, `ExpenseUpdateSchema` y `ExpenseVoidSchema` (cumplen RF-S22-01 a RF-S22-03).
- Módulo de dominio `lib/expenses.ts` con selectores específicos (`EXPENSE_LIST_SELECT`, `EXPENSE_DETAIL_SELECT`) y funciones:
  - `listExpenses` con filtros (mes, categoría, tipo, estado, query, paginación) y agregación de total activo.
  - `getExpenseDetail` para la vista de detalle.
  - `getMonthlyExpenseSummary` que devuelve total del mes, desglose por categoría (ordenado por monto), y separación de gastos fijos vs variables (RF-S22-04).
  - `getFinancialPeriod` que combina ventas `PAID`, costo real, utilidad bruta, gastos operativos, utilidad neta real y margen bps del periodo (RF-S22-04 y RF-S22-05).
- Acciones de servidor en `actions/expenses.ts`:
  - `createExpenseAction` con transacción `Serializable` y `auditInTx` (`EXPENSE_CREATED`).
  - `updateExpenseAction` con diff de cambios y `auditInTx` (`EXPENSE_UPDATED`).
  - `voidExpenseAction` con motivo obligatorio y `auditInTx` (`EXPENSE_VOIDED`).
  - `listExpensesAction` y `getExpenseDetailAction` con `requireRole(["ADMIN"])`.
- UI `/gastos` con tabla paginada y filtros (categoría, tipo, estado, mes), resumen del total activo de la página y chips de filtros aplicados.
- UI `/gastos/nuevo` y `/gastos/[id]` con `ExpenseForm` (modo create/edit) y `VoidExpenseButton` con `ConfirmDialog` y motivo obligatorio.
- `lib/expenses-shared.ts` con etiquetas y opciones de categorías/tipos para componentes client (mismo patrón que `import-batches-shared.ts`).
- Sidebar: entrada `/gastos` (icono `Wallet`, módulo "Sprint 22") visible solo para `ADMIN`.
- Proxy: `/gastos` añadido a los prefijos protegidos.
- Dashboard admin: nuevas cards "Ventas del mes", "Utilidad bruta del mes", "Gastos operativos del mes" y "Utilidad neta real del mes" (con margen bps y tono verde/rojo). Los agregadores corren en `getDashboardMetrics` con selects específicos y respeto a la cache de settings.
- Script de tests `scripts/test-expenses.ts` con 7 tests de dominio: validación de Zod, filtros por mes/categoría/tipo/estado, agregación mensual por categoría con separación fijo/variable, y `getFinancialPeriod` restando gastos de la utilidad operativa.
- Helper `scripts/_with-env.ts` para correr los scripts de tests con `.env` cargado en local.

### Cambiado
- `lib/dashboard.ts` añade agregados mensuales (`monthRevenueCents`, `monthGrossProfitCents`, `monthExpensesCents`, `monthRealNetProfitCents`, `monthMarginBps`) y los expone en `DashboardMetrics` para alimentar las cards de finanzas.
- `app/(dashboard)/auditoria/page.tsx` incluye los nuevos labels y tonos para `EXPENSE_CREATED`, `EXPENSE_UPDATED` y `EXPENSE_VOIDED`.

### Decisiones
- Los gastos se anulan vía `status = VOIDED` (soft delete) en vez de borrarse, para preservar auditoría y mantener los totales históricos consistentes. Los agregadores mensuales y `getFinancialPeriod` filtran por `status: "ACTIVE"` para no contar gastos anulados.
- La utilidad neta real del periodo se calcula como `grossProfitCents - paymentFeeCents - packagingCostCents - expensesCents`, alineada con el modelo Sprint 21. El costo real de envío agrupado se descontará en un sprint posterior.
- `ADVERTISING` es una categoría de primera clase. La regla de negocio del Sprint 17 ("la publicidad se registra como gasto operativo mensual, no como costo asignado a cada venta") se cumple con el modelo `Expense`.

### Verificación
- `pnpm db:generate` y `pnpm db:push` aplican el schema (enums, modelo `Expense`, índices, acciones de auditoría).
- `pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts` → 7/7 tests pasan.
- `pnpm tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` → 10/10 tests previos siguen pasando.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera de los archivos del sprint).
- `pnpm build` → 29/29 páginas estáticas, rutas `/gastos`, `/gastos/nuevo` y `/gastos/[id]` registradas.

## [0.22.1] - Fixes Sprint 21 - Edge runtime y Prisma client

### Corregido
- **Runtime `TypeError: Cannot convert undefined or null to object` en `proxy.ts`**: el middleware de Next.js (Edge runtime) arrastraba `lib/validations.ts` completo a través de `auth.ts → LoginSchema`, lo que hacía que `CostAllocationMethod` y el resto de enums de `@prisma/client` llegaran como `undefined` y reventaran `z.enum(...)` durante la evaluación del módulo.
  - Se extrae `LoginSchema` y `LoginInput` a `lib/validations/auth.ts`, archivo sin imports de `@prisma/client` y seguro para Edge.
  - `auth.ts` y `actions/auth.ts` importan ahora desde `@/lib/validations/auth`.
  - `lib/validations.ts` reexporta `LoginSchema`/`LoginInput` desde el nuevo archivo para no romper consumidores externos.
- **Runtime `PrismaClientValidationError: Unknown argument 'defaultExchangeRate'` en `/dashboard`**: el cliente de Prisma estaba desincronizado con `schema.prisma` (los campos financieros del Sprint 21 ya existían en el schema y en la BD, pero el cliente generado en `node_modules` no los conocía). Se regeneró el cliente con `pnpm db:generate`.

### Cambiado
- `package.json` añade `postinstall: "prisma generate"` para que cualquier `pnpm install` deje el cliente sincronizado con el schema y no se repita el `PrismaClientValidationError`.

### Verificación
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (10 warnings preexistentes en archivos no tocados).
- `pnpm db:generate` deja `node_modules/.prisma/client` con `defaultExchangeRate` y el resto de campos del Sprint 21.

## [0.22.0] - Sprint 21 - Integración lote, stock y venta FIFO

### Añadido
- Modelo `OrderItemBatchAllocation` en `prisma/schema.prisma` con FK a `OrderItem` e `ImportBatchItem`, snapshots de costo unitario y subtotal (cumple RF-S21-01, RF-S21-02 y RF-S21-03).
- Enum `OrderItemCostSource` (`BATCH`, `LEGACY`, `NONE`) en `OrderItem.costSource` para distinguir el origen del costo congelado.
- Snapshots financieros en `OrderItem`: `costSource`, `unitCostPen`, `totalCostPen`, `netLineRevenuePen`, `lineDiscountPen`, `grossProfitPen` (cumple RF-S21-03 y RF-S21-04).
- Snapshots en `Order`: `salesChannel`, `productCostPen`, `grossProfitPen`, `paymentFeePen`, `packagingCostPen`, `netProfitPen` y `profitCalculatedAt` (cumple RF-S21-05 y agrega el canal de venta diferido desde Sprint 18).
- Enums de auditoría `ORDER_BATCH_ALLOCATED`, `ORDER_BATCH_ALLOCATION_RELEASED`, `ORDER_PROFIT_RECOGNIZED` con sus etiquetas y tonos en `/auditoria`.
- Nuevo módulo de dominio `lib/order-batch-allocation.ts` con:
  - `variantOperatesWithBatches` y `checkBatchStock` para validar stock por lote antes de vender.
  - `allocateOrderItemBatches` que consume FIFO por `purchaseDate`, `createdAt` de batch y de item, con `updateMany` condicional para evitar sobreasignación bajo concurrencia.
  - `releaseOrderItemAllocations` que devuelve unidades al lote al cancelar o vencer una reserva.
  - `distributeOrderDiscount` con `largest remainder` para repartir el descuento del pedido entre líneas cerrando al centavo.
  - `persistQuickSaleLine` que crea `OrderItem`, asigna FIFO, calcula snapshots de costo y utilidad, y emite auditoría.
  - `recognizeOrderProfit` idempotente al pasar a `PAID` que descuenta comisión por medio de pago y costo estándar de empaque.
- Venta rápida (`lib/sales.ts`) integrada con FIFO y snapshots: ahora exige stock por lote cuando la variante opera con lotes y mantiene fallback a `ProductVariant.cost` para variantes sin lote.
- Acciones del servidor de Sprint 21:
  - `searchVariantsForSaleAction` ahora devuelve `operatesWithBatches` para informar a la UI.
  - `getEnabledSalesChannelsAction` expone los canales habilitados para el selector del formulario.
  - `removeBatchItemAction` bloquea eliminar items con asignaciones (`OrderItemBatchAllocation`) para preservar la trazabilidad histórica.
- UI `/pedidos/[id]` muestra canal de venta, snapshots por línea (costo, utilidad, fuente) y card de "Utilidad reconocida" cuando el pedido está `PAID` (visible solo para `ADMIN`).
- UI `/ventas` y `QuickSaleForm` aceptan `salesChannel` con selector ligado a los canales habilitados en `BusinessSettings`.
- Script `scripts/test-order-batch-fifo.ts` con 10 tests de dominio que cubren FIFO, bloqueo, fallback legado, distribución de descuento, profit reconocido e idempotencia.
- Spec Playwright `e2e/batch-fifo.spec.ts` con 7 flujos obligatorios del Sprint 21.
- Fixtures E2E ampliadas: `createTestProductWithBatches` y limpieza de `OrderItemBatchAllocation`/`ImportBatchItem`/`ImportBatch` en `e2e/fixtures/db.ts`.

### Cambiado
- `actions/import-batches.ts` ahora consulta asignaciones antes de eliminar items de lote y rechaza la operación si hay ventas o reservas vinculadas.
- `lib/order-expiry.ts` libera asignaciones de lote al cerrar una reserva (vencida o cancelada) con auditoría `ORDER_BATCH_ALLOCATION_RELEASED`.
- `lib/payments.ts` y `lib/credits.ts` reconocen utilidad al llevar el pedido a `PAID`, congelando `Order.netProfitPen` y emitiendo `ORDER_PROFIT_RECOGNIZED`.
- `actions/orders.ts` (`getOrderDetailAction`) incluye snapshots, allocations y profit para alimentar la UI de detalle.
- `lib/validations.ts` (`CreateOrderSchema`) acepta `salesChannel` opcional alineado al enum `SalesChannel`.

### Decisiones
- El stock por lote se descuenta dentro de la misma transacción `Serializable` que crea el pedido, junto con la reserva de stock global. Esto evita carreras entre ventas simultáneas.
- La asignación de lote se conserva aunque el lote se recálcule después: los snapshots en `OrderItemBatchAllocation` son históricos y no se tocan en recálculos.
- Una variante "opera con lotes" si tiene al menos un `ImportBatchItem` registrado, sin importar si tiene stock disponible. Esto estabiliza la decisión entre FIFO y fallback legado.
- El descuento del pedido se asigna proporcionalmente al subtotal de cada línea usando `largest remainder`, manteniendo la suma exacta en centavos.
- La utilidad neta del Sprint 21 descuenta comisión por medio de pago y costo estándar de empaque, pero no gastos operativos (Sprint 22) ni costo real de envío agrupado (siguiente fase).

### Verificación
- `pnpm db:generate` y `pnpm db:push` aplican el schema (enums, modelos, índices, default `WHATSAPP_DIRECTO`).
- `pnpm tsx scripts/test-order-batch-fifo.ts` → 10/10 tests pasan.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (10 warnings preexistentes en archivos no tocados).
- `pnpm test:e2e` ejecuta los 7 flujos FIFO + 8 flujos del Sprint 15 contra la base de datos real.

## [0.21.1] - Fix Sprint 20 - Reconciliación de costeo por lotes

### Corregido
- El motor de costeo deja de repartir adicionales por unidad y pasa a repartirlos por subtotal de línea con estrategia de `largest remainder`, garantizando que la suma de `additionalSubtotalPen` coincida exactamente con el total adicional del lote.
- `landedSubtotalPen` pasa a ser el valor autoritativo por línea; `landedUnitCostPen` y `additionalCostPen` se derivan desde el subtotal y la cantidad para evitar descuadres por redondeo.
- El modelo `ImportBatchItem` incorpora `additionalSubtotalPen` (`Decimal(12,2)`) para persistir el adicional exacto por línea y permitir conciliación financiera exacta.
- `recalculateBatchAction` ahora persiste `additionalSubtotalPen`, usa `subtotalPen` como fuente de verdad del costo base, y actualiza `ImportBatch.totalInvestmentPen` desde la suma exacta aterrizada.
- La creación, edición, agregado y eliminación de items de lote ahora mantienen el header sincronizado con la suma real de items (`totalCostUsd` y `totalInvestmentPen`) y dejan inválido cualquier recálculo anterior cuando cambian exchange rate o costos adicionales.
- `createBatchAction` valida que el `totalCostUsd` del header coincida con la suma real de los items; si no coincide, bloquea la operación.
- El detalle de `/lotes/[id]` muestra `Subtotal aterrizado` por línea para reflejar el valor autoritativo y evitar que el operador dependa solo del costo unitario derivado.

### Verificación
- `pnpm tsx scripts/test-costing.ts` → 27/27 tests pasan, incluyendo casos de reconciliación exacta y `largest remainder`.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera del fix).
- `pnpm build` → OK.
- `pnpm db:push` → schema sincronizado.

## [0.21.0] - Sprint 20 - Motor de costeo aterrizado

### Añadido
- Módulo `lib/import-batch-costing.ts` con funciones puras para el motor de costeo:
  - `convertUsdToPen` y `calculateTotalInvestmentPen` con conversión USD → PEN usando la tasa del lote.
  - `distributeByValue`, `distributeByWeight`, `distributeMixed` (valor% + peso% = 100), `distributeManual` para repartir costos adicionales entre items.
  - `calculateLandedCosts` que combina la distribución con la conversión y devuelve costo unitario aterrizado, adicional unitario y subtotal aterrizado por item.
  - `getItemPricing` que calcula precio mínimo (margen mínimo), precio sugerido (margen objetivo) y margen actual al precio vigente.
  - `CostingError` con códigos específicos (`ZERO_TOTAL_VALUE`, `ZERO_TOTAL_WEIGHT`, `INVALID_MIX_PERCENTS`, `INVALID_RATE`, `INVALID_INPUT`).
- Representación interna en **quadri-cents** (1 PEN = 10000 unidades) para preservar 4 decimales exactos sin drift de punto flotante, alineado con `Decimal(12, 4)` de Prisma.
- Extensión de `ImportBatch` con `distributionMethod`, `distributionBreakdown` (Json) y `lastRecalculatedAt`.
- Extensión de `ImportBatchItem` con `additionalCostPen`, `landedUnitCostPen`, `landedSubtotalPen`, `distributionBreakdown` (Json) y `calculatedAt`.
- Nueva acción de auditoría `IMPORT_BATCH_RECALCULATED`.
- `recalculateBatchAction` en `actions/import-batches.ts` que toma el método de distribución de `BusinessSettings`, recalcula los costos aterrizados de todos los items, persiste en transacción `Serializable` y registra auditoría.
- Componente `RecalculateBatchButton` con `ConfirmDialog` y feedback vía Sonner.
- Página `/lotes/[id]` actualizada con card de "Distribución de costos", banner cuando los items no están calculados y columnas adicionales en la tabla de items: adicional unitario, costo aterrizado (destacado), precio mínimo, precio sugerido y margen actual (con tono verde/ámbar/rojo según 30%/15%).
- Script de tests `scripts/test-costing.ts` con 44 tests de dominio (cubre todos los métodos de distribución, errores, conversión, reproducibilidad, pricing).

### Decisiones
- Los inputs y outputs del motor de costeo son PEN como decimal (number), no centavos. Internamente se trabaja en quadri-cents (10000 unidades por PEN) para evitar drift y preservar 4 decimales exactos.
- El método de distribución se toma de `BusinessSettings.defaultCostAllocationMethod` con `mixedValueAllocationPercent` / `mixedWeightAllocationPercent` para MIXED. Cambiarlo en `/configuracion` afecta el siguiente recálculo.
- `recalculateBatchAction` no es bloqueada por `quantityAvailable` (Sprint 21 congelará con `OrderItemBatchAllocation`). Hoy siempre reescribe los costos de todos los items para mantener consistencia con los costos adicionales actuales del lote.
- La distribución manual (MANUAL) retorna 0 para todos los items (placeholder); los overrides por item se implementarán en un sprint posterior.

### Verificación
- `pnpm tsx scripts/test-costing.ts` → 44/44 tests pasan.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (10 warnings pre-existentes en archivos no tocados).
- `pnpm build` → 27/27 páginas estáticas, rutas `/lotes`, `/lotes/[id]`, `/lotes/nuevo` registradas.
- `pnpm db:push` → schema sincronizado.

## [0.20.0] - Sprint 19 - Lotes de importación MVP

### Añadido
- Enums `ImportBatchStatus` (`PURCHASED`, `IN_TRANSIT`, `COMPLETE`, `CLOSED`) y acciones de auditoría `IMPORT_BATCH_CREATED`, `IMPORT_BATCH_UPDATED`, `IMPORT_BATCH_STATUS_CHANGED`, `IMPORT_BATCH_ITEM_ADDED`, `IMPORT_BATCH_ITEM_REMOVED` en `prisma/schema.prisma` (RF-S19-01, RF-S19-07).
- Modelos `ImportBatch` e `ImportBatchItem` en Prisma con código autogenerado `LOTE-YYYY-NNN`, costos USD/PEN, tipo de cambio, cantidades compradas/recibidas/disponibles y relación con variantes existentes (RF-S19-02, RF-S19-03, RF-S19-04, RF-S19-05, RF-S19-06).
- Dominio `lib/import-batches.ts` con:
  - `nextBatchCode()` y `buildBatchCode()` para generar códigos secuenciales por año.
  - `listBatches()` con paginación, filtro por estado y búsqueda server-side.
  - `getBatchDetail()` con select específico que incluye items y variantes.
  - `batchToCents()` para conversión de montos de lote a centavos.
- Validaciones Zod en `lib/validations.ts` para creación (`ImportBatchCreateSchema`), actualización (`ImportBatchUpdateSchema`) e items (`ImportBatchItemSchema`, `ImportBatchItemsSchema`).
- Server actions en `actions/import-batches.ts`:
  - `createBatchAction`: crea lote + items + movimientos de inventario en una transacción, con auditoría.
  - `updateBatchAction`: actualiza lote con recalculo de inversión total.
  - `addBatchItemAction`: agrega item al lote con movimiento de stock y auditoría.
  - `removeBatchItemAction`: elimina item y ajusta stock.
  - `listBatchesAction` / `getBatchDetailAction` con guards de rol.
  - `searchVariantsForBatchAction`: búsqueda de variantes para agregar al lote.
- Componentes UI:
  - `BatchStatusBadge` con colores por estado.
  - `BatchesTable` (TanStack Table + PaginatedDataTable) con filtro por estado y búsqueda.
  - `BatchForm` con buscador de productos, tabla editable de items e información del lote.
- Páginas:
  - `/lotes` con listado paginado y filtros.
  - `/lotes/nuevo` con formulario de creación.
  - `/lotes/[id]` con detalle, cards de resumen y tabla de items.
- Sidebar con entrada "Lotes" (módulo Sprint 19, roles ADMIN/SELLER) y proxy añade `/lotes` a las rutas protegidas.
- Auditoría de creación, cambio de estado y adición/remoción de items de lote.

### Cambiado
- `User` añade relación `createdImportBatches` para trazabilidad de creación de lotes.
- `ProductVariant` añade relación `batchItems` para navegación inversa.
- `app/(dashboard)/auditoria/page.tsx` extiende `ACTION_LABELS` y `ACTION_TONE` con las nuevas acciones de lote.
- `package.json` se sincroniza a la versión `0.20.0` para marcar el cierre del Sprint 19.

### Verificación
- `pnpm typecheck` pasa.
- `pnpm db:push` aplica schema sin errores.

## [0.19.0] - Sprint 18 - Configuración financiera base

### Añadido
- Enums `SalesChannel` (`TIKTOK_LIVE`, `INSTAGRAM_LIVE`, `TIENDA`, `WHATSAPP_DIRECTO`, `OTRO`) y `CostAllocationMethod` (`BY_VALUE`, `BY_WEIGHT`, `MIXED`, `MANUAL`) en `prisma/schema.prisma` para soportar la fase financiera.
- Campos financieros en `BusinessSettings` (singleton `id = "default"`):
  - `defaultExchangeRate` (`Decimal(10,4)`) tipo de cambio predeterminado USD → PEN.
  - `minimumTargetMarginBps` y `objectiveTargetMarginBps` (`Int`) márgenes mínimo y objetivo en basis points (RF-S18-02).
  - `defaultCostAllocationMethod` (`CostAllocationMethod`) método por defecto para distribuir costos adicionales en lotes (RF-S18-03).
  - `mixedValueAllocationPercent` y `mixedWeightAllocationPercent` (`Int`) para el reparto del método mixto (RF-S18-04).
  - `standardPackagingCostPen` (`Decimal(12,2)`) costo estándar de empaque (RF-S18-05).
  - `paymentMethodFees` (`Json`) comisiones por medio de pago en basis points (RF-S18-06).
  - `enabledSalesChannels` (`SalesChannel[]`) canales de venta disponibles (RF-S18-07).
- `lib/settings-defaults.ts` extendido con los defaults financieros, etiquetas legibles (`SALES_CHANNEL_LABELS`, `COST_ALLOCATION_METHOD_LABELS`) y helpers `coercePaymentMethodFees` / `paymentMethodFeesToJson` para normalizar el JSON de comisiones.
- `lib/validations.ts` con validaciones Zod para todos los campos nuevos, incluyendo:
  - tipo de cambio hasta 4 decimales,
  - márgenes 0–10000 bps,
  - método mixto requiere `valor + peso = 100`,
  - `minimumTargetMarginBps <= objectiveTargetMarginBps`.
- `lib/settings.ts` con nuevos helpers: `getDefaultExchangeRate`, `getTargetMargins`, `getDefaultCostAllocationMethod`, `getMixedAllocationPercents`, `getStandardPackagingCost`, `getPaymentMethodFees`, `getEnabledSalesChannels`.
- Server action `updateSettingsAction` reescrita para aceptar y persistir todos los campos nuevos, con `serialise` que captura `previous` y `next` completos para la auditoría.
- Auditoría `SETTINGS_UPDATED` ampliada: el `metadata` ahora incluye el detalle de los campos financieros.
- Página `/configuracion` extendida con las nuevas secciones: **Tipo de cambio**, **Canales de venta**, **Márgenes objetivo** y **Costos estándar** (con método de asignación y porcentajes mixtos).
- Sección "Pagos" ampliada con la grilla de **comisión por medio de pago** (Yape, Plin, Efectivo, Otro) y su equivalente porcentual legible.
- `prisma/seed.ts` siembra todos los campos financieros con los defaults centralizados.

### Cambiado
- `app/(dashboard)/configuracion/page.tsx` ahora pasa al formulario los nuevos defaults financieros.
- `components/forms/settings-form.tsx` añade el `name="defaultCostAllocationMethod"` como `<select>` nativo por simplicidad y accesibilidad (el resto de campos usan `Input` shadcn).
- Mensaje de la cabecera de `/configuracion` aclara que los cambios aplican a ventas, pagos, envíos y reportes.
- `package.json` se sincroniza a la versión `0.19.0` para marcar el cierre del Sprint 18.

### Decisiones
- Los márgenes se almacenan en **basis points** (`bps`) en la base de datos; los inputs del formulario los muestran como porcentaje (0–100) y se transforman en parseo.
- Las comisiones por medio de pago se guardan en `Json` dentro de `BusinessSettings` (no se introduce una tabla auxiliar en este sprint).
- Los canales de venta se modelan como enum `SalesChannel[]` en `BusinessSettings`; el campo `Order.salesChannel` se introducirá en el Sprint 21 cuando se conecten los pedidos con los lotes.
- El método de asignación de costos aplica a futuras compras/lotes. La venta actual no se ve afectada todavía (queda como en Sprint 17).

## [0.18.0] - Sprint 17 - Plan financiero por lotes e importaciones

### Añadido
- Documento operativo `docs/PLAN_FINANCIERO_LOTES_SPRINTS.md` para coordinar múltiples sesiones de trabajo sobre la evolución financiera del sistema.
- Roadmap financiero por sprints desde Sprint 17 hasta Sprint 27, con objetivos, requerimientos funcionales, checklist, criterios de salida y reglas de cierre por sprint.
- Modelo objetivo de integración para lotes de importación, costo aterrizado, gastos operativos, incidencias, dashboard financiero y reportes exportables.
- Reglas de continuidad para que cada sesión actualice el documento de plan, `README.md`, `CHANGELOG.md` y la versión de `package.json` al cerrar avances.

### Decisiones
- La utilidad mensual se reconocerá cuando el pedido quede en estado `PAID`.
- La salida de stock por lote será FIFO automática.
- La publicidad se registrará como gasto operativo mensual.
- `Order` y `OrderItem` seguirán siendo la fuente de verdad de ventas; no se creará una tabla `Sale` paralela.
- `BusinessSettings` se extenderá para configuración financiera; no se reemplazará por una tabla key-value.

### Cambiado
- `README.md` referencia el nuevo roadmap financiero y registra las decisiones funcionales cerradas para la fase.
- `package.json` se sincroniza a la versión `0.18.0` para iniciar oficialmente la fase financiera documentada.

## [0.17.0] - Sprint 16 - Reservas, rechazos y recordatorios

### Añadido
- Helpers en `lib/orders.ts`:
  - `deriveOrderExpiryState` para calcular flags derivados `isOverdue` / `isNearExpiry` a partir de `expiresAt` y del estado del pedido.
  - `formatOrderExpiryState` para producir etiquetas legibles (`"Vencida"`, `"Vence en N h"`).
- Componente `OrderExpiryBadge` en `components/dashboard/order-expiry-badge.tsx` que pinta el badge de vencimiento en listados y detalle.
- Acción `cancelUnpaidOrderAction` en `actions/order-cancellation.ts` y formulario `CancelUnpaidOrderForm` para cancelar manualmente pedidos sin pago validado desde la pantalla de detalle.
- Helper transaccional `closeUnpaidReservation` en `lib/order-expiry.ts` que centraliza la liberación de stock, rechazo de pagos pendientes y cambio de estado de un pedido. Es reutilizado por `expireReservation`, `cancelUnpaidOrder` y `rejectPayment`.
- Plantilla de WhatsApp `RESERVATION_NEAR_EXPIRY` se usa como `defaultTemplate` cuando un pedido está por vencer en `app/(dashboard)/pedidos/[id]/page.tsx`.

### Cambiado
- `lib/payments.ts:rejectPayment` ahora evalúa cada pedido afectado. Si el pedido no tiene pagos validados y no le quedan otros pagos pendientes que puedan sostener la reserva, el rechazo:
  1. libera el stock reservado de cada `OrderItem` (`InventoryMovement` con tipo `EXPIRE`),
  2. marca el pedido como `CANCELLED`,
  3. deja `balance = 0`,
  4. registra auditoría `ORDER_CANCELLED` dentro de la misma transacción.
  En cualquier otro caso el rechazo no modifica saldos ni stock (mismo comportamiento que antes).
- `lib/order-expiry.ts:expireReservation` se reescribe como wrapper sobre `closeUnpaidReservation` para evitar duplicación de lógica.
- `e2e/flows.spec.ts` ajusta el caso de rechazo de pago (RF-S15-07) y añade RF-S15-09 / RF-S15-10 cubriendo:
  - rechazo del único pago pendiente libera stock y cancela la reserva,
  - rechazo con otro pago pendiente no cancela ni libera stock,
  - rechazo sobre pedido parcialmente pagado no cancela ni libera stock.
- Página `/pedidos` muestra el badge de vencimiento por fila (columna "Vence").
- Página `/pedidos/[id]` muestra el badge junto al estado, un banner ámbar con la acción de cancelación manual y un `defaultTemplate` que cambia a `RESERVATION_NEAR_EXPIRY` o `RESERVATION_EXPIRED` según la situación del pedido.

## [0.16.0] - Sprint 15 - Pulido, pruebas y despliegue

### Añadido
- Suite E2E con **Playwright** (`@playwright/test`):
  - `e2e/smoke.spec.ts` con login y alta de cliente.
  - `e2e/flows.spec.ts` con los 8 flujos obligatorios de Sprint 15 ejecutados contra el motor de dominio y la base de datos real: venta con adelanto + validación, venta pagada completa, pago aplicado a varios pedidos, sobrepago convertido en crédito, reserva vencida cancelada con liberación de stock, envío agrupado, rechazo de pago, ajuste manual de stock.
  - `e2e/fixtures/auth.ts` con fixtures `adminPage` y `sellerPage` y credenciales seed por rol.
  - `e2e/fixtures/db.ts` con helpers Prisma (cliente, producto con stock, settings, cleanup).
  - `playwright.config.ts` con `webServer` que aplica schema y seed antes de correr.
- Scripts de verificación en `package.json`: `typecheck` (app + e2e), `verify` (typecheck + lint + build), `test:e2e`, `test:e2e:install`.
- Componentes UI reutilizables en `components/ui/`:
  - `ConfirmDialog` (AlertDialog) para acciones críticas destructivas con estado `pending` y tone `destructive`/`default`.
  - `AsyncSearchList` con loading inline, empty state, no-results state y error local para los buscadores de pago/envío/venta rápida.
  - `EmptyState` con icono, descripción y CTA opcional.
- Componentes cliente con `ConfirmDialog` integrado:
  - `DeactivateCustomerButton` (baja de clienta).
  - `LiveLifecycleActions` (cerrar/cancelar live).
  - `ProductLifecycleActions` (activar/desactivar producto, cambiar estado de variante, marcar imagen principal, eliminar imagen).
  - `ExpireReservationForm`, `PaymentActions`, `ShipmentStatusActions` con diálogos para validar pago, rechazar pago, transiciones críticas (`DELIVERED`) y cancelaciones.
- Documentación:
  - `README.md` con sección de deploy a Vercel (variables, comandos, checklist), tabla de scripts actualizada y descripción del Sprint 15.
  - `AGENTS.md` con `pnpm typecheck`, `pnpm verify`, `pnpm test:e2e`, suite Playwright documentada y checklist de deploy a Vercel.
  - `.env.example` con notas sobre `BLOB_READ_WRITE_TOKEN` y la diferencia entre `DATABASE_URL` (pooler) y `DIRECT_URL` (migraciones).

### Cambiado
- `package.json` versión `0.16.0` y `pnpm` añadidos como package manager esperado.
- `tsconfig.json` excluye `e2e` y se delega a `e2e/tsconfig.json` para evitar conflicto con el plugin `next`.
- `quick-sale-form`, `create-payment-form` y `create-shipment-form` ahora usan `AsyncSearchList` con loading/empty/error y feedback visual en cada búsqueda.
- `payment-actions.tsx`, `expire-reservation-form.tsx` y `shipment-status-actions.tsx` ya no dependen de `useFormStatus` para mostrar `pending`; el estado se deriva directamente de `useTransition`/`useActionState` y se cierra el diálogo dentro del `onConfirm` tras éxito (sin `useEffect` que setea estado).
- `components/forms/payment-actions.tsx` y `components/forms/shipment-status-actions.tsx` reescritos para exponer un botón "Confirmar validación" / "Confirmar" que abre el `ConfirmDialog` en lugar de un submit directo.

### Seguridad
- Las acciones destructivas más sensibles (baja de clienta, cerrar/cancelar live, eliminar imagen, validar pago, rechazar pago, cancelar reserva/envío, transición a `DELIVERED`) requieren doble confirmación vía `ConfirmDialog`.
- El handler de error de las server actions se muestra dentro del propio diálogo, sin filtrar detalles internos.
- Las validaciones de rol y de settings (Sprint 2/14) se mantienen: `requireRole`/`requirePaymentValidator` siguen siendo la única fuente de verdad en servidor.

## [0.15.0] - Sprint 14 - Auditoría y seguridad operativa

### Añadido
- Módulo de **Auditoría** (`/auditoria`) accesible únicamente para `ADMIN` con guard explícito `requireRole("ADMIN")` y entrypoint en el sidebar (`ShieldCheck`, módulo `Sprint 14`).
- Capa `lib/audit-report.ts` con `listAuditLog` y `listAuditActors` para listar y filtrar `AuditLog` con `select` mínimos, sin exponer update/delete.
- Capa `actions/audit-report.ts` con dos server actions que aplican `requireRole("ADMIN")`.
- Página `/auditoria` con filtros por rango de fecha, acción, entidad, actor y búsqueda libre, desglose por acción/entidad, tabla paginada y badges de severidad por acción.
- Enum `AuditAction` extendido con `ORDER_CREATED`, `PRODUCT_PRICE_CHANGED` y `CUSTOMER_DEACTIVATED`. Los valores existentes (`SHIPMENT_CREATED`, `SHIPMENT_STATUS_CHANGED`, `SHIPMENT_CANCELLED`, `ORDER_CANCELLED`, `ORDER_EXPIRED`, `ORDER_STATUS_CHANGED`) ya están cubiertos por los nuevos eventos.
- Auditoría de creación de pedido (`ORDER_CREATED`) dentro de la transacción de `lib/sales.ts`.
- Auditoría de creación, cambio de estado y cancelación de envío (`SHIPMENT_CREATED`, `SHIPMENT_STATUS_CHANGED`, `SHIPMENT_CANCELLED`) dentro de la transacción de `lib/shipments.ts`.
- Auditoría de cambio de precio/costo de variante (`PRODUCT_PRICE_CHANGED`) desde `actions/products.ts`.
- Auditoría de cambios de estado y baja lógica de clientas (`CUSTOMER_DEACTIVATED`) desde `actions/customers.ts`.

### Cambiado
- `lib/payments.ts:validatePayment` y `rejectPayment` ahora aceptan `actorId` y registran la auditoría **dentro de la transacción** (`auditInTx`) para garantizar atomicidad entre el cambio financiero y el log. Las acciones externas en `actions/payments.ts` propagan el `actorId` desde la sesión.
- `lib/sales.ts:createQuickSale` acepta `actorId` y registra la auditoría de creación de pedido dentro de la transacción.
- `lib/shipments.ts` corrige recursión en `shipmentToCents` (antes se llamaba a sí misma) y centraliza la auditoría de envíos.
- Acciones de dominio endurecidas con guards de rol explícitos:
  - `actions/customers.ts`: `requireUser` → `requireRole(["ADMIN","SELLER"])`; `deactivateCustomerAction` queda en `requireRole("ADMIN")`.
  - `actions/products.ts`: `requireUser` → `requireRole(["ADMIN","SELLER"])` en todas las actions.
  - `actions/categories.ts`: `requireUser` → `requireRole(["ADMIN","SELLER"])` en todas las actions.
- Páginas con guard de rol explícito añadido:
  - `clientes`, `clientes/nuevo`, `clientes/[id]`, `clientes/[id]/editar`
  - `productos`, `productos/nuevo`, `productos/[id]`, `productos/[id]/editar`, `productos/[id]/variantes/*`
  - `categorias`, `categorias/nueva`, `categorias/[id]/editar`
  - `ventas`, `inventario/[variantId]`
- `proxy.ts` añade `/auditoria` a los prefijos protegidos.
- `components/layout/sidebar.tsx` añade el link "Auditoría" con `roles: ["ADMIN"]`.

### Seguridad
- Las pages internas críticas ahora validan rol en el server component, sin depender sólo del sidebar.
- `lib/audit-report.ts` y la página `/auditoria` no exponen ni construyen ninguna ruta de update/delete para `AuditLog` (`RNF-S14-01`).
- La página `/auditoria` y sus actions sólo son accesibles para `ADMIN` (`RNF-S14-03`).
- La auditoría se registra dentro de las transacciones para pagos, creación de pedido, envíos y rechazo de pagos, evitando pérdida de consistencia entre negocio y log (`RNF-S14-04`).
- Toda la UI de auditoría es server-side, sin envío a clientes externos (`RNF-S14-02`).

## [0.14.0] - Sprint 13 - Reportes

### Añadido
- Módulo de **Reportes** (`/reportes`) accesible únicamente para `ADMIN` con guard explícito `requireRole("ADMIN")`.
- Capa dedicada `lib/reports.ts` con agregadores server-side:
  - `getReportSummary`: ventas (pedidos creados), cobros validados, deuda activa, créditos disponibles y reservas vencidas en el rango seleccionado.
  - `getPaymentsReport`: pagos filtrados por fecha, método, estado y búsqueda, con desglose por método y por estado vía `groupBy` (`RNF-S13-04`).
  - `getPendingBalancesReport`: pedidos con saldo pendiente, total agregado y top 10 clientas con mayor deuda.
  - `getCreditsReport`: créditos por estado y origen con totales agregados.
  - `getLivesReport`: ventas por live con pedidos, cobrado y pendiente, más totales generales.
  - `getStockReport`: variantes con stock, reservado, vendido y disponible y agregados por filtro.
  - `getTopProductsReport`: por periodo (sobre `OrderItem` con `groupBy`) o acumulado histórico (`ProductVariant.soldStock`).
  - `listCategoryOptions`: utilería para filtros de stock y top productos.
- Capa `actions/reports.ts` con 8 server actions que aplican `requireRole("ADMIN")` y delegan en `lib/reports.ts`.
- Componentes:
  - `ReportFilters` (filtros GET con fechas, búsqueda y slots extra).
  - `SummaryCard` para los totales.
  - `PaymentsReportView`, `PendingBalancesView`, `CreditsReportView`, `LivesReportView`, `StockReportView`, `TopProductsView` (uno por sección con tablas, desglose y links de drilldown a detalle).
- Página `/reportes` reescrita como shell con tabs/secciones: `Resumen`, `Pagos`, `Saldos pendientes`, `Créditos`, `Ventas por live`, `Stock actual`, `Productos más vendidos`.

### Cambiado
- El placeholder `app/(dashboard)/reportes/page.tsx` deja de ser `ModulePlaceholder` y se renderiza con datos reales.
- `lib/credits.ts:creditToCents` deja de recurrir sobre sí misma y delega en `toCents` (`allowNegative`). Bug detectado en auditoría que afectaba a `refundCredit` y agregaciones de crédito.

### Seguridad
- Todas las queries de reporte son server-side con `select` mínimos.
- Las totales monetarios se calculan en centavos (`Cents`) y se exponen como string decimal, evitando punto flotante.
- El módulo sólo está disponible para `ADMIN`; el `Sidebar` ya ocultaba el item para otros roles y la página refuerza la regla con `requireRole("ADMIN")`.
- "Cobros validados" se calcula únicamente sobre pagos con `status = VALIDATED` y `validatedAt` en el rango, cumpliendo `RNF-S13-01` (consistencia financiera).
- La página diferencia explícitamente **vendido**, **cobrado** y **pendiente** (`RNF-S13-04`) tanto en la sección de resumen como en la de ventas por live.

## [0.13.0] - Sprint 12 - Mensajes para WhatsApp

### Añadido
- Capa de **WhatsApp** para generar mensajes listos para copiar o abrir en WhatsApp Web. No envía mensajes automáticamente (cumple `RNF-S12-02`).
- `lib/whatsapp.ts` con:
  - `buildWhatsappLink(phone, text)` reutilizando `normalizeWhatsApp` para construir URLs `wa.me` válidas (`RNF-S12-04`).
  - `buildWhatsappMessage(input)` con 8 plantillas tipadas:
    - `SEPARATION_PENDING_VALIDATION`
    - `SEPARATION_CONFIRMED`
    - `BALANCE_REMINDER`
    - `RESERVATION_NEAR_EXPIRY`
    - `RESERVATION_EXPIRED`
    - `PAYMENT_VALIDATED`
    - `SHIPMENT_SENT`
    - `CREDIT_AVAILABLE`
  - Sanitización de variables: si una variable opcional falta, el mensaje no deja placeholders vacíos (`RNF-S12-03`).
  - `getAvailableTemplates(context)` para que cada pantalla sólo ofrezca las plantillas que puede construir.
- `components/whatsapp/whatsapp-actions.tsx` con dos componentes:
  - `WhatsAppActions`: cliente con `Select` de plantilla, vista previa, botones "Abrir WhatsApp" y "Copiar mensaje" con feedback vía Sonner.
  - `WhatsAppQuickButton`: botón compacto para abrir chat directo desde filas y quick lists.
- Integración en pantallas:
  - Detalle de pedido (`/pedidos/[id]`) con selector contextual según estado y un panel de plantillas al final.
  - Detalle de pago (`/pagos/[id]`) con plantillas de validación/confirmación.
  - Detalle de envío (`/envios/[id]`) con plantilla `SHIPMENT_SENT` incluyendo agencia y tracking.
  - Reservas vencidas (`/pedidos/vencidos`) con plantilla `RESERVATION_EXPIRED` por reserva.
  - Detalle de clienta (`/clientes/[id]`) con panel de plantillas y atajo "Avisar crédito" cuando hay crédito disponible.
- `CustomerCreditsHistory` agrega atajo "Avisar crédito" si el cliente tiene crédito disponible.
- Acciones rápidas en tablas: botón WhatsApp en cada fila de `customers-table`, `orders-table`, `payments-table` y `shipments-table`.
- Acciones rápidas en dashboard: las quick lists de pagos pendientes, reservas por vencer, pedidos listos y envíos en proceso ahora exponen un botón WhatsApp por item.

### Cambiado
- Las pantallas de detalle (pedido, pago, envío, reservas vencidas, cliente) ahora sugieren una acción rápida de WhatsApp junto al número de la clienta.
- `DashboardQuickItem` admite un campo opcional `whatsapp` para que las listas rápidas del dashboard puedan mostrar el botón de chat.

### Seguridad
- El sistema sólo abre `wa.me` con números validados por `normalizeWhatsApp` (formato E.164 peruano).
- Las plantillas se construyen server-side y se renderizan client-side: el operador siempre ve la vista previa antes de copiar o abrir el chat.
- No se realiza ningún envío automático ni se comparten credenciales de WhatsApp.

## [0.12.0] - Sprint 11 - Dashboard operativo

### Añadido
- Módulo de **Dashboard operativo** con datos reales, métricas del día y listas rápidas por rol.
- `lib/dashboard.ts` con agregadores server-side:
  - `getDashboardMetrics` carga en paralelo vía `Promise.all`:
    - ventas del día (suma de `Order.total` creados hoy)
    - pagos validados del día (suma de `Payment.amount` validados hoy)
    - pedidos del día
    - pagos pendientes
    - reservas vencidas y por vencer (48h)
    - deuda acumulada
    - créditos disponibles
    - pedidos listos para despacho (`PAID` sin envío)
    - envíos en proceso (`PENDING` / `PREPARING` / `READY` / `SHIPPED`)
  - Listas rápidas (top 5) para pagos pendientes, reservas por vencer, pedidos listos para envío y envíos en proceso.
- Componentes:
  - `DashboardMetricCard` con valor, hint, tono y enlace a vista filtrada.
  - `DashboardQuickList` con items linkeables, badges de estado (pago / pedido / envío) y "Ver todos".
- UI por rol:
  - `ADMIN`: financiero + operativo (ventas, cobros, deuda, créditos, reservas, despacho).
  - `SELLER`: operativo + cobranza (pagos pendientes, reservas, deuda, créditos, pedidos del día).
  - `DISPATCH`: preparación y despacho (pedidos listos, envíos en proceso, accesos rápidos).
- Cards enlazan a vistas filtradas existentes:
  - `/pagos?status=PENDING`
  - `/pedidos?status=RESERVED` / `PARTIALLY_PAID` / `PAYMENT_VALIDATION_PENDING` / `PAID`
  - `/pedidos/vencidos`
  - `/envios?status=PENDING` / `PREPARING` / `READY` / `SHIPPED`
- Bloque final de "Accesos rápidos" por rol con links contextuales.
- Diferenciación de roles vía `requireUser()` + helpers `canValidatePayments` y `canManageShipments`.

### Cambiado
- `app/(dashboard)/dashboard/page.tsx` deja de ser placeholder y se renderiza con datos agregados reales.
- Eliminado texto "Las métricas operativas del dashboard se implementarán en el Sprint 11".

### Seguridad
- Datos agregados cargados server-side vía Prisma con `select` mínimos; sin exponer datasets completos al cliente.
- Páginas de detalle se siguen consultando bajo demanda, no se duplican en el dashboard.

## [0.11.0] - Sprint 10 - Envíos agrupados

### Añadido
- Módulo de **Envíos** con listado, alta, detalle y cambio de estado.
- Modelos Prisma:
  - `Shipment` con método de envío, costo, `isFreeShipping`, agencia, tracking, snapshots de dirección y auditoría (`createdById` / `updatedById`).
  - `ShipmentOrder` con `@@unique([orderId])` para que un pedido sólo pertenezca a un envío activo a la vez.
  - Enums `ShipmentStatus` (`PENDING`, `PREPARING`, `READY`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
  - Campos `preparedAt`, `shippedAt`, `deliveredAt`, `cancelledAt` en `Shipment`.
  - `freeShippingRule` en `Shipment` (JSON) para guardar la regla aplicada al crear.
- `lib/shipments.ts` con motor transaccional:
  - `createShipment` valida:
    - pedidos pertenecen a la misma clienta
    - pedidos están en `PAID`
    - pedidos no están en otro envío activo
    - el método está habilitado en `BusinessSettings`
    - aplica automáticamente `isFreeShipping` cuando `freeShippingEnabled = true` y el total supera `freeShippingThreshold`
    - permite `forceFreeShipping`
  - `updateShipment` con transaccionalidad y respeto del estado final (`DELIVERED`/`CANCELLED`).
  - `changeShipmentStatus` con flujo de transiciones estricto (`PENDING → PREPARING → READY → SHIPPED → DELIVERED`, con `CANCELLED` permitido hasta antes de `DELIVERED`).
  - `cancelShipment` con motivo opcional.
  - `listShipments`, `getShipmentDetail`, `getEligibleOrdersForShipment`, `getOrderShipmentLink`, `listCustomerShipments`.
- Server actions (`actions/shipments.ts`):
  - `createShipmentAction`, `updateShipmentAction`, `changeShipmentStatusAction`, `cancelShipmentAction`.
  - `listShipmentsAction`, `getShipmentDetailAction`.
  - `searchCustomersForShipmentAction`, `getEligibleOrdersForShipmentAction`.
  - `getOrderShipmentLinkAction`, `listCustomerShipmentsAction`.
  - Validadores Zod para `CreateSchema` y `UpdateSchema`.
- UI:
  - Página `/envios` con TanStack Table, búsqueda, filtros por estado y paginación server-side.
  - Página `/envios/nuevo` con buscador asíncrono de clienta, listado de pedidos pagados elegibles, método, costo, override de envío gratis, agencia, tracking, dirección/distrito/referencia, notas y creación transaccional.
  - Página `/envios/[id]` con detalle de pedidos incluidos, dirección snapshot, agencia/tracking, costo, estado, timeline y acciones de cambio de estado y cancelación.
  - Componentes: `ShipmentStatusBadge`, `ShipmentsTable`, `CreateShipmentForm`, `ShipmentStatusActions`.
  - Botón "Crear envío con este pedido" en `app/(dashboard)/pedidos/[id]/page.tsx` (sólo para `ADMIN`/`DISPATCH` y pedidos `PAID` sin envío activo).
  - Link al envío desde el detalle de pedido cuando pertenece a uno activo.
  - `CustomerShipmentsHistory` en el detalle de clienta con todos los envíos y sus pedidos incluidos.

### Cambiado
- `app/(dashboard)/pedidos/[id]/page.tsx` ahora exige sesión de usuario y muestra el rol para condicionar el botón de envío.
- `actions/orders.ts`: `getOrderDetailAction` incluye `shipmentOrder.shipment` para mostrar el envío en la UI.

### Seguridad
- `ShipmentOrder.orderId` con `@@unique` evita que un pedido pertenezca a dos envíos activos.
- `createShipment` exige que los pedidos estén en `PAID` y que no estén ya en un envío activo.
- `changeShipmentStatus` bloquea transiciones inválidas (por ejemplo, no se puede volver de `DELIVERED` o `CANCELLED`).
- Cancelación persiste motivo en `notes` para auditoría.
- Doble creación concurrente protegida con transacción `Serializable`.

## [0.10.0] - Sprint 9 - Créditos, sobrepagos y reservas vencidas

### Añadido
- Módulo de **Créditos** con historial por clienta, aplicación manual a pedidos y registro de devoluciones.
- Módulo de **Reservas vencidas** con panel de cancelación y liberación de stock.
- Modelos Prisma:
  - `CustomerCredit` con `origin` (`OVERPAYMENT`, `MANUAL`, `REFUND`), `status` (`AVAILABLE`, `PARTIALLY_USED`, `USED`, `REFUNDED`, `VOIDED`), `amount`, `availableAmount` y auditoría (`createdById`, `refundedById`, `refundedAt`, `refundReason`).
  - `CustomerCreditApplication` para trazabilidad de aplicaciones de crédito a pedidos.
  - Auditoría en `Order` para vencimientos: `expiredAt`, `expiredById`.
  - Nueva variante de inventario `EXPIRE` en `InventoryMovementType`.
- `lib/credits.ts` con motor transaccional:
  - `createOverpaymentCredit` (gateado por `allowOverpaymentCredit`).
  - `createManualCredit` para registrar créditos administrativos.
  - `applyCreditToOrder` aplica manualmente a un pedido de la misma clienta, recalcula `validatedPaid`, `balance` y `status`; si el pedido queda `PAID` mueve stock de `reserved` a `sold` con movimiento `SALE`.
  - `refundCredit` exige motivo, gateado por `allowRefund`.
  - `getCustomerAvailableCredit` y `listCustomerCredits` para vistas.
- `lib/order-expiry.ts` con:
  - `listExpiredReservations` (filtra por `expiresAt < now` y estados elegibles).
  - `listReservationsNearExpiry` (panel opcional Sprint 11).
  - `expireReservation` en transacción `Serializable`: libera stock reservado (`InventoryMovement` con tipo `EXPIRE`), rechaza pagos `PENDING` del pedido y deja el pedido en `EXPIRED` con `balance = 0`.
- `lib/payments.ts` endurecido:
  - Valida que cada aplicación no supere el `balance` del pedido.
  - Detecta excedente sobre los saldos aplicados.
  - `validatePayment` acepta `excessTreatment` (`CREDIT` / `REFUND` / `REJECT`). Si hay excedente y la política lo permite, crea el `CustomerCredit` o el registro de devolución dentro de la misma transacción.
- `lib/customer-helpers.ts`: `getCustomerCredit` ahora suma `availableAmount` real de créditos disponibles y parcialmente usados.
- Server actions:
  - `actions/credits.ts`: `createManualCreditAction`, `applyCreditToOrderAction`, `refundCreditAction`, `getCustomerCreditsAction`, `getCustomerAvailableCreditAction`, `getCreditDetailAction`, `searchOrdersForCreditAction`.
  - `actions/order-expiry.ts`: `listExpiredReservationsAction`, `listReservationsNearExpiryAction`, `expireReservationAction`.
  - `actions/payments.ts`: `validatePaymentAction` admite `excessTreatment` y `excessNotes`.
- UI:
  - Página `/pedidos/vencidos` con listado paginado y formulario para cancelar reservas vencidas (libera stock y rechaza pagos pendientes).
  - Aviso en `/pedidos` cuando hay reservas vencidas.
  - Entrada en `sidebar.tsx` para "Reservas vencidas" (módulo Sprint 9, roles `ADMIN`/`SELLER`).
  - `app/(dashboard)/clientes/[id]/page.tsx` ahora muestra `CustomerCreditsHistory` con todos los créditos de la clienta, sus aplicaciones y motivos de devolución.
  - `app/(dashboard)/pagos/[id]/page.tsx` permite elegir tratamiento del excedente (no permitir / crédito / devolución) según `BusinessSettings`.
  - Componentes: `ExpireReservationForm`, `CustomerCreditsHistory`.

### Cambiado
- `Movement` y `MovementRow` aceptan el nuevo tipo `EXPIRE`.
- `lib/inventory.ts`: `Movement` exporta la unión con `EXPIRE`.
- `lib/order-expiry.ts` libera stock sin tocar `released` cuando `reservedStock` ya era 0 (defensa frente a doble cancelación).
- `lib/orders.ts` se mantiene sin cambios (la fecha de expiración se sigue calculando con `reservationDays`).
- `PaymentError` añade códigos `ORDER_OVERPAYMENT`, `OVERPAYMENT_NOT_ALLOWED`, `REFUND_NOT_ALLOWED`.

### Seguridad
- Aplicación manual de crédito a pedido cancelado o vencido queda bloqueada.
- Doble cancelación concurrente protegida con transacción `Serializable`.
- Sobrepago no permitido si `allowOverpaymentCredit = false`; devolución no permitida si `allowRefund = false`.
- Aplicación de crédito a pedido de otra clienta bloqueada con `CUSTOMER_MISMATCH`.

## [0.9.0] - Sprint 8 - Pagos, capturas y aplicación a pedidos

### Añadido
- Módulo de **Pagos** con listado, búsqueda, filtros por estado y paginación server-side.
- Modelos Prisma:
  - `PaymentApplication` (relación N:N entre `Payment` y `Order` con `amount`).
  - Auditoría en `Payment`: `validatedAt`, `validatedById`, `rejectedAt`, `rejectedById`, `rejectionReason`.
  - Nuevas relaciones inversas en `User` (`validatedPayments`, `rejectedPayments`).
- `lib/payments.ts` con motor transaccional:
  - `createPayment` con aplicaciones a uno o varios pedidos de la misma clienta.
  - `setPaymentApplications` para editar aplicaciones antes de validar.
  - `validatePayment` ejecuta en transacción `Serializable`: actualiza `validatedPaid`, recalcula `balance` y `status` (`RESERVED` / `PARTIALLY_PAID` / `PAID`), y mueve stock de `reserved` a `sold` cuando el pedido queda `PAID`.
  - `rejectPayment` exige motivo (mínimo 5 caracteres) y no altera saldos ni stock.
  - Validación de suma aplicada = monto del pago antes de validar (sin sobrepagos automáticos en MVP).
  - Validación de que todos los pedidos aplicados pertenecen a la misma clienta.
- `lib/inventory.ts`: `confirmSaleStock` y `releaseStock` aceptan `tx` externo para integrarse en la transacción de validación.
- `lib/permissions.ts`: `canValidatePayments` y `requirePaymentValidator` leen desde `BusinessSettings.paymentValidatorRoles`. Endurecimiento por configuración.
- Server actions de pagos:
  - `listPaymentsAction`, `getPaymentDetailAction`, `searchCustomersForPaymentAction`, `searchOrdersForPaymentAction`.
  - `createPaymentAction` con validaciones Zod y subida de múltiples capturas a Vercel Blob.
  - `validatePaymentAction`, `rejectPaymentAction`, `updatePaymentApplicationsAction`.
- Validadores Zod para pagos y aplicaciones.
- UI de pagos:
  - Página `/pagos` con tabla TanStack Table, búsqueda y filtros.
  - Página `/pagos/nuevo` con buscador asíncrono de clienta, selección de pedidos abiertos, monto, método, número de operación, notas y carga de capturas múltiples.
  - Página `/pagos/[id]` con detalle completo: cliente, monto, aplicaciones, capturas, auditoría y acciones de validar / rechazar (sólo si el rol del usuario está en `paymentValidatorRoles`).
- Componentes:
  - `PaymentStatusBadge` con etiquetas PENDIENTE / VALIDADO / RECHAZADO.
  - `PaymentsTable` (TanStack Table, paginación manual, búsqueda server-side).
  - `CreatePaymentForm` (cliente) con autoservicio de aplicaciones y suma visible.
  - `PaymentActions` (cliente) con `useActionState` y flujo de rechazo con motivo.
- `app/(dashboard)/pedidos/[id]/page.tsx` ahora enlaza al detalle de pago y muestra el `PaymentStatusBadge` correspondiente. Los pagos se enlazan al detalle.
- `getCustomerDebt` ahora suma saldos pendientes reales de pedidos activos.
- `getLiveMetrics` ahora calcula `soldAmount`, `collectedAmount` y `pendingAmount` desde pedidos y pagos.
- Venta rápida:
  - `QuickSaleForm` usa métodos de pago habilitados en `BusinessSettings`.
  - Capturas múltiples (`<input type="file" multiple>`).
  - `lib/sales.ts` ahora crea el `Payment` y `PaymentApplication` a través del motor compartido en `lib/payments.ts`.

### Cambiado
- `app/(dashboard)/pagos/page.tsx` deja de ser placeholder y usa datos reales.
- `app/(dashboard)/dashboard/page.tsx` consume la nueva versión asíncrona de `canValidatePayments`.
- `actions/orders.ts`: el detalle de pedido ahora incluye `applications` y `receipts` por pago.
- `components/dashboard/customer-summary.tsx` ya muestra la deuda acumulada real.

### Seguridad
- Validación de pagos limitada a roles configurados (RNF-S08-04).
- Capturas no validan automáticamente el pago (RNF-S08-02).
- Validación, recálculo de saldos y movimiento de stock en una sola transacción `Serializable` (RNF-S08-03).

## [0.8.0] - Sprint 7 - Pedidos, reservas y venta rápida

### Añadido
- Módulo de **Pedidos** con creación, listado, detalle y estados.
- Módulo de **Venta rápida** con búsqueda de clienta, variante, carrito y adelanto.
- Modelos Prisma: `Order`, `OrderItem`, `Payment`, `PaymentReceipt`.
- Enums: `OrderStatus` (`PAYMENT_VALIDATION_PENDING`, `RESERVED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`, `EXPIRED`) y `PaymentStatus` (`PENDING`, `VALIDATED`, `REJECTED`).
- Relaciones inversas: `Customer.orders/payments`, `LiveSession.orders`, `ProductVariant.orderItems`.
- `lib/orders.ts` con `generateOrderNumber` (formato `ORD-YYYYMMDD-NNNN`), `calculateOrderTotals`, `calculateOrderBalance`, `calculateOrderExpiry`.
- `lib/sales.ts` con `createQuickSale` — transacción atómica que crea `Order + OrderItem[] + Payment + PaymentReceipt[] + reserveStock`.
- `reserveStock` en `lib/inventory.ts` admite `opts.tx` para anidar en transacciones externas.
- `lib/payments.ts` (placeholder para Sprint 8).
- Server actions: `createQuickSaleAction`, `getActiveLivesAction`, `searchVariantsForSaleAction`, `searchCustomersForSaleAction`, `listOrdersAction`, `getOrderDetailAction`.
- Validadores Zod: `SaleItemSchema`, `CreateOrderSchema` con `superRefine` para items no duplicados.
- Componentes: `QuickSaleForm` (cliente con carrito, búsqueda asíncrona de clientas/variantes, cálculo de totales, captura opcional), `OrdersTable` (TanStack Table, filtro por estado y búsqueda, paginación), `OrderStatusBadge`.
- Páginas: `/ventas` (con live activo detectado automáticamente), `/pedidos` (listado con filtros), `/pedidos/[id]` (detalle con items, pagos, capturas y resumen financiero).
- Reglas de adelanto: si `total <= minimumAdvance` → pago completo; si `total > minimumAdvance` → `advance >= minimumAdvance`.
- Generación automática de número de pedido diario (contador reinicia cada día).
- Vencimiento calculado desde `reservationDays` en `BusinessSettings`.

### Cambiado
- `lib/inventory.ts`: `reserveStock` ahora acepta `opts.tx` para integrarse en transacciones anidadas.
- `/ventas` y `/pedidos` dejaron de ser placeholders y usan server components con datos reales.

## [0.7.0] - Sprint 6 - Sesiones de Live

### Añadido
- Módulo de **Lives** con listado, creación, edición y detalle.
- Modelo Prisma `LiveSession` con enums `LiveChannel` (`TIKTOK`, `INSTAGRAM`, `FACEBOOK`, `WHATSAPP`, `OTHER`) y `LiveStatus` (`OPEN`, `CLOSED`, `CANCELLED`).
- Relación opcional `responsibleId -> User` para asignar responsable del live.
- `lib/live.ts` con helpers reutilizables:
  - `getOpenLive`
  - `canOpenNewLive`
  - `assertLiveIsOpen`
  - `listLiveSessions`
  - `getLiveMetrics`
  - `getLiveDetail`
  - `assertCanOpenLive`
- Clase `LiveError` con códigos (`LIVE_NOT_FOUND`, `LIVE_ALREADY_OPEN`, `LIVE_NOT_OPEN`, etc.).
- Server actions: `createLiveAction`, `updateLiveAction`, `closeLiveAction`, `cancelLiveAction`, `getLiveSessionsAction`, `getLiveDetailAction`.
- Validadores Zod: `LiveSessionCreateSchema`, `LiveSessionUpdateSchema`, `LiveChannelSchema`.
- Componentes: `LiveStatusBadge`, `LiveSummaryCards`, `LiveForm`, `LivesTable`.
- Páginas: `/lives`, `/lives/nuevo`, `/lives/[id]`, `/lives/[id]/editar`.
- Regla de negocio del MVP: solo puede existir **un live abierto a la vez**.

### Cambiado
- `/lives` dejó de ser placeholder y ahora usa filtros por estado, búsqueda y paginación server-side.
- El detalle de live deja listos los indicadores de pedidos, vendido, cobrado y pendiente en `0.00` para conectarse con Sprints 7 y 8.

## [0.6.0] - Sprint 5 - Inventario por variante

### Añadido
- Módulo de **Inventario** con resumen por variante (Stock, Reservado, Vendido, Disponible).
- `lib/inventory.ts` con helpers internos:
  - `getStockSummary`, `getStockSummaries`
  - `reserveStock`, `releaseStock`, `confirmSaleStock`, `cancelStock`
  - `adjustStock` con validación anti-stock-negativo
  - `getMovementHistory`
- Clase `InventoryError` con códigos (`INSUFFICIENT_STOCK`, `NEGATIVE_STOCK`, `CONFLICT`, etc.).
- `reserveStock` y `confirmSaleStock` usan `Prisma.TransactionIsolationLevel.Serializable` para prevenir race conditions.
- `InventoryAdjustSchema` con Zod (motivo obligatorio, validación de tipo/cantidad).
- `actions/inventory.ts` con `adjustStockAction` (UI), `getInventorySummaryAction` (listado paginado).
- Componentes: `StockSummaryCards`, `MovementTypeBadge`, `InventoryAdjustForm`, `InventoryTable`, `MovementsTable`.
- Páginas: `/inventario` (listado), `/inventario/[variantId]` (detalle con cards de stock, Sheet de ajuste, historial de movimientos).

### Cambiado
- `InventoryMovement` ahora se usa para `IN` (Sprint 4), `RESERVE`, `RELEASE`, `SALE`, `CANCEL`, `ADJUSTMENT` (estos últimos tipos los disparan otras server actions en Sprints 7-9).

## [0.5.0] - Sprint 4 - Categorías, productos y variantes

### Añadido
- Módulos de **Categorías**, **Productos** y **Variantes** con CRUD completo.
- Modelos Prisma: `Category`, `Product`, `ProductVariant`, `ProductImage`, `InventoryMovement` con sus índices secundarios.
- Enums: `VariantStatus` (`ACTIVE`, `HIDDEN`, `ARCHIVED`) e `InventoryMovementType` (`IN`, `RESERVE`, `RELEASE`, `SALE`, `CANCEL`, `ADJUSTMENT`).
- `ProductVariant` con `code @unique` (autogenerado), `barcode @unique` opcional, `price/cost Decimal(12,2)`, `stock`, `reservedStock`, `soldStock` (los dos últimos para Sprint 5).
- `ProductImage` polimórfica (`productId` y/o `variantId`) con `isPrimary` y soporte Vercel Blob.
- `lib/product-codes.ts` con `buildVariantCode` (formato `PREFIX-CAT-COLOR-NNNN`) y `nextAvailableSuffix` con retry ante colisiones únicas.
- `lib/category-helpers.ts` con `slugify` y `ensureUniqueSlug`.
- `lib/blob.ts` extendido con `uploadImage` (validación de tipo/tamaño, `ImageUploadError`) y `deleteImage`.
- `next.config.ts` con `images.remotePatterns` para `*.public.blob.vercel-storage.com`.
- Server actions: `createCategoryAction`, `updateCategoryAction`, `setCategoryActiveAction`, `listCategoriesAction`, `createProductAction`, `updateProductAction`, `setProductActiveAction`, `createVariantAction`, `updateVariantAction`, `setVariantStatusAction`, `uploadProductImageAction`, `setPrimaryImageAction`, `deleteImageAction`, `searchProductsAction`.
- Validadores Zod: `CategoryCreateSchema`, `CategoryUpdateSchema`, `ProductCreateSchema`, `ProductUpdateSchema`, `ProductVariantCreateSchema`, `ProductVariantUpdateSchema`.
- Componentes: `CategoryForm`, `ProductForm`, `VariantForm`, `ImageUpload`, `ProductsTable`, `CategoriesTable`, `VariantStatusBadge`.
- Páginas: `/productos`, `/productos/nuevo`, `/productos/[id]` (con tabs Información / Variantes / Imágenes), `/productos/[id]/editar`, `/productos/[id]/variantes/nueva`, `/productos/[id]/variantes/[variantId]/editar`, `/categorias`, `/categorias/nueva`, `/categorias/[id]/editar`.
- Creación de variante dentro de transacción Prisma con `IN` automático cuando hay stock inicial.
- `@vercel/blob` añadido como dependencia.
- `pnpm db:seed` ahora también siembra 3 categorías: `cartera-de-mano`, `mochilas`, `accesorios`.

### Cambiado
- `next.config.ts` con `images.remotePatterns` para Vercel Blob.

## [0.4.0] - Sprint 3 - Clientes

### Añadido
- Módulo completo de **Clientes** con CRUD, búsqueda, detalle y estado.
- Modelo `Customer` en Prisma con campos `name`, `searchName`, `whatsapp`, `document`, `address`, `district`, `reference`, `channel`, `notes`, `status`, `isActive`; índice único en `whatsapp` y secundarios en `searchName`, `status`, `isActive`.
- Enum `CustomerStatus` (`ACTIVE`, `FREQUENT`, `RISKY`, `BLOCKED`).
- Normalización de WhatsApp a formato E.164 peruano (`+519XXXXXXXXX`) en cliente y servidor (`lib/phone.ts`).
- Campo `searchName` precomputado para búsqueda insensible a acentos y mayúsculas.
- Listado paginado server-side con `@tanstack/react-table` (20 por página, búsqueda por `q`, paginación con `?page=`).
- Páginas: `/clientes`, `/clientes/nuevo`, `/clientes/[id]`, `/clientes/[id]/editar`.
- Detalle con cards de **deuda acumulada** y **crédito disponible** (placeholders en `0.00` hasta Sprints 7 y 9).
- Cambio de estado y dar de baja (soft delete con `isActive = false`).
- Server actions: `createCustomerAction`, `updateCustomerAction`, `setCustomerStatusAction`, `deactivateCustomerAction`, `searchCustomersAction`.
- Validadores Zod `CustomerCreateSchema` y `CustomerUpdateSchema`.
- Componentes: `CustomerForm`, `CustomersTable`, `CustomerStatusBadge`, `CustomerSummary`.
- `@tanstack/react-table` añadido como dependencia.
- Componentes shadcn `select` y `table` agregados.

### Cambiado
- `actions/customers.ts` reemplazado por el CRUD completo.
- `lib/validations.ts` extendido con esquemas de clientes.
- Sidebar mantiene `/clientes` visible solo para `ADMIN` y `SELLER`.

## [0.3.0] - Sprint 2 - Configuración del negocio

### Añadido
- Módulo de **Configuración** editable por ADMIN.
- Modelo `BusinessSettings` (singleton `id = "default"`) con campos `reservationDays`, `minimumAdvance`, `currency`, `freeShippingEnabled`, `freeShippingThreshold`, `productCodePrefix`, `allowOverpaymentCredit`, `allowRefund`, `enabledPaymentMethods[]`, `enabledShippingMethods[]`, `paymentValidatorRoles[]`.
- Enums `PaymentMethod` y `ShippingMethod`.
- `lib/settings.ts` con cache en memoria (`getSettings`, `requireSettings`, `invalidateSettingsCache`) y helpers consumibles por otros sprints (`getReservationDays`, `getMinimumAdvance`, `getEnabledPaymentMethods`, `getEnabledShippingMethods`, `getPaymentValidatorRoles`, `isPaymentValidator`, `getFreeShippingRule`).
- `lib/settings-defaults.ts` con defaults centralizados y labels de métodos.
- Server actions: `updateSettingsAction`, `getSettingsAction`.
- Validador Zod `BusinessSettingsSchema`.
- Componente `SettingsForm` con secciones Reservas, Moneda y catálogo, Envíos, Pagos.
- Página `/configuracion` con `requireRole("ADMIN")`.
- `Decimal @db.Decimal(12,2)` para montos.
- `pnpm db:seed` ahora también siembra `BusinessSettings` con defaults.

## [0.2.0] - Sprint 1 - Autenticación, usuarios y roles

### Añadido
- Auth.js v5 (`next-auth@5.0.0-beta.31`) con Credentials Provider y sesión JWT en cookie httpOnly.
- Modelos `User` y `Session` en Prisma, con hash de contraseña via `bcryptjs`.
- Enum `Role` con valores `ADMIN`, `SELLER`, `DISPATCH`.
- Login, logout, middleware/proxy que protege las rutas del dashboard.
- `lib/permissions.ts` con `requireUser`, `requireRole`, `canValidatePayments`, `canManageConfiguration`, `canManageShipments`.
- Helpers de sesión: `lib/auth.ts` reexporta `auth`, `signIn`, `signOut`.
- Páginas `/login` (con panel discreto de "Usuarios de desarrollo" en no-producción) y dashboard adaptado al rol.
- `components/forms/login-form.tsx` con `useActionState` y Sonner.
- Header con menú de cuenta, cierre de sesión, badge de rol.
- Sidebar con filtrado por rol.
- Seed con 3 usuarios (ADMIN, SELLER, DISPATCH) usando `SEED_*` del `.env`.
- `proxy.ts` (Next 16) protegiendo el dashboard.
- Documentación inicial en `README.md`.

## [0.1.0] - Sprint 0 - Base técnica

### Añadido
- Proyecto Next.js 16 App Router + TypeScript estricto + Tailwind CSS 4.
- shadcn/ui (preset base-nova) con `Button`, `Card`, `Input`, `Separator`, `Sheet`, `Avatar`, `DropdownMenu`, `Badge`, `Sonner`, `Select`, `Table`.
- Prisma 7 con `@prisma/adapter-pg` y conexión a Neon PostgreSQL.
- `prisma.config.ts` con la configuración del cliente v7.
- `lib/prisma.ts` con inicialización perezosa.
- Estructura base de carpetas (`app`, `components`, `lib`, `actions`, `prisma`, `types`).
- Sidebar con 11 rutas placeholder, header con búsqueda y cuenta.
- `.env.example` documentado.
