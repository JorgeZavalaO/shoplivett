# REQUERIMIENTOS_NO_FUNCIONALES.md

# Requerimientos no funcionales — Sistema de ventas por TikTok Live para tienda de carteras

## 1. Propósito

Este documento define los requerimientos no funcionales del sistema, alineados a los sprints de desarrollo. Incluye criterios de seguridad, rendimiento, mantenibilidad, usabilidad, disponibilidad, integridad de datos, auditoría y despliegue.

---

## 2. Principios generales

- El sistema debe priorizar consistencia de stock, pagos y saldos.
- Las acciones críticas deben validarse en servidor.
- La UI debe ser rápida para operación durante lives.
- El diseño debe ser responsive para uso en laptop, tablet o celular.
- El código debe estar organizado por módulos.
- Las reglas del negocio no deben estar hardcodeadas si son configurables.
- Los errores deben ser claros para usuarios no técnicos.

---

# Sprint 0 — Base técnica

## RNF-S00-01 — Estructura mantenible

El proyecto debe tener una estructura de carpetas clara, separando rutas, componentes, acciones, librerías, tipos y Prisma.

## RNF-S00-02 — Tipado estricto

El sistema debe usar TypeScript con tipado estricto siempre que sea posible.

## RNF-S00-03 — Variables de entorno seguras

Las credenciales y tokens deben almacenarse en variables de entorno y nunca subirse al repositorio.

## RNF-S00-04 — Compatibilidad con Vercel

La arquitectura debe ser compatible con despliegue en Vercel.

## RNF-S00-05 — Reutilización de componentes

La UI debe usar componentes reutilizables basados en shadcn/ui.

---

# Sprint 1 — Seguridad y autenticación

## RNF-S01-01 — Contraseñas seguras

Las contraseñas deben almacenarse usando hash seguro. Nunca deben guardarse en texto plano.

## RNF-S01-02 — Protección de rutas

Todas las rutas internas deben estar protegidas por sesión.

## RNF-S01-03 — Validación en servidor

Las acciones sensibles deben validar usuario y rol en servidor, no solo en frontend.

## RNF-S01-04 — Sesiones seguras

La sesión debe contener solo datos necesarios: id, correo, nombre y rol.

## RNF-S01-05 — Principio de mínimo privilegio

Cada rol debe acceder únicamente a las funcionalidades necesarias.

---

# Sprint 2 — Configuración del negocio

## RNF-S02-01 — Configuración centralizada

Las reglas configurables deben leerse desde una entidad central de configuración.

## RNF-S02-02 — Valores por defecto

El sistema debe crear valores por defecto si la configuración aún no existe.

## RNF-S02-03 — Validación de configuración

Los valores configurables deben validarse con Zod para evitar datos inválidos.

## RNF-S02-04 — Auditoría futura

Los cambios de configuración deben quedar preparados para auditoría.

---

# Sprint 3 — Clientes

## RNF-S03-01 — Normalización de teléfono

Los números de WhatsApp deben guardarse en un formato consistente para evitar duplicados.

## RNF-S03-02 — Privacidad básica

Los datos de clientes deben mostrarse solo a usuarios autenticados.

## RNF-S03-03 — Búsqueda rápida

La búsqueda por nombre o WhatsApp debe responder rápidamente con índices adecuados.

## RNF-S03-04 — No eliminación física preferida

En caso de baja de cliente, se recomienda cambiar estado en vez de eliminar físicamente.

---

# Sprint 4 — Productos y variantes

## RNF-S04-01 — Código único

El código de variante debe ser único y no debe depender de datos que puedan generar colisiones sin control.

## RNF-S04-02 — Imágenes optimizadas

Las imágenes deben almacenarse en Vercel Blob y renderizarse optimizadas en la UI.

## RNF-S04-03 — Escalabilidad de catálogo

La estructura debe permitir crecer de decenas a miles de variantes.

## RNF-S04-04 — Preparación para código de barras

El modelo debe incluir campo opcional de código de barras para futuras integraciones.

