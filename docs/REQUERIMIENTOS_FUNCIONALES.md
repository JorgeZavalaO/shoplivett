# REQUERIMIENTOS_FUNCIONALES.md

# Requerimientos funcionales — Sistema de ventas por TikTok Live para tienda de carteras

## 1. Propósito

Este documento describe los requerimientos funcionales del sistema, alineados al plan de sprints. Cada requerimiento indica qué debe hacer el sistema desde el punto de vista del negocio y de la operación diaria.

---

## 2. Convenciones

| Prefijo | Significado |
|---|---|
| RF-S00 | Requerimientos del Sprint 0 |
| RF-S01 | Requerimientos del Sprint 1 |
| RF-S02 | Requerimientos del Sprint 2 |
| RF-S03 | Requerimientos del Sprint 3 |
| RF-S04 | Requerimientos del Sprint 4 |
| RF-S05 | Requerimientos del Sprint 5 |
| RF-S06 | Requerimientos del Sprint 6 |
| RF-S07 | Requerimientos del Sprint 7 |
| RF-S08 | Requerimientos del Sprint 8 |
| RF-S09 | Requerimientos del Sprint 9 |
| RF-S10 | Requerimientos del Sprint 10 |
| RF-S11 | Requerimientos del Sprint 11 |
| RF-S12 | Requerimientos del Sprint 12 |
| RF-S13 | Requerimientos del Sprint 13 |
| RF-S14 | Requerimientos del Sprint 14 |
| RF-S15 | Requerimientos del Sprint 15 |

---

# Sprint 0 — Base técnica

## RF-S00-01 — Estructura inicial del proyecto

El sistema debe contar con una estructura base en Next.js App Router que separe rutas de autenticación, dashboard, módulos, componentes, librerías, acciones del servidor y modelos Prisma.

## RF-S00-02 — Layout base

El sistema debe mostrar un layout administrativo con sidebar, header, área de contenido y navegación principal.

## RF-S00-03 — Conexión a base de datos

El sistema debe conectarse a Neon PostgreSQL mediante Prisma.

## RF-S00-04 — Variables de entorno

El sistema debe documentar las variables de entorno necesarias en `.env.example`.

---

# Sprint 1 — Autenticación, usuarios y roles

## RF-S01-01 — Inicio de sesión

El sistema debe permitir que un usuario inicie sesión con correo y contraseña.

## RF-S01-02 — Cierre de sesión

El sistema debe permitir cerrar sesión.

## RF-S01-03 — Protección de rutas

El sistema debe impedir el acceso al dashboard a usuarios no autenticados.

## RF-S01-04 — Roles

El sistema debe manejar roles iniciales: `ADMIN`, `SELLER` y `DISPATCH`.

## RF-S01-05 — Usuario administrador inicial

El sistema debe permitir crear un usuario administrador inicial mediante seed.

## RF-S01-06 — Restricción por rol

El sistema debe restringir funcionalidades según rol, validando permisos tanto en UI como en servidor.

---

# Sprint 2 — Configuración del negocio

## RF-S02-01 — Configuración general

El sistema debe permitir administrar parámetros generales del negocio desde una pantalla de configuración.

## RF-S02-02 — Días de reserva configurables

El sistema debe permitir configurar la cantidad de días que dura una reserva. El valor inicial será 5 días.

## RF-S02-03 — Adelanto mínimo configurable

El sistema debe permitir configurar el monto mínimo de adelanto. El valor inicial será S/50.

## RF-S02-04 — Moneda base

El sistema debe manejar PEN como moneda base.

## RF-S02-05 — Configuración de envío gratis

El sistema debe permitir habilitar envío gratis a partir de un monto mínimo configurable.

## RF-S02-06 — Medios de pago habilitados

El sistema debe permitir definir medios de pago habilitados. Inicialmente: Yape y Plin.

## RF-S02-07 — Medios de envío habilitados

El sistema debe permitir configurar medios de envío: delivery propio, Olva, Shalom, motorizado por aplicativo, recojo u otros.

## RF-S02-08 — Roles autorizados para validar pagos

El sistema debe permitir configurar qué roles pueden validar pagos. Inicialmente: ADMIN y SELLER.

## RF-S02-09 — Prefijo para códigos de producto

El sistema debe permitir configurar el prefijo usado para generar códigos de variantes. Valor sugerido: CART.

---

# Sprint 3 — Clientes

