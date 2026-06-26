# Changelog

Todos los cambios notables de Shoplivett se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