## RNF-S04-05 — Categorías activables

Las categorías deben poder desactivarse sin romper productos existentes.

---

# Sprint 5 — Inventario

## RNF-S05-01 — Consistencia de stock

Las operaciones de stock deben ejecutarse de forma transaccional para evitar descuadres.

## RNF-S05-02 — Trazabilidad

Todo cambio de inventario debe generar un movimiento histórico.

## RNF-S05-03 — Validación ante concurrencia

El sistema debe prevenir que dos usuarios reserven simultáneamente más stock del disponible.

## RNF-S05-04 — No confiar en cálculos del frontend

Los cálculos críticos de stock deben realizarse o validarse en servidor.

---

# Sprint 6 — Lives

## RNF-S06-01 — Operación rápida

Las pantallas de live deben cargar rápido y minimizar pasos.

## RNF-S06-02 — Estado consistente

Un live cerrado no debe aceptar nuevas ventas aunque el frontend tenga una vista antigua abierta.

## RNF-S06-03 — Consultas agregadas eficientes

Los resúmenes por live deben usar consultas optimizadas para evitar lentitud.

---

# Sprint 7 — Pedidos y reservas

## RNF-S07-01 — Transacciones para pedidos

Crear pedido, items, pago pendiente y reserva de stock debe ejecutarse dentro de una transacción.

## RNF-S07-02 — Integridad de saldos

Los totales, adelantos y saldos deben calcularse en servidor.

## RNF-S07-03 — Validaciones de negocio en servidor

La regla de adelanto obligatorio debe validarse en servidor.

## RNF-S07-04 — UX para live

La pantalla de venta rápida debe requerir pocos clics, tener buscador rápido y mostrar errores claros.

## RNF-S07-05 — Fechas con zona horaria consistente

Las fechas de vencimiento deben calcularse de forma consistente según la zona horaria del negocio.

---

# Sprint 8 — Pagos y capturas

## RNF-S08-01 — Seguridad de archivos

Las capturas deben almacenarse con rutas controladas y asociadas a pagos.

## RNF-S08-02 — No validar automáticamente capturas

En el MVP, subir captura no debe marcar pago como validado.

## RNF-S08-03 — Transacciones al validar pagos

Validar pago, aplicar monto, actualizar pedido y mover stock debe realizarse de forma transaccional.

## RNF-S08-04 — Control de permisos

Solo roles autorizados por configuración pueden validar pagos.

## RNF-S08-05 — Escalabilidad futura

El modelo debe permitir automatizar validación de pagos en una fase posterior sin rediseñar pagos.

---

# Sprint 9 — Créditos y reservas vencidas

## RNF-S09-01 — Trazabilidad de créditos

Todo crédito debe tener origen identificable: sobrepago, manual o devolución.

## RNF-S09-02 — Aplicación manual controlada

El crédito debe aplicarse manualmente en el MVP para evitar errores automáticos.

## RNF-S09-03 — Reservas vencidas controladas

Las reservas vencidas deben mostrarse claramente antes de liberar stock.

## RNF-S09-04 — Acciones reversibles cuando sea posible

Las cancelaciones y devoluciones deben quedar auditadas para revisión posterior.

---

# Sprint 10 — Envíos agrupados

## RNF-S10-01 — Integridad de agrupación

Un envío no debe permitir pedidos de diferentes clientas.

## RNF-S10-02 — Estados claros

Los estados de envío deben ser explícitos y no ambiguos.

## RNF-S10-03 — Preparación para múltiples agencias

El diseño debe permitir agregar nuevas agencias o métodos de envío sin modificar lógica central.

## RNF-S10-04 — Información visible

El detalle del envío debe mostrar claramente pedidos incluidos, costo, agencia y tracking.

---

# Sprint 11 — Dashboard

## RNF-S11-01 — Carga eficiente

El dashboard debe cargar métricas con consultas agregadas y no traer datos innecesarios.

## RNF-S11-02 — Diferenciación por rol

El contenido del dashboard debe adaptarse según rol.