## RF-S03-01 — Crear cliente

El sistema debe permitir registrar una clienta con nombre y WhatsApp como datos mínimos.

## RF-S03-02 — Evitar duplicidad de WhatsApp

El sistema no debe permitir registrar dos clientas con el mismo número de WhatsApp.

## RF-S03-03 — Editar cliente

El sistema debe permitir editar datos de una clienta.

## RF-S03-04 — Buscar cliente

El sistema debe permitir buscar clientas por nombre o WhatsApp.

## RF-S03-05 — Estado de cliente

El sistema debe permitir marcar clientas como activas, frecuentes, riesgosas o bloqueadas.

## RF-S03-06 — Deuda acumulada

El sistema debe mostrar la deuda acumulada de una clienta sumando saldos pendientes de pedidos activos.

## RF-S03-07 — Crédito disponible

El sistema debe mostrar el crédito disponible de una clienta.

## RF-S03-08 — Historial de cliente

El sistema debe mostrar pedidos, pagos, créditos y envíos asociados a una clienta.

---

# Sprint 4 — Categorías, productos y variantes

## RF-S04-01 — Gestionar categorías

El sistema debe permitir crear, editar, activar y desactivar categorías de carteras.

## RF-S04-02 — Crear producto base

El sistema debe permitir crear un producto base, por ejemplo: Cartera Valentina.

## RF-S04-03 — Crear variante vendible

El sistema debe permitir crear variantes de un producto base, por ejemplo: Cartera Valentina color negro.

## RF-S04-04 — Campos de variante

Cada variante debe poder registrar código, color, material, tamaño, precio de venta, costo, stock, estado y código de barras opcional.

## RF-S04-05 — Código autogenerado

El sistema debe generar códigos únicos para variantes usando reglas del negocio.

## RF-S04-06 — Subir imágenes

El sistema debe permitir subir imágenes de productos y variantes a Vercel Blob.

## RF-S04-07 — Buscar productos y variantes

El sistema debe permitir buscar por nombre, código, categoría, color o estado.

## RF-S04-08 — Ocultar producto o variante

El sistema debe permitir ocultar productos o variantes sin eliminarlos físicamente.

---

# Sprint 5 — Inventario

## RF-S05-01 — Stock por variante

El sistema debe controlar stock total, stock reservado, stock vendido y stock disponible por variante.

## RF-S05-02 — Movimiento de ingreso

El sistema debe registrar movimiento de ingreso cuando se crea stock inicial o se agrega stock.

## RF-S05-03 — Reserva de stock

El sistema debe aumentar stock reservado cuando se crea una separación válida.

## RF-S05-04 — Liberación de stock

El sistema debe liberar stock reservado cuando una reserva vence o se cancela.

## RF-S05-05 — Confirmación de venta

El sistema debe reducir stock reservado y aumentar stock vendido cuando el pedido queda completamente pagado.

## RF-S05-06 — Ajuste manual

El sistema debe permitir ajustes manuales de inventario con motivo obligatorio.

## RF-S05-07 — Historial de movimientos

El sistema debe mostrar historial de movimientos por variante.

## RF-S05-08 — Validación de disponibilidad

El sistema no debe permitir reservar más unidades que el stock disponible.

---

# Sprint 6 — Sesiones de Live

## RF-S06-01 — Crear live

El sistema debe permitir crear una sesión de live indicando nombre, canal, responsable y observaciones.

## RF-S06-02 — Cerrar live

El sistema debe permitir cerrar una sesión de live.

## RF-S06-03 — Impedir ventas en lives cerrados

El sistema no debe permitir registrar pedidos en lives cerrados.

## RF-S06-04 — Resumen de live

El sistema debe mostrar pedidos, ventas, cobros y saldos asociados a un live.

## RF-S06-05 — Live activo

El sistema debe permitir identificar un live activo para registrar ventas rápidamente.

---

# Sprint 7 — Pedidos, reservas y venta rápida

## RF-S07-01 — Crear pedido desde venta rápida

El sistema debe permitir crear un pedido desde una pantalla optimizada para ventas en vivo.

## RF-S07-02 — Asociar pedido a cliente

Todo pedido debe estar asociado a una clienta registrada.

## RF-S07-03 — Asociar pedido a live

Un pedido puede asociarse a una sesión de live.

## RF-S07-04 — Agregar variantes al pedido

El sistema debe permitir agregar una o varias variantes al pedido.

