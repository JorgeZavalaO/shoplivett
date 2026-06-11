# Changelog

Todos los cambios notables de Shoplivett se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
