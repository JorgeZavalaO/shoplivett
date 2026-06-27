# Plan financiero por lotes e importaciones

Documento operativo para coordinar multiples sesiones de trabajo sobre la evolucion financiera de Shoplivett. Este plan no reemplaza el sistema actual: lo extiende para convertir el modulo operativo de ventas, pagos, stock y envios en un sistema integral de costo real, utilidad, lotes de importacion, gastos e incidencias.

## Estado General

| Sprint | Estado | Version objetivo | Resultado principal |
| --- | --- | --- | --- |
| Sprint 17 | Completado | 0.18.0 | Plan, decisiones finales y reglas de continuidad |
| Sprint 18 | Completado | 0.19.0 | Configuracion financiera base |
| Sprint 19 | Completado | 0.20.0 | Lotes de importacion MVP |
| Sprint 20 | Completado | 0.21.0 | Motor de costeo aterrizado |
| Sprint 21 | Completado | 0.22.0 | Integracion lote-stock-venta FIFO |
| Sprint 22 | Completado | 0.23.0 | Gastos operativos mensuales |
| Sprint 23 | Completado | 0.24.0 | Incidencias, devoluciones, danos y perdidas |
| Sprint 24 | Completado | 0.25.0 | Dashboard financiero |
| Sprint 25 | Pendiente | 0.26.0 | Reportes financieros y exportacion |
| Sprint 26 | Pendiente | 0.27.0 | UX, alertas, badges y responsive financiero |
| Sprint 27 | Pendiente | 0.28.0 | Seed financiero, pruebas y cierre |

## Decisiones Finales Confirmadas

- La utilidad mensual se reconoce cuando el pedido queda en estado `PAID`.
- La salida de stock por lote sera FIFO automatica.
- La publicidad se registra como gasto operativo mensual, no como costo asignado manualmente a cada venta.
- `Order` y `OrderItem` siguen siendo la fuente de verdad de ventas; no se crea una tabla `Sale` paralela.
- `Payment`, `PaymentApplication`, `Shipment` y `ShipmentOrder` se mantienen como la fuente de verdad de cobros y despachos.
- `BusinessSettings` se extiende para configuracion financiera; no se crea una tabla key-value `Setting`.
- Los costos reales vendidos se congelan en `OrderItem` y/o una tabla de asignacion. Cambios posteriores en un lote no alteran ventas historicas.
- Todo dinero interno debe operar en centavos enteros con `lib/money.ts`.
- Las acciones criticas nuevas deben auditarse con `auditInTx` si forman parte de una transaccion de negocio o `auditAfter` si son posteriores.
- Mientras el repositorio no adopte migraciones formales, los cambios de schema se aplican con `pnpm db:push`, no con `pnpm db:migrate` contra la base compartida.

## Reglas Para Multiples Sesiones

Cada sesion debe empezar leyendo este documento, `AGENTS.md`, `README.md` y `CHANGELOG.md`.

Al iniciar una sesion:

- Revisar el sprint activo en la tabla de estado.
- Revisar checkboxes pendientes del sprint.
- Verificar cambios existentes con `git status` antes de editar.
- No revertir cambios ajenos.
- Mantener cambios pequenos y verificables.
- Usar `select` especificos en queries Prisma pesadas.
- No cachear datos financieros sensibles.

Al cerrar una sesion:

- Marcar en este documento los items completados.
- Agregar notas de avance o bloqueos en la seccion del sprint.
- Actualizar `README.md` si cambia el alcance funcional, rutas, scripts, decisiones o estado de sprints.
- Actualizar `CHANGELOG.md` con una entrada clara del sprint o avance.
- Actualizar `package.json` si el sprint queda cerrado o si se decide publicar una version intermedia.
- Ejecutar al menos `pnpm typecheck` cuando haya cambios de TypeScript.
- Ejecutar `pnpm lint` y `pnpm build` al cerrar un sprint funcional.
- Ejecutar `pnpm test:e2e` si se toca ventas, pagos, stock, envios o flujos criticos.

## Politica De Versionado

- Cierre de sprint funcional: incrementar version minor, por ejemplo `0.19.0`.
- Fix dentro de un sprint ya cerrado: incrementar patch, por ejemplo `0.19.1`.
- Documentacion que inicia una nueva fase del roadmap: puede incrementar minor si fija alcance oficial.
- La version en `package.json` debe coincidir con la ultima version documentada en `CHANGELOG.md`.
- Cada entrada de `CHANGELOG.md` debe indicar el sprint y separar `Anadido`, `Cambiado`, `Corregido`, `Seguridad` o `Documentacion` segun aplique.

## Modelo Objetivo De Integracion

### Entidades Actuales Que Se Mantienen

| Entidad | Rol en el sistema financiero |
| --- | --- |
| `Customer` | Cliente, historial, deuda, credito, devoluciones |
| `Product` | Producto base del catalogo |
| `ProductVariant` | SKU vendible y unidad operativa de stock |
| `Order` | Venta, reserva y reconocimiento de utilidad cuando queda `PAID` |
| `OrderItem` | Linea vendida y snapshot financiero historico |
| `Payment` | Cobro recibido, validacion, operacion y metodo |
| `PaymentApplication` | Aplicacion de cobros a uno o varios pedidos |
| `CustomerCredit` | Creditos por sobrepago, devoluciones o ajustes |
| `Shipment` | Despacho y costo real de envio agrupado |
| `ShipmentOrder` | Relacion envio-pedido y futura asignacion de costo real por pedido |
| `InventoryMovement` | Historial operativo de stock |
| `BusinessSettings` | Configuracion tipada del negocio |
| `AuditLog` | Trazabilidad inmutable |