## RF-S07-05 — Calcular totales

El sistema debe calcular subtotal, descuento, costo de envío, total, monto pagado validado y saldo.

## RF-S07-06 — Adelanto obligatorio

El sistema no debe permitir separar productos sin adelanto.

## RF-S07-07 — Validar adelanto mínimo

El sistema debe validar que el adelanto sea mayor o igual al monto mínimo configurado.

## RF-S07-08 — Pago completo si total menor al mínimo

Si el total del pedido es menor o igual al adelanto mínimo, el sistema debe exigir pago completo.

## RF-S07-09 — Fecha de vencimiento de reserva

El sistema debe calcular la fecha de vencimiento usando los días configurados.

## RF-S07-10 — Estado inicial del pedido

Cuando se registra un pedido con pago pendiente de validación, debe quedar en `PAYMENT_VALIDATION_PENDING`.

## RF-S07-11 — Reserva preventiva

Al crear el pedido con adelanto registrado, el sistema debe reservar stock aunque el pago todavía esté pendiente de validación.

---

# Sprint 8 — Pagos y capturas

## RF-S08-01 — Registrar pago

El sistema debe permitir registrar pagos indicando cliente, método, monto, fecha, tipo, número de operación y notas.

## RF-S08-02 — Métodos de pago

El sistema debe soportar inicialmente Yape y Plin.

## RF-S08-03 — Capturas múltiples

El sistema debe permitir subir más de una captura por pago.

## RF-S08-04 — Almacenamiento de capturas

Las capturas deben almacenarse en Vercel Blob.

## RF-S08-05 — Pago pendiente

Todo pago recién registrado debe quedar como pendiente de validación.

## RF-S08-06 — Validar pago

El sistema debe permitir validar pagos a roles autorizados por configuración.

## RF-S08-07 — Rechazar pago

El sistema debe permitir rechazar pagos sin afectar saldos ni stock vendido.

## RF-S08-08 — Aplicar pago a un pedido

El sistema debe permitir aplicar un pago a un pedido.

## RF-S08-09 — Aplicar pago a varios pedidos

El sistema debe permitir aplicar un pago a varios pedidos de la misma clienta.

## RF-S08-10 — Actualizar saldos al validar

Los saldos de pedidos solo deben actualizarse cuando el pago se valida.

## RF-S08-11 — Confirmar pedido pagado

Cuando el monto validado cubre el total del pedido, el pedido debe pasar a `PAID`.

---

# Sprint 9 — Créditos y reservas vencidas

## RF-S09-01 — Detectar sobrepago

El sistema debe detectar cuando el monto validado supera los saldos aplicados.

## RF-S09-02 — Crear crédito por sobrepago

El sistema debe permitir registrar el excedente como crédito disponible para la clienta.

## RF-S09-03 — Registrar devolución

El sistema debe permitir marcar un crédito como devuelto.

## RF-S09-04 — Usar crédito manualmente

El sistema debe permitir aplicar crédito manualmente a un pedido futuro.

## RF-S09-05 — Listar reservas vencidas

El sistema debe listar pedidos reservados que superaron su fecha de vencimiento.

## RF-S09-06 — Cancelar reserva vencida

El sistema debe permitir cancelar manualmente una reserva vencida.

## RF-S09-07 — Liberar stock por vencimiento

Al cancelar una reserva vencida, el sistema debe liberar el stock reservado.

---

# Sprint 10 — Envíos agrupados

## RF-S10-01 — Crear envío

El sistema debe permitir crear un envío para una clienta.

## RF-S10-02 — Asociar varios pedidos

El sistema debe permitir asociar varios pedidos de la misma clienta a un envío.

## RF-S10-03 — Validar misma clienta

El sistema no debe permitir agrupar pedidos de diferentes clientas en un mismo envío.

## RF-S10-04 — Método de envío

El sistema debe permitir seleccionar delivery propio, Olva, Shalom, motorizado, recojo u otro medio configurado.

## RF-S10-05 — Costo de envío

El sistema debe permitir registrar costo de envío.

## RF-S10-06 — Envío gratis

El sistema debe permitir marcar envío gratis si se cumple la regla configurada o si un usuario autorizado lo decide.

## RF-S10-07 — Tracking

El sistema debe permitir registrar agencia y código de seguimiento.

## RF-S10-08 — Estados de envío

El sistema debe manejar estados: pendiente, preparando, listo, enviado, entregado y cancelado.

