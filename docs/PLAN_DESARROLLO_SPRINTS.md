# PLAN_DESARROLLO_SPRINTS.md

# Plan de desarrollo por sprints — Sistema de ventas por TikTok Live para tienda de carteras

## 1. Propósito del documento

Este documento define el plan de desarrollo del sistema web para una tienda de carteras que vende principalmente por TikTok Live. Está pensado para ser colocado en la raíz del proyecto y compartido con agentes de codificación, de modo que puedan desarrollar el sistema por módulos sin perder las reglas del negocio.

El sistema debe permitir gestionar productos, variantes, stock, ventas por live, separaciones con adelanto, pagos por Yape/Plin, validación manual de capturas, deuda por cliente, créditos por sobrepago, pedidos, envíos agrupados y reportes operativos.

---

## 2. Stack técnico definido

| Capa | Tecnología |
|---|---|
| Framework | Next.js App Router |
| Lenguaje | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Formularios | React Hook Form + Zod |
| Tablas | TanStack Table |
| ORM | Prisma |
| Base de datos | Neon PostgreSQL |
| Autenticación | Auth.js |
| Almacenamiento de imágenes | Vercel Blob |
| Notificaciones UI | Sonner |
| Iconos | Lucide React |
| Deploy | Vercel |

---

## 3. Contexto del negocio

La tienda vende carteras mediante transmisiones en vivo, principalmente por TikTok Live. Durante el live, las clientas separan productos y luego envían adelantos o pagos completos por Yape/Plin. Las capturas se reciben por WhatsApp y deben registrarse en el sistema para validación manual.

El sistema no debe comportarse como un ecommerce tradicional inicialmente. Debe funcionar como un administrador interno de ventas en vivo, reservas, pagos, stock y despacho.

---

## 4. Reglas de negocio confirmadas

### 4.1 Productos

- El negocio vende carteras.
- Algunos productos pueden ser únicos.
- Otros productos pueden tener varias unidades iguales.
- Deben existir categorías configurables.
- Debe existir producto base y variantes.
- Las variantes son las unidades vendibles.
- Una variante puede diferenciarse por color, material, tamaño u otra característica.
- El código de producto/variante debe ser autogenerado a partir de campos configurados.
- Debe quedar preparado un campo para código de barras futuro.

### 4.2 Separaciones

- No se permite separar sin adelanto.
- El adelanto mínimo por defecto es S/50.
- El adelanto mínimo debe ser configurable.
- La vendedora puede registrar un adelanto mayor al mínimo.
- El plazo de reserva por defecto es 5 días.
- Los días de reserva deben ser configurables.
- Si la reserva vence, se puede cancelar y el producto vuelve a estar disponible.
- En el MVP, la cancelación de reservas vencidas puede ser manual.
- En una fase posterior, puede automatizarse con una tarea programada.

### 4.3 Stock

- Al separar un producto, el stock pasa a reservado.
- El stock se descuenta definitivamente al validar el pago completo.
- Si la reserva vence o se cancela, el stock reservado se libera.
- No se debe permitir reservar más unidades que el stock disponible.

### 4.4 Clientes y pedidos

- Una clienta puede tener varios pedidos activos al mismo tiempo.
- Se debe controlar deuda acumulada por cliente.
- También se debe controlar saldo por pedido.
- Varios pedidos de una misma clienta pueden agruparse en un solo envío.

### 4.5 Pagos

- Los medios principales serán Yape y Plin.
- La validación será manual inicialmente.
- El sistema debe permitir automatización futura.
- El permiso para validar pagos debe ser configurable.
- Inicialmente pueden validar ADMIN y SELLER.
- Se debe registrar número de operación cuando aplique.
- Los pagos deben estar relacionados con una clienta registrada.
- Un pago puede tener más de una captura.
- Un pago puede cubrir uno o varios pedidos.
- Si una clienta paga de más, el excedente puede devolverse o quedar como crédito para una siguiente compra.

### 4.6 Envíos

- El envío puede ser gratuito si supera cierto monto configurable.
- El envío también puede cobrarse antes de enviarse.
- Los medios de envío pueden ser delivery propio, Olva, Shalom, motorizado por aplicativo, recojo u otros configurables.
- Un envío puede agrupar varios pedidos de la misma clienta.