### Entidades Nuevas Recomendadas

| Entidad | Proposito |
| --- | --- |
| `ImportBatch` | Lote de compra/importacion |
| `ImportBatchItem` | Producto o variante dentro de un lote con costo real unitario |
| `OrderItemBatchAllocation` | Asignacion FIFO de unidades vendidas/reservadas contra items de lote |
| `Expense` | Gasto operativo mensual o variable |
| `Incident` | Devolucion, dano, perdida, cambio, reclamo o incidencia financiera |

### Campos Clave A Extender

`Order`:

- `salesChannel`
- `packagingCostPen`
- `paymentFeePen`
- `deliveryBusinessCostPen`
- `grossProfitPen`
- `netProfitPen`
- `netMarginBps`
- `financialClosedAt`

`OrderItem`:

- `unitRealCostPen`
- `totalRealCostPen`
- `grossProfitPen`
- `netProfitPen`
- `netMarginBps`

`ShipmentOrder`:

- `allocatedShippingCostPen`

`BusinessSettings`:

- `defaultExchangeRate`
- `minimumTargetMarginBps`
- `objectiveTargetMarginBps`
- `defaultCostAllocationMethod`
- `mixedValueAllocationPercent`
- `mixedWeightAllocationPercent`
- `standardPackagingCostPen`
- `paymentMethodFees`
- `enabledSalesChannels`

## Sprint 17 - Planificacion Y Gobierno De Integracion

### Objetivo

Dejar documentada la estrategia de integracion financiera para que multiples sesiones puedan trabajar sin perder contexto ni duplicar modelos.

### Requerimientos Funcionales

- RF-S17-01: El sistema debe evolucionar sin crear un modulo de ventas paralelo.
- RF-S17-02: El plan debe registrar las decisiones funcionales finales.
- RF-S17-03: El plan debe incluir sprints, objetivos, alcance, criterios de salida y checklist actualizable.
- RF-S17-04: El repositorio debe documentar la obligacion de actualizar README, CHANGELOG y version al cerrar avances.

### Checklist

- [x] Documentar decisiones finales de reconocimiento de utilidad, FIFO y publicidad mensual.
- [x] Definir modelo objetivo compatible con el schema actual.
- [x] Dividir la evolucion financiera en sprints consecutivos.
- [x] Definir reglas para multiples sesiones.
- [x] Actualizar `README.md` con referencia al plan financiero.
- [x] Actualizar `CHANGELOG.md` con la nueva fase.
- [x] Sincronizar `package.json` con la version de la nueva fase.

### Criterios De Salida

- Existe documento en `docs/` con plan operativo.
- Las decisiones finales quedan registradas.
- README y CHANGELOG apuntan a la nueva fase.
- La version del proyecto queda sincronizada.

### Notas De Avance

- Sprint documental. No introduce cambios funcionales en runtime.

## Sprint 18 - Configuracion Financiera Base

### Objetivo

Extender `BusinessSettings` para soportar reglas financieras globales de importacion, margenes, canales y costos estandar.

### Alcance

- Schema Prisma para nuevos campos de configuracion.
- Defaults en `lib/settings-defaults.ts`.
- Validaciones Zod en `lib/validations.ts`.
- Server action existente `updateSettingsAction` extendida.
- UI en `/configuracion` con secciones financieras.
- Auditoria `SETTINGS_UPDATED` con los campos nuevos.
- Invalidation con `invalidateSettingsCache()`.

### Requerimientos Funcionales

- RF-S18-01: Configurar tipo de cambio predeterminado.
- RF-S18-02: Configurar margen minimo y margen objetivo.
- RF-S18-03: Configurar metodo de asignacion de costos por defecto.
- RF-S18-04: Configurar porcentaje mixto valor/peso.
- RF-S18-05: Configurar costo estandar de empaque.
- RF-S18-06: Configurar comision estandar por medio de pago.
- RF-S18-07: Configurar canales de venta habilitados.

### Checklist

- [x] Agregar enums necesarios para `SalesChannel` y `CostAllocationMethod`.
- [x] Extender `BusinessSettings` en `prisma/schema.prisma`.
- [x] Actualizar defaults.
- [x] Actualizar validaciones.
- [x] Actualizar action de settings.
- [x] Actualizar formulario de settings.
- [x] Actualizar seed.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- `pnpm typecheck` pasa.
- `pnpm lint` pasa.
- Configuracion financiera se guarda y persiste.
- No se rompe la configuracion operativa existente.

### Notas De Avance

