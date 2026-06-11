# Changelog

Todos los cambios notables de Shoplivett se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