---

## 5. Roles iniciales

| Rol | Descripción |
|---|---|
| ADMIN | Acceso completo. Puede configurar el sistema, validar pagos, anular pedidos, ajustar stock y ver reportes. |
| SELLER | Registra clientes, productos, ventas, pagos y puede validar pagos si la configuración lo permite. |
| DISPATCH | Gestiona preparación, envíos y entregas. No modifica pagos ni precios. |

---

## 6. Capas de desarrollo

Los sprints se organizan en capas para facilitar el trabajo por agentes:

| Capa | Sprints | Objetivo |
|---|---|---|
| Capa 1 — Base técnica | 0, 1 | Proyecto, layout, Auth.js, Prisma, Neon, roles. |
| Capa 2 — Configuración y dominio comercial | 2, 3, 4 | Configuración, clientes, categorías, productos y variantes. |
| Capa 3 — Inventario y ventas live | 5, 6, 7 | Stock, sesiones live, reservas y pedidos. |
| Capa 4 — Pagos y deuda | 8, 9 | Pagos, capturas, aplicación a pedidos, créditos y vencimientos. |
| Capa 5 — Operación y despacho | 10, 11, 12 | Envíos agrupados, dashboard y WhatsApp. |
| Capa 6 — Reportes, auditoría y cierre | 13, 14, 15 | Reportes, auditoría, pruebas y despliegue. |

---

# Sprint 0 — Preparación del proyecto

## Objetivo

Inicializar el proyecto y dejar preparada la base técnica para construir módulos internos.

## Entregables

- Proyecto Next.js App Router.
- TypeScript configurado.
- Tailwind CSS configurado.
- shadcn/ui instalado.
- Prisma configurado.
- Conexión a Neon PostgreSQL.
- Variables de entorno documentadas.
- Layout base del dashboard.
- Estructura inicial de carpetas.

## Tareas técnicas

- Crear proyecto con Next.js.
- Instalar dependencias base.
- Configurar Prisma Client.
- Configurar `.env.example`.
- Crear estructura de carpetas:

```txt
/app
  /(auth)
    /login
  /(dashboard)
    /dashboard
    /clientes
    /productos
    /inventario
    /lives
    /ventas
    /pedidos
    /pagos
    /envios
    /reportes
    /configuracion

/components
  /ui
  /layout
  /forms
  /tables
  /dashboard

/lib
  auth.ts
  prisma.ts
  validations.ts
  permissions.ts
  blob.ts
  utils.ts

/actions
/prisma
/types
```

## Criterios de aceptación

- El proyecto corre en local.
- Prisma conecta correctamente con Neon.
- El dashboard base carga sin errores.
- El sidebar y header se renderizan correctamente.
- Existe `.env.example` con las variables necesarias.

---

# Sprint 1 — Autenticación, usuarios y roles

## Objetivo

Implementar autenticación segura con Auth.js y control básico por roles.

## Entregables

- Login funcional.
- Logout.
- Middleware de rutas protegidas.
- Modelo User.
- Roles iniciales.
- Usuario administrador por seed.

## Tareas técnicas

- Configurar Auth.js con Credentials Provider.
- Implementar hash de contraseña.
- Crear sesión con `userId`, `email`, `name` y `role`.
- Crear middleware para proteger rutas del dashboard.
- Crear seed inicial de administrador.
- Implementar helpers de permisos.

## Criterios de aceptación

- Un usuario autenticado puede entrar al dashboard.
- Un usuario no autenticado es redirigido al login.
- El rol queda disponible en sesión.
- El sistema tiene usuario admin inicial.
- Las acciones sensibles validan sesión en servidor.

---

# Sprint 2 — Configuración del negocio

## Objetivo

Crear una sección de configuración para que las reglas principales no estén hardcodeadas.

## Entregables

- Módulo de configuración.
- Modelo `BusinessSettings`.
- Valores por defecto.
- Pantalla `/configuracion`.
- Server actions para actualizar configuración.

## Configuraciones mínimas