- Sprint 20 cerrado. Version `0.21.1`.
- Modulo `lib/import-batch-costing.ts` con funciones puras: `convertUsdToPen`, `calculateTotalInvestmentPen`, `calculateDistributableAdditionalPen`, `distributeByValue`, `distributeByWeight`, `distributeMixed`, `distributeManual`, `calculateLandedCosts`, `getItemPricing`. Internamente en centavos enteros para el dinero; la distribucion usa `largest remainder` y los unitarios se derivan desde subtotales autoritativos.
- Errores especificos: `CostingError` con codigos `ZERO_TOTAL_VALUE`, `ZERO_TOTAL_WEIGHT`, `INVALID_MIX_PERCENTS`, `INVALID_RATE`, `INVALID_INPUT`.
- Distribucion configurable: por valor, por peso, mixta (valor+peso, suma 100%), o manual (sin auto-distribucion).
- Pricing: `getItemPricing` devuelve precio minimo (margen minimo), sugerido (margen objetivo) y margen actual al precio vigente.
- Schema: `ImportBatch` con `distributionMethod`, `distributionBreakdown`, `lastRecalculatedAt`. `ImportBatchItem` con `additionalSubtotalPen`, `additionalCostPen`, `landedUnitCostPen`, `landedSubtotalPen`, `distributionBreakdown` (Json), `calculatedAt`.
- `recalculateBatchAction` con transaccion `Serializable`, `auditInTx` (`IMPORT_BATCH_RECALCULATED`) y persistencia de costos aterrizados en items.
- UI: boton "Recalcular costos" con `ConfirmDialog` y toast. Card de "Distribucion de costos" en detalle. Tabla de items con columnas de costo aterrizado, subtotal aterrizado, precio minimo, sugerido y margen actual (con color segun umbral 15%/30%).
- Tests: `scripts/test-costing.ts` con 27 tests (cubren distribuciones, `largest remainder`, errores, conversion USD, reproducibilidad y pricing).
- Sprint 19 cerrado. Version `0.20.0`.
- Modelos nuevos: `ImportBatch` con campos: `code` (unico autogenerado), `purchaseDate`, `shopper`, `agency`, `totalCostUsd`, `totalAdditionalCostsUsd`, `totalAdditionalCostsPen`, `exchangeRate`, `totalInvestmentPen`, `status`, `notes`, `createdById`. `ImportBatchItem` con campos: `batchId`, `variantId`, `quantityPurchased`, `quantityReceived`, `quantityAvailable`, `unitCostUsd`, `unitCostPen`, `weight`, `subtotalUsd`, `subtotalPen`. Unico compuesto `(batchId, variantId)`.
- Enums nuevos: `ImportBatchStatus` (`PURCHASED`, `IN_TRANSIT`, `COMPLETE`, `CLOSED`). Auditorias nuevas: `IMPORT_BATCH_CREATED`, `IMPORT_BATCH_UPDATED`, `IMPORT_BATCH_STATUS_CHANGED`, `IMPORT_BATCH_ITEM_ADDED`, `IMPORT_BATCH_ITEM_REMOVED`.
- Codigo autogenerado `LOTE-YYYY-NNN` via `lib/import-batches.ts:nextBatchCode()`.
- Acciones CRUD en `actions/import-batches.ts` con transaccion `Serializable`, auditoria via `auditInTx` y movimiento de inventario `IN` al crear/agregar items.
- UI en `/lotes`, `/lotes/nuevo`, `/lotes/[id]`. Tabla paginada con filtro por estado y busqueda. Formulario con buscador de productos asincrono y tabla editables de items.
- Sidebar con entrada `/lotes` para `ADMIN` y `SELLER`. Proxy protegido.
- `pnpm typecheck` y `pnpm db:push` pasan sin errores.
- Sprint 18 cerrado. Version `0.19.0`.
- Enums nuevos: `SalesChannel` (`TIKTOK_LIVE`, `INSTAGRAM_LIVE`, `TIENDA`, `WHATSAPP_DIRECTO`, `OTRO`) y `CostAllocationMethod` (`BY_VALUE`, `BY_WEIGHT`, `MIXED`, `MANUAL`).
- Campos nuevos en `BusinessSettings`: `defaultExchangeRate`, `minimumTargetMarginBps`, `objectiveTargetMarginBps`, `defaultCostAllocationMethod`, `mixedValueAllocationPercent`, `mixedWeightAllocationPercent`, `standardPackagingCostPen`, `paymentMethodFees` (Json), `enabledSalesChannels`.
- UI de `/configuracion` extendida con secciones de tipo de cambio, canales, margenes y costos estandar; la seccion de pagos ahora muestra la comision por medio de pago.
- Auditoria `SETTINGS_UPDATED` incluye `previous` y `next` completos para todos los campos nuevos.

## Sprint 19 - Lotes De Importacion MVP

### Objetivo

Crear el modulo de lotes de compra/importacion y asociar productos del lote con variantes vendibles existentes.

### Alcance

- Modelos `ImportBatch` e `ImportBatchItem`.
- Acciones en `actions/import-batches.ts`.
- Dominio en `lib/import-batches.ts`.
- Validaciones Zod.
- Rutas `/lotes`, `/lotes/nuevo`, `/lotes/[id]`.
- Sidebar para `ADMIN` y, si se decide, `SELLER`.

### Requerimientos Funcionales

- RF-S19-01: Crear lote con codigo autogenerado `LOTE-YYYY-NNN`.
- RF-S19-02: Registrar fecha de compra, shopper y agencia.
- RF-S19-03: Registrar costos USD y PEN.
- RF-S19-04: Guardar tipo de cambio por lote.
- RF-S19-05: Asociar variantes existentes al lote.
- RF-S19-06: Registrar cantidad comprada, recibida y disponible por item.
- RF-S19-07: Mostrar total invertido y estado del lote.

### Checklist

