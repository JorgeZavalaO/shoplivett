# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

## [0.3.0] - 2026-06-10

### Sprint 2 — Configuración del negocio

#### Añadido
- Modelo `BusinessSettings` en Prisma con todos los parámetros configurables del negocio (reservas, moneda, envíos, pagos).
- Página `/configuracion` con formulario completo organizado en 5 secciones: reservas, moneda y catálogo, envíos, pagos.
- Server action `updateSettingsAction` con validación Zod integral y revalidación de caché.
- Capa de acceso a settings (`lib/settings.ts`) con caché en memoria e invalidación automática.
- Funciones helper: `getReservationDays()`, `getMinimumAdvance()`, `getEnabledPaymentMethods()`, `getEnabledShippingMethods()`, `getPaymentValidatorRoles()`, `isPaymentValidator()`, `getFreeShippingRule()`.
- Schema Zod `BusinessSettingsSchema` con validación de decimales, arrays y patrones regex.
- Mapas de etiquetas legibles para métodos de pago y envío.
- Valores por defecto centralizados en `lib/settings-defaults.ts`.
- Seed crea registro `BusinessSettings` por defecto (idempotente).
- Permiso `canManageConfiguration()` restringido a rol ADMIN.

#### Modelo de datos
- Enum `PaymentMethod`: YAPE, PLIN, CASH, OTHER.
- Enum `ShippingMethod`: DELIVERY_PROPIO, OLVA, SHALOM, MOTORIZADO, RECOJO.

---

## [0.2.0] - 2026-06-09

### Sprint 1 — Autenticación, usuarios y roles

#### Añadido
- Sistema de autenticación con Auth.js v5 (Credentials provider, sesión JWT en cookie httpOnly).
- Modelo `User` en Prisma con campos: email, name, passwordHash, role, isActive.
- Modelo `Session` en Prisma para persistencia de sesiones.
- Enum `Role`: ADMIN, SELLER, DISPATCH.
- Página `/login` con formulario, validación por campo, estados de carga y redirección `from`.
- Server actions `loginAction` y `logoutAction`.
- Middleware de protección de rutas (`proxy.ts`) con redirección a `/login?from=...`.
- Layout de dashboard con guard de sesión, sidebar y header.
- Sidebar con navegación filtrada por rol (11 módulos) y estado de sesión.
- Header con menú móvil (Sheet), búsqueda global, menú de usuario y cierre de sesión.
- Sistema de permisos centralizado (`lib/permissions.ts`): `requireUser()`, `requireRole()`, `canValidatePayments()`, `canManageConfiguration()`, `canManageShipments()`, `getCurrentUser()`.
- Hash de contraseñas con bcryptjs.
- Seed con 3 usuarios de desarrollo (admin, seller, dispatch) configurables por variables de entorno.
- Panel de credenciales seed visible solo en modo desarrollo.
- Componente `ModulePlaceholder` para módulos pendientes de implementar.
- Página `/dashboard` con saludo por rol, tarjetas informativas, grid de módulos y roadmap.

---

## [0.1.0] - 2026-06-08

### Sprint 0 — Base técnica

#### Añadido
- Estructura inicial del proyecto con Next.js 16 (App Router) + React 19.
- TypeScript estricto configurado.
- Tailwind CSS 4 + PostCSS.
- Prisma 7 con adapter pg para Neon PostgreSQL.
- shadcn/ui (base-nova) con componentes: avatar, badge, button, card, dropdown-menu, input, separator, sheet, sonner.
- React Hook Form + Zod v4 para formularios.
- Configuración de fuentes Geist.
- Toaster global con Sonner (richColors, posición top-right).
- Utilidad `cn()` (clsx + tailwind-merge).
- Scripts de base de datos: `db:generate`, `db:push`, `db:migrate`, `db:studio`, `db:seed`.
- Variables de entorno documentadas en `.env.example`.
- Enums de dominio compartidos en `types/index.ts`: OrderStatus, PaymentMethod, PaymentStatus, CustomerStatus.
- Documentación de planificación:
  - `docs/PLAN_DESARROLLO_SPRINTS.md` — Plan completo de 16 sprints.
  - `docs/REQUERIMIENTOS_FUNCIONALES.md` — Requisitos funcionales por sprint.
  - `docs/REQUERIMIENTOS_NO_FUNCIONALES.md` — Requisitos no funcionales.
  - `docs/FLUJOS_TRABAJO_MODULOS.md` — Flujos de trabajo por módulo.
- Páginas placeholder para todos los módulos futuros (clientes, productos, inventario, lives, ventas, pedidos, pagos, envíos, reportes).

---

[0.3.0]: https://github.com/anomalyco/shoplivett/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/anomalyco/shoplivett/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/anomalyco/shoplivett/releases/tag/v0.1.0