---

# Sprint 11 — Dashboard

## RF-S11-01 — Métricas del día

El sistema debe mostrar ventas, pagos validados, saldos pendientes y pedidos del día.

## RF-S11-02 — Pagos por validar

El dashboard debe mostrar pagos pendientes de validación.

## RF-S11-03 — Reservas por vencer

El dashboard debe mostrar reservas próximas a vencer.

## RF-S11-04 — Reservas vencidas

El dashboard debe mostrar reservas vencidas.

## RF-S11-05 — Deuda acumulada

El dashboard debe mostrar deuda acumulada de clientas.

## RF-S11-06 — Créditos disponibles

El dashboard debe mostrar créditos disponibles.

## RF-S11-07 — Pedidos listos para despacho

El dashboard debe mostrar pedidos pagados o listos para preparar/enviar.

---

# Sprint 12 — WhatsApp

## RF-S12-01 — Generar mensaje de separación pendiente

El sistema debe generar mensaje para confirmar que la separación está pendiente de validación de pago.

## RF-S12-02 — Generar mensaje de separación confirmada

El sistema debe generar mensaje cuando el adelanto fue validado.

## RF-S12-03 — Generar recordatorio de saldo

El sistema debe generar mensaje para recordar saldo pendiente.

## RF-S12-04 — Generar aviso de reserva por vencer

El sistema debe generar mensaje para avisar que una reserva está por vencer.

## RF-S12-05 — Generar aviso de reserva vencida

El sistema debe generar mensaje para avisar que la reserva venció o será cancelada.

## RF-S12-06 — Generar mensaje de pedido enviado

El sistema debe generar mensaje con agencia y tracking.

## RF-S12-07 — Copiar mensaje

El sistema debe permitir copiar mensajes al portapapeles.

## RF-S12-08 — Abrir WhatsApp Web

El sistema debe abrir WhatsApp Web usando el número de la clienta.

---

# Sprint 13 — Reportes

## RF-S13-01 — Reporte de ventas por fecha

El sistema debe mostrar ventas por rango de fechas.

## RF-S13-02 — Reporte de ventas por live

El sistema debe mostrar resultados comerciales por sesión live.

## RF-S13-03 — Reporte de pagos

El sistema debe mostrar pagos por estado, método y fecha.

## RF-S13-04 — Reporte de saldos pendientes

El sistema debe mostrar clientas y pedidos con saldo pendiente.

## RF-S13-05 — Reporte de créditos

El sistema debe mostrar créditos disponibles, usados y devueltos.

## RF-S13-06 — Reporte de productos más vendidos

El sistema debe mostrar variantes más vendidas.

## RF-S13-07 — Reporte de stock

El sistema debe mostrar stock total, reservado, vendido y disponible.

---

# Sprint 14 — Auditoría

## RF-S14-01 — Registrar auditoría

El sistema debe registrar acciones críticas en una tabla de auditoría.

## RF-S14-02 — Auditar pagos

El sistema debe auditar validación, rechazo y aplicación de pagos.

## RF-S14-03 — Auditar pedidos

El sistema debe auditar creación, anulación y cambio de estado de pedidos.

## RF-S14-04 — Auditar stock

El sistema debe auditar ajustes manuales y movimientos críticos de stock.

## RF-S14-05 — Auditar configuración

El sistema debe auditar cambios en la configuración del negocio.

## RF-S14-06 — Consultar auditoría

El admin debe poder consultar registros de auditoría.

---

# Sprint 15 — Pruebas y despliegue

## RF-S15-01 — Probar venta con adelanto

El sistema debe superar una prueba completa de pedido con adelanto, captura, validación y saldo pendiente.

## RF-S15-02 — Probar pago completo

El sistema debe superar una prueba de pedido pagado completo.

## RF-S15-03 — Probar pago a varios pedidos

El sistema debe superar una prueba donde un pago cubre más de un pedido.

## RF-S15-04 — Probar sobrepago

El sistema debe superar una prueba donde un pago genera crédito o devolución.

## RF-S15-05 — Probar reserva vencida

El sistema debe superar una prueba donde una reserva vencida se cancela y libera stock.

## RF-S15-06 — Probar envío agrupado

El sistema debe superar una prueba donde varios pedidos se agrupan en un envío.

## RF-S15-07 — Documentar instalación

El sistema debe incluir documentación para instalación, variables de entorno, migraciones, seed y deploy.