- [x] Crear enums de estado de lote.
- [x] Crear modelos Prisma.
- [x] Crear generador de codigo de lote.
- [x] Crear listados y detalle con `select` especificos.
- [x] Crear formulario de lote.
- [x] Crear formulario o tabla editable de items.
- [x] Auditar creacion y cambios criticos.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- Se pueden crear lotes.
- Se pueden agregar items ligados a variantes.
- El lote muestra costos base y estado.
- La venta actual sigue funcionando sin depender todavia del lote.

## Sprint 20 - Motor De Costeo Aterrizado

### Objetivo

Calcular el costo real unitario de cada item de lote distribuyendo costos adicionales por valor, peso o metodo mixto.

### Alcance

- Funciones puras de costeo en `lib/import-batches.ts` o archivo dedicado.
- Recalculo de lote transaccional.
- Persistencia de costos calculados en `ImportBatchItem`.
- Tests de dominio o flujos Playwright segun prioridad.

### Requerimientos Funcionales

- RF-S20-01: Calcular costo total del lote en PEN.
- RF-S20-02: Calcular costo base unitario en PEN.
- RF-S20-03: Distribuir costos adicionales por valor.
- RF-S20-04: Distribuir costos adicionales por peso.
- RF-S20-05: Distribuir costos adicionales por metodo mixto configurable.
- RF-S20-06: Calcular precio minimo y precio sugerido por margen.
- RF-S20-07: Recalcular solo stock no vendido cuando cambie el lote.

### Checklist

- [x] Implementar conversion USD a PEN usando tipo de cambio del lote.
- [x] Implementar calculo por valor.
- [x] Implementar calculo por peso.
- [x] Implementar calculo mixto.
- [x] Validar pesos/cantidades cero para evitar divisiones invalidas.
- [x] Persistir resultados en items.
- [x] Agregar pruebas de calculo.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- Los calculos no usan `number` decimal para dinero.
- Los resultados son reproducibles.
- El lote permite identificar costo real unitario por variante.

## Sprint 21 - Integracion Lote, Stock Y Venta FIFO

### Objetivo

Hacer que las ventas tomen costo real desde lotes por FIFO y congelen el costo vendido.

### Alcance

- Modelo `OrderItemBatchAllocation`.
- Extension de `OrderItem` con snapshots financieros.
- Integracion con `createQuickSale` y/o `validatePayment` segun punto exacto de reconocimiento.
- FIFO automatico sobre `ImportBatchItem` disponible.

### Requerimientos Funcionales

- RF-S21-01: Asignar stock por lote con FIFO automatico.
- RF-S21-02: Impedir venta o confirmacion si no hay stock disponible por lote cuando la variante ya opera con lotes.
- RF-S21-03: Congelar costo unitario real en la linea vendida.
- RF-S21-04: Calcular utilidad bruta por item.
- RF-S21-05: Calcular utilidad neta por pedido cuando queda `PAID`.
- RF-S21-06: Mantener fallback temporal a `ProductVariant.cost` para stock legado sin lote.

### Checklist

- [x] Crear modelo de asignacion lote-item.
- [x] Definir si la reserva FIFO ocurre al crear pedido o al quedar `PAID`.
- [x] Implementar consumo FIFO transaccional.
- [x] Congelar costos en `OrderItem`.
- [x] Agregar auditoria para asignaciones criticas.
- [x] Cubrir concurrencia de ventas sobre el mismo lote.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- [x] La venta rapida sigue funcionando.
- [x] Las ventas nuevas ya tienen costo real historico.
- [x] Los reportes pueden calcular utilidad por lote y producto.

## Sprint 22 - Gastos Operativos Mensuales

### Objetivo

Registrar egresos mensuales y descontarlos de la utilidad mensual real.

### Alcance

- Modelo `Expense`.
- Rutas `/gastos` y, si aplica, `/gastos/nuevo` o modal/form inline.
- Categorias fijas iniciales o enum controlado.
- Reporte base de gastos por mes.

### Requerimientos Funcionales

- RF-S22-01: Crear gasto con fecha, categoria, detalle, monto, medio de pago y tipo.
- RF-S22-02: Diferenciar gasto fijo y variable.
- RF-S22-03: Registrar publicidad como gasto mensual.
- RF-S22-04: Calcular gastos operativos del mes.
- RF-S22-05: Restar gastos operativos de la utilidad mensual.

### Checklist

- [x] Crear modelo y enum de categorias.
- [x] Crear validaciones Zod.
- [x] Crear actions CRUD.
- [x] Crear tabla paginada.
- [x] Integrar con dashboard financiero.
- [x] Auditar creacion/edicion/anulacion.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- [x] El admin registra gastos mensuales.
- [x] Publicidad queda tratada como gasto mensual.
- [x] El dashboard puede descontar gastos del periodo.

### Notas De Avance