| Campo | Valor inicial sugerido |
|---|---|
| Días de reserva | 5 |
| Adelanto mínimo | S/50 |
| Moneda | PEN |
| Permitir crédito por sobrepago | Sí |
| Permitir devolución | Sí |
| Envío gratis habilitado | Sí |
| Monto mínimo para envío gratis | Definir en UI |
| Prefijo de código de producto | CART |
| Roles que validan pagos | ADMIN, SELLER |
| Medios de pago habilitados | YAPE, PLIN |
| Medios de envío habilitados | Delivery propio, Olva, Shalom, motorizado, recojo |

## Criterios de aceptación

- El sistema crea configuración por defecto si no existe.
- El admin puede editar días de reserva y adelanto mínimo.
- Las reglas de pedidos leen valores desde configuración.
- Las reglas de pagos leen roles desde configuración.

---

# Sprint 3 — Clientes

## Objetivo

Gestionar clientas, historial, deuda acumulada y crédito disponible.

## Entregables

- CRUD de clientes.
- Búsqueda por nombre y WhatsApp.
- Vista de detalle.
- Indicador de deuda acumulada.
- Indicador de crédito disponible.

## Tareas técnicas

- Crear modelo `Customer`.
- Crear modelo `CustomerCredit`.
- Normalizar número de WhatsApp.
- Evitar duplicados por teléfono.
- Crear cards de deuda y crédito en detalle.
- Preparar relaciones con pedidos, pagos y envíos.

## Criterios de aceptación

- Se puede registrar clienta.
- No se duplican teléfonos.
- Se puede consultar deuda acumulada desde pedidos activos.
- Se puede consultar crédito disponible.
- Se puede marcar clienta como activa, frecuente, riesgosa o bloqueada.

---

# Sprint 4 — Categorías, productos y variantes

## Objetivo

Crear el catálogo interno para carteras con categorías configurables, producto base y variantes vendibles.

## Entregables

- CRUD de categorías.
- CRUD de producto base.
- CRUD de variantes.
- Subida de imágenes a Vercel Blob.
- Código autogenerado de variante.
- Campo preparado para código de barras.

## Tareas técnicas

- Crear modelos `Category`, `Product`, `ProductVariant`, `ProductImage`.
- Crear generador de código de variante.
- Permitir imágenes a nivel de producto y variante.
- Crear filtros por categoría, color, estado y stock.
- Agregar campo `barcode` opcional.

## Criterios de aceptación

- Se pueden crear categorías.
- Se puede crear un producto base.
- Se pueden crear variantes por color/material/tamaño.
- Cada variante tiene código único autogenerado.
- Se puede cargar imagen de producto o variante.
- Se puede buscar por código, nombre, categoría o color.

---

# Sprint 5 — Inventario por variante

## Objetivo

Gestionar stock total, reservado, vendido y disponible por variante.

## Entregables

- Modelo `InventoryMovement`.
- Funciones internas de reserva, liberación y venta.
- Historial de movimientos por variante.
- Validación de stock disponible.

## Reglas de stock

```txt
stockDisponible = stock - reservedStock - soldStock
```

## Tareas técnicas

- Implementar `reserveStock(variantId, quantity)`.
- Implementar `releaseStock(variantId, quantity)`.
- Implementar `confirmSaleStock(variantId, quantity)`.
- Implementar `adjustStock(variantId, quantity, reason)`.
- Crear movimientos `IN`, `RESERVE`, `RELEASE`, `SALE`, `CANCEL`, `ADJUSTMENT`.

## Criterios de aceptación

- No se puede reservar más del stock disponible.
- Toda reserva aumenta `reservedStock`.
- Toda liberación reduce `reservedStock`.
- Toda venta validada reduce `reservedStock` y aumenta `soldStock`.
- Todo cambio genera movimiento de inventario.

---

# Sprint 6 — Sesiones de Live

## Objetivo

Crear sesiones de TikTok Live para agrupar ventas y analizar resultados por transmisión.

## Entregables

- Modelo `LiveSession`.
- Listado de lives.
- Creación, apertura, cierre y cancelación de live.
- Vista de detalle del live.

## Criterios de aceptación

- Se puede crear un live.
- Se puede cerrar un live.
- No se pueden registrar pedidos en un live cerrado.
- Se puede ver total vendido, cobrado y pendiente por live.

---

# Sprint 7 — Pedidos, reservas y venta rápida

## Objetivo