## RNF-S11-03 — Datos consistentes

Las métricas de dashboard deben coincidir con reportes y listados.

## RNF-S11-04 — Actualización razonable

El dashboard puede actualizarse manualmente o por navegación; no es obligatorio tiempo real en MVP.

---

# Sprint 12 — WhatsApp

## RNF-S12-01 — Mensajes editables en el futuro

Las plantillas deben diseñarse para poder ser editables desde configuración en una fase posterior.

## RNF-S12-02 — No envío automático en MVP

El sistema solo debe copiar mensajes o abrir WhatsApp Web. No debe enviar mensajes automáticamente.

## RNF-S12-03 — Sanitización de variables

Las variables insertadas en mensajes deben limpiarse para evitar textos vacíos o mal formateados.

## RNF-S12-04 — Formato telefónico compatible

El número debe formatearse correctamente para abrir WhatsApp Web.

---

# Sprint 13 — Reportes

## RNF-S13-01 — Consistencia financiera

Los reportes financieros deben basarse en pagos validados, no en pagos pendientes.

## RNF-S13-02 — Filtros eficientes

Los reportes deben filtrar por fecha, estado, cliente, live y método sin degradar la experiencia.

## RNF-S13-03 — Preparación para exportación

La estructura debe permitir exportar a Excel en una fase posterior.

## RNF-S13-04 — No mezclar estados

Los reportes deben diferenciar claramente vendido, cobrado, pendiente, reservado y cancelado.

---

# Sprint 14 — Auditoría

## RNF-S14-01 — Registro inmutable

Los registros de auditoría no deben editarse desde la UI.

## RNF-S14-02 — Datos suficientes

Cada auditoría debe contener usuario, acción, entidad, id de entidad y fecha.

## RNF-S14-03 — Protección de auditoría

Solo ADMIN debe poder consultar auditoría.

## RNF-S14-04 — Bajo impacto

La auditoría no debe volver lentas las acciones principales.

---

# Sprint 15 — Pruebas y despliegue

## RNF-S15-01 — Manejo de errores

El sistema debe mostrar errores claros y no exponer detalles internos sensibles.

## RNF-S15-02 — Estados de carga

Las operaciones lentas deben mostrar loading states.

## RNF-S15-03 — Estados vacíos

Las tablas sin información deben mostrar empty states útiles.

## RNF-S15-04 — Confirmaciones críticas

Acciones como cancelar pedido, liberar stock, validar pago o ajustar inventario deben requerir confirmación.

## RNF-S15-05 — Documentación mínima

El proyecto debe incluir README con instalación, variables de entorno, migraciones, seed y deploy.

## RNF-S15-06 — Respaldo lógico

Antes de operar en producción, debe existir una estrategia básica de respaldo o exportación de datos desde Neon.

## RNF-S15-07 — Compatibilidad responsive

La aplicación debe poder usarse correctamente en desktop y tablets. En celular debe permitir consultas y acciones básicas.

---

## 3. Requerimientos transversales

## RNF-T-01 — Validación con Zod

Todo formulario debe validarse con Zod.

## RNF-T-02 — Server Actions seguras

Toda server action debe validar sesión, permisos y datos de entrada.

## RNF-T-03 — Uso de Decimal para montos

Los montos deben manejarse como Decimal en Prisma para evitar errores de precisión.

## RNF-T-04 — Soft delete preferido

Para entidades importantes, preferir estados como `HIDDEN`, `INACTIVE` o `CANCELLED` antes que eliminar físicamente.

## RNF-T-05 — UI consistente

Usar componentes shadcn/ui y patrones consistentes en formularios, modales, tablas y detalles.

## RNF-T-06 — Accesibilidad básica

Los formularios deben tener labels, mensajes de error y navegación razonable por teclado.

## RNF-T-07 — Performance básica

Listados grandes deben usar paginación, filtros y consultas limitadas.

## RNF-T-08 — Integridad referencial

Las relaciones Prisma deben evitar datos huérfanos en pedidos, pagos, productos, variantes y envíos.