- Sprint 22 cerrado. Version `0.23.0`.
- Modelo `Expense` con soft delete (`status = VOIDED`) y campos `expenseDate`, `category`, `expenseType`, `description`, `amount`, `paymentMethod`, `notes`, `createdById`, `voidedAt`, `voidedById`, `voidReason`. Indices `(status, expenseDate)` y `(expenseDate, category)`.
- Enums nuevos: `ExpenseCategory` (RENT, PAYROLL, ADVERTISING, UTILITIES, INTERNET, PACKAGING, SHIPPING, OFFICE_SUPPLIES, PROFESSIONAL_SERVICES, TAXES, MAINTENANCE, OTHER), `ExpenseType` (FIXED, VARIABLE), `ExpenseStatus` (ACTIVE, VOIDED). Auditorias nuevas: `EXPENSE_CREATED`, `EXPENSE_UPDATED`, `EXPENSE_VOIDED`.
- Modulo `lib/expenses.ts` con `listExpenses` (filtros mes/categoria/tipo/estado/query, paginacion, total activo), `getExpenseDetail`, `getMonthlyExpenseSummary` (total, desglose por categoria, separacion fijo/variable) y `getFinancialPeriod` (revenue + gastos → utilidad neta real + margen bps). Selectores especificos en `EXPENSE_LIST_SELECT` y `EXPENSE_DETAIL_SELECT`.
- `lib/expenses-shared.ts` con labels y opciones cliente-seguras (mismo patron que `import-batches-shared.ts`).
- Acciones `createExpenseAction`, `updateExpenseAction`, `voidExpenseAction` con transaccion `Serializable`, `auditInTx`, `revalidatePath` y `redirect`. Validaciones Zod `ExpenseCreateSchema`/`ExpenseUpdateSchema`/`ExpenseVoidSchema`.
- UI `/gastos`, `/gastos/nuevo`, `/gastos/[id]`. Tabla paginada con filtros (categoria, tipo, estado, mes) y resumen del total activo de la pagina. Chips de filtros aplicados. `ExpenseForm` reusado en create/edit. `VoidExpenseButton` con `ConfirmDialog` y motivo obligatorio.
- Sidebar con entrada `/gastos` (icono `Wallet`, modulo "Sprint 22") para `ADMIN`. Proxy protege `/gastos`.
- Dashboard admin: nuevas cards "Ventas del mes", "Utilidad bruta del mes", "Gastos operativos del mes" y "Utilidad neta real del mes" con margen bps y tono verde/rojo. Agregados en `lib/dashboard.ts` con selects especificos.
- `pnpm db:generate` y `pnpm db:push` aplican el schema.
- `pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts` → 7/7 tests pasan (validacion Zod, filtros por mes/categoria/tipo/estado, agregacion mensual por categoria, financial period con gastos restados).
- `pnpm tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` → 10/10 tests previos siguen pasando.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera del sprint).
- `pnpm build` → 29/29 paginas, rutas `/gastos`, `/gastos/nuevo`, `/gastos/[id]` registradas.

## Sprint 23 - Incidencias, Devoluciones, Danos Y Perdidas

### Objetivo

Registrar eventos que afectan stock, creditos y utilidad.

### Alcance

- Modelo `Incident`.
- Ruta `/incidencias`.
- Integracion con inventario, pedidos y creditos.
- Estados de incidencia.

### Requerimientos Funcionales

- RF-S23-01: Registrar devolucion asociada a pedido o item.
- RF-S23-02: Permitir retorno a stock si el producto esta en buen estado.
- RF-S23-03: Registrar producto danado.
- RF-S23-04: Registrar perdida.
- RF-S23-05: Registrar monto recuperado y monto perdido.
- RF-S23-06: Integrar devoluciones con `CustomerCredit` si corresponde.

### Checklist

- [x] Crear enums de tipo y estado de incidencia.
- [x] Crear modelo Prisma.
- [x] Crear actions y validaciones.
- [x] Integrar con inventario transaccional.
- [x] Integrar con creditos cuando aplique.
- [x] Agregar reportes de perdida.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- [x] Una devolucion puede volver a stock.
- [x] Un dano o perdida reduce stock y afecta utilidad.
- [x] Todo queda auditado.

### Notas De Avance

- Sprint 23 cerrado. Version `0.24.0`.
- Modelo `Incident` con soft delete (`status = CANCELLED`) y campos `incidentDate`, `type`, `status`, `decision`, `orderId`/`orderItemId`/`variantId`/`customerId` opcionales, `quantity`, `description`, `recoveredAmount`, `lostAmount`, `restockQuantity`, `creditId`, `notes`, `createdById`, `resolvedAt`/`resolvedById`/`resolutionNotes`, `cancelledAt`/`cancelledById`/`cancelledReason`. Indices `(status, incidentDate)`, `(type, incidentDate)` y FKs indexadas.
- Enums nuevos: `IncidentType` (RETURN, DAMAGE, LOSS, CLAIM, EXCHANGE), `IncidentStatus` (OPEN, RESOLVED, CANCELLED), `IncidentReturnDecision` (RESTOCK, CREDIT, REPLACE, DISCARDED, NONE). Auditorias nuevas: `INCIDENT_CREATED`, `INCIDENT_RESOLVED`, `INCIDENT_CANCELLED`.
- Modulo `lib/incidents.ts` con `createIncident` transaccional que integra en una sola operacion:
  - `RETURN + RESTOCK`: devuelve unidades a `stock` y reduce `soldStock` con `InventoryMovement` tipo `IN`.
  - `RETURN + CREDIT`: crea `CustomerCredit` con origin `MANUAL` y vincula al `Incident.creditId`.
  - `RETURN + REPLACE`/`DISCARDED`: solo registro.
  - `DAMAGE`/`LOSS` en stock propio: reduce `stock` y registra `InventoryMovement` tipo `ADJUSTMENT`. Falla con `INSUFFICIENT_STOCK` si no hay unidades.
  - `DAMAGE`/`LOSS`/`CLAIM` post-venta: solo registra los montos `lost`/`recovered`.
  Funciones: `resolveIncident`, `cancelIncident`, `listIncidents`, `getIncidentDetail`, `getMonthlyIncidentSummary`. `IncidentError` tipado.