Construir el flujo principal de registro de ventas por live.

## Entregables

- Modelo `Order`.
- Modelo `OrderItem`.
- Pantalla de venta rápida.
- Reserva con adelanto obligatorio.
- Fecha de vencimiento calculada.
- Stock reservado al crear pedido.

## Flujo principal

1. Seleccionar live activo.
2. Buscar o crear clienta.
3. Buscar variante por código, nombre o color.
4. Agregar producto al carrito.
5. Calcular subtotal, descuento, envío y total.
6. Registrar adelanto obligatorio.
7. Validar adelanto mínimo según configuración.
8. Subir una o más capturas si existen.
9. Crear pedido.
10. Reservar stock.
11. Crear pago pendiente de validación.
12. Pedido queda como `PAYMENT_VALIDATION_PENDING`.

## Criterios de aceptación

- No se puede crear reserva sin adelanto.
- No se puede crear reserva con adelanto menor al mínimo salvo permiso especial futuro.
- El pedido calcula saldo correctamente.
- El pedido obtiene vencimiento según configuración.
- El stock queda reservado.
- El pago queda pendiente de validación.

---

# Sprint 8 — Pagos, capturas y aplicación a pedidos

## Objetivo

Gestionar pagos manuales, capturas, número de operación y aplicación de pagos a uno o varios pedidos.

## Entregables

- Modelo `Payment`.
- Modelo `PaymentReceipt`.
- Modelo `PaymentApplication`.
- Subida múltiple de capturas.
- Validación y rechazo de pagos.
- Aplicación de pago a varios pedidos.

## Tareas técnicas

- Registrar pago con cliente, método, monto y número de operación.
- Permitir más de una captura por pago.
- Guardar capturas en Vercel Blob.
- Aplicar pago a uno o varios pedidos.
- Validar que la suma aplicada no supere el pago salvo generación de crédito.
- Actualizar saldos solo cuando el pago se valida.

## Criterios de aceptación

- Un pago puede cubrir varios pedidos.
- Un pago puede tener varias capturas.
- El pago pendiente no afecta saldos validados.
- Al validar pago, se actualizan pedidos aplicados.
- Al rechazar pago, no se actualizan saldos.
- Se registra número de operación cuando se ingrese.

---

# Sprint 9 — Créditos, sobrepagos y reservas vencidas

## Objetivo

Controlar créditos por sobrepago, devoluciones y reservas vencidas.

## Entregables

- Gestión de créditos.
- Registro de devolución.
- Panel de reservas vencidas.
- Acción de cancelar reserva vencida.
- Liberación de stock.

## Reglas

- Si un pago validado excede el saldo aplicado, el excedente puede convertirse en crédito o devolución.
- El crédito no se aplica automáticamente al siguiente pedido en el MVP.
- Las reservas vencidas se muestran para cancelación manual.
- Al cancelar reserva vencida, se libera stock.

## Criterios de aceptación

- Se puede registrar crédito por sobrepago.
- Se puede marcar crédito como devuelto.
- Se puede usar crédito manualmente en un pedido futuro.
- Se pueden listar reservas vencidas.
- Al cancelar reserva vencida, se libera stock reservado.

---

# Sprint 10 — Envíos agrupados

## Objetivo

Permitir agrupar varios pedidos pagados de una misma clienta en un solo envío.

## Entregables

- Modelo `Shipment`.
- Modelo `ShipmentOrder`.
- Creación de envío desde uno o varios pedidos.
- Registro de agencia, tracking, costo y estado.
- Cálculo de envío gratis según configuración.

## Criterios de aceptación

- Se puede crear envío para una clienta.
- Se pueden asociar varios pedidos al mismo envío.
- No se deben mezclar pedidos de distintas clientas en un mismo envío.
- Se puede seleccionar delivery propio, Olva, Shalom, motorizado o recojo.
- Se puede marcar como enviado y entregado.

---

# Sprint 11 — Dashboard operativo

## Objetivo

Construir un panel de control para operación diaria.

## Entregables

- Métricas del día.
- Pagos por validar.
- Reservas por vencer.
- Reservas vencidas.
- Deuda acumulada.
- Créditos disponibles.
- Pedidos listos para preparar/enviar.

## Criterios de aceptación