- `lib/incidents-shared.ts` con labels y opciones cliente-seguras (mismo patron que `expenses-shared.ts`).
- Acciones `createIncidentAction`, `resolveIncidentAction`, `cancelIncidentAction` con `Serializable` + `auditInTx` + `revalidatePath`. Validaciones Zod `IncidentCreateSchema`/`IncidentResolveSchema`/`IncidentCancelSchema` con `superRefine` para reglas de decision.
- Acciones auxiliares para los selectores async del formulario: `searchOrdersForIncidentAction`, `searchVariantsForIncidentAction`, `searchCustomersForIncidentAction`, `getOrderItemsForOrderAction`.
- UI `/incidencias`, `/incidencias/nuevo`, `/incidencias/[id]`. Tabla paginada con filtros (tipo, estado, decision, mes) y resumen perdido/recuperado de la pagina (excluye canceladas). `IncidentForm` con buscadores async. `ResolveIncidentButton`/`CancelIncidentButton` con `ConfirmDialog`.
- Sidebar con entrada `/incidencias` (icono `AlertOctagon`, modulo "Sprint 23") para `ADMIN`. Proxy protege `/incidencias`.
- `lib/expenses.ts` (`getFinancialPeriod`) y `lib/dashboard.ts` restan `lostAmount` de las incidencias no canceladas al calcular la utilidad neta real del mes. Dashboard admin: cards "Perdidas por incidencias del mes", "Utilidad neta real del mes" y "Gastos + perdidas del mes".
- `pnpm db:generate` y `pnpm db:push` aplican el schema.
- `pnpm tsx scripts/_with-env.ts scripts/test-incidents.ts` → 11/11 tests pasan (validacion Zod, integracion con stock DAMAGE/RESTOCK, emision de CustomerCredit, filtros, agregador mensual, transiciones de estado con guardas).
- `pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts` → 7/7 tests previos siguen pasando.
- `pnpm tsx scripts/_with-env.ts scripts/test-order-batch-fifo.ts` → 10/10 tests previos siguen pasando.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera del sprint).
- `pnpm build` → 31/31 paginas, rutas `/incidencias`, `/incidencias/nuevo`, `/incidencias/[id]` registradas.

## Sprint 24 - Dashboard Financiero

### Objetivo

Extender `/dashboard` para responder preguntas de utilidad real, margen, capital inmovilizado y rentabilidad.

### Alcance

- Nuevos agregadores en `lib/dashboard.ts` o modulo financiero separado.
- Filtros por mes, ano, canal, lote y categoria.
- Cards y listas cortas reutilizando componentes actuales.

### Requerimientos Funcionales

- RF-S24-01: Mostrar ventas totales del mes reconocidas por pedidos `PAID`.
- RF-S24-02: Mostrar costo de productos vendidos.
- RF-S24-03: Mostrar utilidad bruta.
- RF-S24-04: Mostrar gastos operativos.
- RF-S24-05: Mostrar utilidad neta.
- RF-S24-06: Mostrar margen neto.
- RF-S24-07: Mostrar valor del stock actual.
- RF-S24-08: Mostrar capital invertido en lotes abiertos.
- RF-S24-09: Mostrar top productos rentables y productos de bajo margen.
- RF-S24-10: Mostrar productos sin rotacion.

### Checklist

- [x] Definir filtros GET.
- [x] Crear agregadores con `select` especificos.
- [x] Evitar cache persistente de datos financieros sensibles.
- [x] Crear cards financieras.
- [x] Crear alertas de margen/lote/rotacion.
- [x] Validar consistencia contra reportes.
- [x] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- El admin puede responder cuanto gano el negocio este mes.
- Los numeros se basan en pedidos `PAID` y costos congelados.
- Gastos mensuales se descuentan de la utilidad neta.

### Notas De Avance

- Sprint 24 cerrado. Version `0.25.0`.
- Modulo `lib/financial-dashboard.ts` con selectores minimos y agregadores puros en centavos enteros:
  - `getFinancialOverview({ year, month, salesChannel, batchId, categoryId })`: revenue, costo, utilidad bruta, fees, empaque, gastos, perdidas por incidencias, utilidad neta real y margen bps del periodo (RF-S24-01 a RF-S24-06). Filtros aplicados solo a ventas; gastos y perdidas comparten el mismo rango temporal.
  - `getStockValuation()`: valor del stock actual a costo aterrizado (promedio ponderado por unidades disponibles) con fallback a `ProductVariant.cost` para stock legado. Desglose por categoria (RF-S24-07).
  - `getOpenBatchCapital()`: inversion total, unidades disponibles/recibidas, valor disponible en lotes no `CLOSED` y desglose por estado (RF-S24-08).
  - `getProductProfitability({ order, limit, ... })`: top o bottom por utilidad bruta acumulada en el periodo. Considera solo lineas con `costSource` BATCH o LEGACY (RF-S24-09).
  - `getLowRotationProducts(days, limit)`: variantes con stock que no registran ventas en el periodo; incluye valor del stock y dias desde la ultima venta (RF-S24-10).
  - `getBatchProfitability({ year, month, limit })`: rentabilidad por lote con unidades vendidas, ingresos, costos asignados, margen y ROI. Solo incluye lotes con ventas reconocidas.
  - `getFinancialAlerts({ year, month })`: margenes por debajo del objetivo, utilidad negativa, productos con margen bajo, productos sin rotacion. `minimumMarginBps` y `objectiveMarginBps` leidos de `BusinessSettings` (con fallback a defaults para entornos sin Next cache).
- `lib/financial-dashboard-shared.ts` con constantes y umbrales cliente-seguros: `LOW_ROTATION_THRESHOLD_DAYS`, `DEFAULT_TOP_PRODUCTS_LIMIT`, `MARGIN_BPS_LOW_THRESHOLD`, `MARGIN_BPS_HIGH_THRESHOLD`. Tambien expone `safeSalesChannel`, `safeAllString`, `safeYearMonth`, `monthRange` y `SALES_CHANNEL_FILTER_OPTIONS`.
- `getFinancialAlerts` lee settings via `prisma.businessSettings.findUnique` (no via `unstable_cache`) para mantener compatibilidad con tests fuera de Next. El resto del dashboard sigue consumiendo `getSettings()` cacheado.
- Filtros GET en `/dashboard`: `year`, `month`, `salesChannel`, `batchId`, `categoryId`. Se aplican al overview, top/bottom productos y rentabilidad por lote. El panel de stock y rotacion operan sobre el estado actual (sin filtro temporal).
- UI `/dashboard` para ADMIN:
  - Filtros financieros persistentes en la URL.
  - Cards de overview: ventas, costo, utilidad bruta, gastos, perdidas, fees, empaque y utilidad neta real con margen en bps.
  - Cards de stock: valor total, unidades, fallback legado, capital en lotes, inversion acumulada, conteo por estado.
  - Tabla de stock valorizado por categoria.
  - Tabla de rentabilidad por lote (lote, unidades vendidas, ingreso, utilidad, margen, ROI).
  - Top productos rentables / productos con menor margen.
  - Productos sin rotacion (dias desde la ultima venta y valor en stock).
  - Lista de alertas (margen bajo, utilidad negativa, sin rotacion, margen por debajo del objetivo).
- Componentes nuevos: `components/dashboard/financial-filters.tsx`, `components/dashboard/financial-overview-cards.tsx`, `components/dashboard/financial-alerts.tsx`.
- Sin cache persistente: cada render del dashboard ejecuta los agregadores. Los filtros viven en la URL (searchParams) sin estado en proceso.
- Tests: `scripts/test-financial-dashboard.ts` con 12 tests de dominio (12/12 pasan) que cubren `monthRange`, `safeYearMonth`, `safeSalesChannel`, overview con y sin filtro de canal, valorizacion de stock, capital en lotes, top/bottom productos, baja rotacion, rentabilidad por lote y alertas.
- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings preexistentes fuera del sprint).
- `pnpm build` → 31/31 paginas, ruta `/dashboard` registra los parametros GET esperados.

## Sprint 25 - Reportes Financieros Y Exportacion

### Objetivo

Extender `/reportes` con reportes financieros descargables.

### Alcance

- Nuevas secciones en `app/(dashboard)/reportes/page.tsx`.
- Agregadores en `lib/reports.ts` o submodulo financiero.
- Exportacion CSV como primer objetivo.
- Base futura para Excel si se decide agregar dependencia.

### Requerimientos Funcionales

- RF-S25-01: Reporte de ventas por mes.
- RF-S25-02: Reporte de utilidad por producto.
- RF-S25-03: Reporte de rentabilidad por lote.
- RF-S25-04: Reporte de stock valorizado.
- RF-S25-05: Reporte de productos sin rotacion.
- RF-S25-06: Reporte de gastos operativos.
- RF-S25-07: Reporte de clientes.
- RF-S25-08: Reporte de devoluciones y perdidas.
- RF-S25-09: Exportar CSV con filtros activos.

### Checklist

- [ ] Definir contratos de filtros.
- [ ] Crear agregadores financieros.
- [ ] Crear vistas tabulares.
- [ ] Crear utilidad de CSV.
- [ ] Agregar botones de descarga.
- [ ] Verificar totales contra dashboard.
- [ ] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- Reportes descargables en CSV.
- Totales consistentes con dashboard.
- Datos historicos usan costo congelado.

## Sprint 26 - UX, Alertas, Badges Y Responsive Financiero

### Objetivo

Hacer visible el riesgo financiero sin complicar el uso diario del sistema.

### Alcance

- Badges de margen, lote, stock e incidencias.
- Alertas contextuales en venta rapida, lotes, dashboard y reportes.
- Pulido responsive de formularios largos.

### Requerimientos Funcionales

- RF-S26-01: Badge de margen alto si margen >= 30%.
- RF-S26-02: Badge de margen medio si margen esta entre 15% y 29%.
- RF-S26-03: Badge de margen bajo si margen < 15%.
- RF-S26-04: Badge de perdida si utilidad es negativa.
- RF-S26-05: Alerta si se vende por debajo del precio minimo.
- RF-S26-06: Alerta si un lote tiene baja rentabilidad.
- RF-S26-07: Alerta de productos sin rotacion.

### Checklist