- El dashboard muestra datos reales.
- Las cards enlazan a pantallas filtradas.
- Admin ve métricas financieras.
- Seller ve métricas operativas.
- Dispatch ve pedidos listos para despacho.

---

# Sprint 12 — Mensajes para WhatsApp

## Objetivo

Generar mensajes rápidos para copiar o abrir en WhatsApp Web.

## Entregables

- Plantillas iniciales.
- Botón copiar mensaje.
- Botón abrir WhatsApp Web.
- Variables dinámicas.

## Plantillas mínimas

- Separación pendiente de validación.
- Separación confirmada.
- Recordatorio de saldo.
- Reserva por vencer.
- Reserva vencida.
- Pago completo validado.
- Pedido listo.
- Pedido enviado.
- Crédito disponible.

## Criterios de aceptación

- El mensaje reemplaza variables correctamente.
- Se puede copiar al portapapeles.
- Se puede abrir WhatsApp Web con el número de la clienta.

---

# Sprint 13 — Reportes

## Objetivo

Crear reportes básicos para seguimiento comercial y operativo.

## Entregables

- Ventas por día.
- Ventas por live.
- Pagos por estado.
- Saldos pendientes.
- Créditos disponibles.
- Productos más vendidos.
- Clientes frecuentes.
- Stock actual.

## Criterios de aceptación

- Los reportes filtran por fecha.
- Los totales coinciden con pagos validados.
- Se pueden identificar deudas por cliente.
- Se pueden identificar variantes más vendidas.

---

# Sprint 14 — Auditoría y seguridad operativa

## Objetivo

Registrar acciones importantes y reforzar seguridad interna.

## Entregables

- Modelo `AuditLog`.
- Registro de acciones críticas.
- Vista de auditoría para admin.
- Validación de permisos en servidor.

## Acciones auditables

- Crear pedido.
- Anular pedido.
- Validar pago.
- Rechazar pago.
- Aplicar pago a pedido.
- Crear crédito.
- Registrar devolución.
- Ajustar stock.
- Cambiar precio.
- Cambiar configuración.
- Cambiar estado de envío.

## Criterios de aceptación

- Cada acción crítica queda registrada.
- El admin puede consultar auditoría.
- Las acciones críticas validan permisos en servidor.

---

# Sprint 15 — Pulido, pruebas y despliegue

## Objetivo

Estabilizar el sistema para uso real.

## Entregables

- Pruebas de flujos principales.
- Loading states.
- Empty states.
- Manejo de errores.
- Confirm dialogs.
- README.
- Deploy en Vercel.

## Flujos obligatorios a probar

1. Venta con adelanto y validación posterior.
2. Venta pagada completa.
3. Pago aplicado a varios pedidos.
4. Sobrepago convertido en crédito.
5. Reserva vencida cancelada.
6. Envío agrupado de varios pedidos.
7. Rechazo de pago.
8. Ajuste manual de stock.

## Criterios de aceptación

- El sistema funciona en producción.
- Los saldos son correctos.
- El stock no se descuadra.
- Las capturas se almacenan correctamente.
- Los permisos se respetan.
- Los flujos principales no generan errores críticos.

---

## 7. Distribución sugerida por agentes

| Agente | Responsabilidad | Sprints |
|---|---|---|
| Agente Base | Setup, Auth, Layout, permisos | 0, 1 |
| Agente Configuración/Dominio | Settings, clientes, productos, variantes | 2, 3, 4 |
| Agente Inventario/Ventas | Inventario, lives, pedidos, venta rápida | 5, 6, 7 |
| Agente Pagos | Pagos, capturas, aplicaciones, créditos | 8, 9 |
| Agente Operación | Envíos, dashboard, WhatsApp | 10, 11, 12 |
| Agente Control | Reportes, auditoría, pruebas, deploy | 13, 14, 15 |

---

## 8. Recomendación de implementación

No iniciar ventas ni pagos antes de tener estable:

1. Auth y roles.
2. Configuración del negocio.
3. Clientes.
4. Productos y variantes.
5. Inventario por variante.

El modelo de datos debe definirse con cuidado antes de implementar el flujo de pedidos, porque pagos múltiples, capturas múltiples, créditos y envíos agrupados dependen de relaciones correctas.