- [ ] Crear helpers de clasificacion de margen.
- [ ] Crear componentes badge reutilizables.
- [ ] Integrar alertas en venta rapida.
- [ ] Integrar alertas en lotes.
- [ ] Integrar alertas en dashboard/reportes.
- [ ] Validar mobile.
- [ ] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- Riesgos financieros son visibles antes de operar.
- La UI mantiene el lenguaje visual actual.
- Las pantallas clave funcionan en celular.

## Sprint 27 - Seed Financiero, Pruebas Y Cierre

### Objetivo

Dejar la fase financiera verificable, reproducible y documentada.

### Alcance

- Seed demo financiero.
- Pruebas de dominio o E2E sobre flujos criticos.
- README final actualizado.
- CHANGELOG final de cierre.
- Version final sincronizada.

### Requerimientos Funcionales

- RF-S27-01: Seed con 2 lotes.
- RF-S27-02: Seed con 10 productos o variantes.
- RF-S27-03: Seed con 5 ventas.
- RF-S27-04: Seed con 3 clientes.
- RF-S27-05: Seed con 5 gastos operativos.
- RF-S27-06: Seed con 2 incidencias.
- RF-S27-07: Pruebas para lote rentable, margen bajo, descuento, delivery asumido, lote parcial, lote cerrado y producto danado.

### Checklist

- [ ] Extender `prisma/seed.ts`.
- [ ] Agregar datos demo financieros.
- [ ] Agregar pruebas de costeo.
- [ ] Agregar pruebas de FIFO.
- [ ] Agregar pruebas de utilidad mensual por `PAID`.
- [ ] Agregar pruebas de gastos mensuales.
- [ ] Ejecutar `pnpm verify`.
- [ ] Ejecutar `pnpm test:e2e`.
- [ ] Actualizar README, CHANGELOG y version.

### Criterios De Salida

- `pnpm verify` pasa.
- `pnpm test:e2e` pasa o queda documentado el bloqueo.
- El sistema responde las preguntas financieras principales del negocio.

## Preguntas Que El Sistema Debe Responder Al Cierre

- Cuanto gane este mes realmente.
- Que lote fue mas rentable.
- Que producto dejo mas utilidad.
- Que producto se vende con poco margen.
- Cuanto dinero hay en stock.
- Cuanto capital esta detenido.
- Que productos no estan rotando.
- Cuanto se gasta en publicidad mensual.
- Cuanto cuestan realmente los envios.
- Cual es el margen neto por canal.
- Que clientes compran mas.

## Plantilla Para Cerrar Un Sprint

Usar esta plantilla al final de cada sprint dentro de `CHANGELOG.md` y como resumen de sesion.

```md
## [X.Y.Z] - Sprint NN - Nombre del sprint

### Anadido
- ...

### Cambiado
- ...

### Corregido
- ...

### Seguridad
- ...

### Verificacion
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test:e2e` si aplica
```

## Registro De Avance Rapido

| Fecha | Sprint | Responsable | Avance | Bloqueos |
| --- | --- | --- | --- | --- |
| 2026-06-26 | Sprint 17 | OpenCode | Plan financiero documentado, decisiones finales registradas | Ninguno |
| 2026-06-26 | Sprint 18 | OpenCode | Configuracion financiera base: enums, schema, defaults, validaciones, action, UI, seed y docs | Ninguno |
| 2026-06-26 | Sprint 19 | OpenCode | Lotes de importacion MVP: ImportBatch/ImportBatchItem, codigo LOTE-YYYY-NNN, CRUD con auditoria, UI /lotes y proteccion por rol | Ninguno |
| 2026-06-26 | Sprint 20 | OpenCode | Motor de costeo: funciones puras (BY_VALUE/BY_WEIGHT/MIXED), recalculateBatchAction con Serializable, UI con precio min/sug/margen y subtotal aterrizado, 27 tests de dominio | Ninguno |
| 2026-06-26 | Sprint 20 fix | OpenCode | Reconciliacion financiera: header sincronizado con items, `largest remainder`, `additionalSubtotalPen`, subtotales aterrizados autoritativos | Ninguno |
| 2026-06-26 | Sprint 21 | OpenCode | Integracion lote-stock-venta FIFO: OrderItemBatchAllocation, snapshots en OrderItem/Order, FIFO transaccional, reconocimiento de utilidad al pasar a PAID, 10 tests de dominio y 7 flujos Playwright | Ninguno |
| 2026-06-26 | Sprint 22 | OpenCode | Gastos operativos mensuales: modelo Expense con soft delete, enums de categoria/tipo/estado, actions CRUD con auditoria, /gastos con tabla y filtros, dashboard admin con utilidad neta real del mes, 7 tests de dominio | Ninguno |
| 2026-06-26 | Sprint 23 | OpenCode | Incidencias, devoluciones, danos y perdidas: modelo Incident con soft delete, integracion transaccional con stock (RESTOCK/DAMAGE/LOSS) y creditos (CREDIT), /incidencias con tabla y filtros, dashboard admin con perdidas del mes descontadas de la utilidad neta real, 11 tests de dominio | Ninguno |
| 2026-06-26 | Sprint 24 | OpenCode | Dashboard financiero: agregadores en lib/financial-dashboard.ts (overview, valor de stock, capital en lotes, top/bottom productos, baja rotacion, rentabilidad por lote, alertas), filtros GET (year, month, salesChannel, batchId, categoryId) en /dashboard para ADMIN, 12 tests de dominio | Ninguno |
