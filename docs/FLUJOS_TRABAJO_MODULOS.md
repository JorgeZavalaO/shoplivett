# FLUJOS_TRABAJO_MODULOS.md

# Flujos de trabajo por módulo — Sistema de ventas por TikTok Live para tienda de carteras

## 1. Propósito

Este documento explica cómo deben funcionar los flujos de trabajo principales del sistema por módulo. Está pensado para orientar a agentes de codificación al implementar pantallas, acciones del servidor, validaciones, cambios de estado y reglas de negocio.

---

## 2. Flujo de autenticación

### Módulo

Auth / Usuarios / Roles

### Actor principal

Usuario interno: ADMIN, SELLER o DISPATCH.

### Flujo

1. El usuario abre `/login`.
2. Ingresa correo y contraseña.
3. El sistema valida credenciales con Auth.js.
4. Si las credenciales son válidas, se crea sesión.
5. El sistema redirige a `/dashboard`.
6. El middleware protege rutas internas.
7. Al cerrar sesión, el usuario vuelve al login.

### Validaciones

- El correo debe existir.
- La contraseña debe coincidir con el hash.
- El usuario debe estar activo.
- Las rutas internas requieren sesión.

### Resultado esperado

El usuario accede solo a las funciones permitidas por su rol.

---

## 3. Flujo de configuración del negocio

### Módulo

Configuración

### Actor principal

ADMIN

### Flujo

1. El admin entra a `/configuracion`.
2. El sistema carga la configuración actual.
3. Si no existe configuración, crea valores por defecto.
4. El admin edita días de reserva, adelanto mínimo, envío gratis, medios de pago, medios de envío y roles autorizados para validar pagos.
5. El sistema valida los datos.
6. El sistema guarda los cambios.
7. Las reglas de pedidos, pagos y envíos usan esta configuración.

### Reglas importantes

- Días de reserva inicial: 5.
- Adelanto mínimo inicial: S/50.
- Moneda: PEN.
- Medios de pago iniciales: YAPE y PLIN.
- Validadores de pago iniciales: ADMIN y SELLER.

### Resultado esperado

El sistema puede modificar reglas clave sin cambiar código.

---

## 4. Flujo de gestión de clientes

### Módulo

Clientes

### Actores

ADMIN, SELLER

### Flujo para crear cliente

1. El usuario entra a `/clientes`.
2. Hace clic en “Nuevo cliente”.
3. Ingresa nombre y WhatsApp como mínimo.
4. Opcionalmente registra dirección, distrito, referencia, documento, canal y notas.
5. El sistema normaliza el número de WhatsApp.
6. El sistema valida que no exista otra clienta con el mismo WhatsApp.
7. El sistema guarda la clienta.

### Flujo para consultar cliente

1. El usuario busca por nombre o WhatsApp.
2. Abre el detalle de la clienta.
3. El sistema muestra datos personales, pedidos activos, deuda acumulada, créditos disponibles, pagos y envíos.

### Validaciones

- WhatsApp obligatorio.
- Nombre obligatorio.
- WhatsApp único.
- No mostrar datos a usuarios no autenticados.

### Resultado esperado

La tienda puede identificar rápidamente a una clienta durante el live y consultar su historial.

---

## 5. Flujo de categorías, productos y variantes

### Módulo

Productos

### Actores

ADMIN, SELLER

### Flujo para crear categoría

1. El usuario entra a `/productos/categorias` o sección equivalente.
2. Crea una categoría, por ejemplo: Carteras de mano.
3. El sistema genera slug.
4. La categoría queda activa.

### Flujo para crear producto base

1. El usuario entra a `/productos`.
2. Hace clic en “Nuevo producto”.
3. Ingresa nombre del modelo, descripción y categoría.
4. Opcionalmente sube imagen general.
5. El sistema guarda el producto base.

### Flujo para crear variante

1. El usuario abre un producto base.
2. Hace clic en “Nueva variante”.
3. Ingresa color, material, tamaño, precio, costo y stock inicial.
4. El sistema genera código único.
5. Opcionalmente se sube imagen específica de variante.
6. La variante queda disponible para venta.

### Ejemplo

Producto base:

```txt
Cartera Valentina
```

Variantes:

```txt
CART-MANO-NEG-0001
CART-MANO-BEI-0002
CART-MANO-MAR-0003
```

### Validaciones

- Código de variante único.
- Precio de venta mayor a cero.
- Stock inicial no negativo.
- Categoría activa.

### Resultado esperado

El sistema puede vender variantes concretas de una cartera sin duplicar información innecesaria.

---

## 6. Flujo de inventario

### Módulo

Inventario

### Actores

ADMIN, SELLER con permisos definidos

### Conceptos

| Campo | Significado |
|---|---|
| stock | Cantidad física registrada |
| reservedStock | Cantidad separada |
| soldStock | Cantidad vendida confirmada |
| stockDisponible | stock - reservedStock - soldStock |

### Flujo de ingreso de stock

1. El usuario registra una variante con stock inicial o agrega stock.
2. El sistema aumenta `stock`.
3. El sistema registra movimiento `IN`.

### Flujo de reserva

1. Se crea pedido con adelanto registrado.
2. El sistema valida stock disponible.
3. El sistema aumenta `reservedStock`.
4. El sistema registra movimiento `RESERVE`.

### Flujo de venta confirmada

1. Se valida el pago completo de un pedido.
2. El sistema reduce `reservedStock`.
3. El sistema aumenta `soldStock`.
4. El sistema registra movimiento `SALE`.

### Flujo de cancelación o vencimiento

1. Se cancela una reserva.
2. El sistema reduce `reservedStock`.
3. El sistema registra movimiento `RELEASE` o `CANCEL`.
4. La variante vuelve a estar disponible.

### Validaciones

- No se puede reservar stock negativo.
- No se puede vender más de lo reservado o disponible.
- Las operaciones críticas deben ser transaccionales.

### Resultado esperado

El stock disponible siempre refleja la realidad operativa.

---

## 7. Flujo de sesión Live

### Módulo

Lives

### Actores

ADMIN, SELLER

### Flujo

1. El usuario crea un live con nombre, canal y observaciones.
2. El live queda en estado `OPEN`.
3. Durante el live, se registran pedidos asociados.
4. El sistema acumula ventas, pagos y saldos por live.
5. Al finalizar, el usuario cierra el live.
6. El live pasa a estado `CLOSED`.

### Validaciones

- No se pueden crear ventas en lives cerrados.
- Un pedido puede existir sin live, pero si viene de transmisión debe asociarse al live activo.

### Resultado esperado

La tienda puede medir cuánto vendió y cobró en cada transmisión.

---

## 8. Flujo de venta rápida y separación

### Módulo

Ventas / Pedidos

### Actores

ADMIN, SELLER

### Flujo principal

1. El usuario entra a `/ventas/nueva`.
2. Selecciona live activo.
3. Busca o crea clienta.
4. Busca variante por código, nombre, categoría o color.
5. Agrega una o varias variantes al pedido.
6. El sistema calcula subtotal.
7. El usuario registra descuento si aplica.
8. El usuario registra costo de envío si aplica.
9. El sistema calcula total.
10. El usuario registra adelanto obligatorio.
11. El sistema valida adelanto mínimo desde configuración.
12. El usuario sube una o más capturas si las tiene.
13. El sistema crea pedido.
14. El sistema crea pago pendiente de validación.
15. El sistema reserva stock.
16. El pedido queda en `PAYMENT_VALIDATION_PENDING`.

### Reglas

- No se permite separar sin adelanto.
- Si el total del pedido es menor o igual al adelanto mínimo, se debe pagar completo.
- El vencimiento se calcula sumando los días configurados a la fecha de creación.
- La reserva de stock se realiza preventivamente al registrar el adelanto, aunque el pago no esté validado.

### Estados iniciales posibles

| Caso | Estado del pedido | Estado del pago |
|---|---|---|
| Adelanto con captura pendiente | PAYMENT_VALIDATION_PENDING | PENDING |
| Pago completo pendiente de validar | PAYMENT_VALIDATION_PENDING | PENDING |

### Resultado esperado

La vendedora puede registrar ventas durante el live sin perder control de stock ni pagos.

---

## 9. Flujo de validación de pago

### Módulo

Pagos

### Actores

ADMIN, SELLER si está autorizado por configuración

### Flujo

1. El usuario entra a `/pagos`.
2. Filtra pagos pendientes.
3. Abre un pago.
4. Revisa monto, método, número de operación, cliente y capturas.
5. Decide validar o rechazar.
6. Si valida, el sistema aplica el pago a los pedidos relacionados.
7. El sistema actualiza saldos.
8. Si un pedido queda completamente pagado, pasa a `PAID`.
9. Si el pedido estaba reservado y aún falta saldo, queda como `RESERVED` o `PARTIALLY_PAID`.
10. Si se rechaza, el pago pasa a `REJECTED` y no modifica saldos.

### Validaciones

- Solo roles autorizados pueden validar.
- El pago debe tener cliente.
- El pago debe tener monto mayor a cero.
- Las capturas no validan automáticamente el pago.
- La suma aplicada debe cuadrar con el monto del pago, salvo excedente para crédito o devolución.

### Resultado esperado

Los pagos solo impactan saldos cuando una persona autorizada los valida.

---

## 10. Flujo de pago aplicado a varios pedidos

### Módulo

Pagos / PaymentApplication

### Actores

ADMIN, SELLER autorizado

### Flujo

1. La clienta tiene varios pedidos activos.
2. Envía un solo pago por Yape o Plin.
3. El usuario registra el pago por el monto total.
4. Selecciona los pedidos a los que se aplicará el pago.
5. Define cuánto se aplica a cada pedido.
6. El sistema valida que todos los pedidos pertenezcan a la misma clienta.
7. El sistema guarda las aplicaciones.
8. Al validar el pago, el sistema actualiza cada pedido.

### Ejemplo

```txt
Pago: S/200
Pedido #1001: S/120
Pedido #1002: S/80
```

### Resultado esperado

Un solo pago puede cancelar o amortizar varios pedidos de la misma clienta.

---

## 11. Flujo de sobrepago, crédito y devolución

### Módulo

Créditos

### Actores

ADMIN, SELLER autorizado

### Flujo de crédito

1. La clienta paga más que el saldo aplicado.
2. El sistema detecta excedente.
3. El usuario elige “Registrar como crédito”.
4. El sistema crea crédito disponible para la clienta.
5. El crédito queda visible en el detalle de cliente.
6. En una compra futura, el usuario puede aplicar manualmente el crédito.

### Flujo de devolución

1. La clienta paga de más.
2. El usuario elige “Registrar devolución”.
3. El sistema registra el crédito como devuelto.
4. El crédito ya no queda disponible.

### Validaciones

- El crédito debe estar asociado a una clienta.
- El crédito debe tener origen.
- El crédito no debe aplicarse automáticamente en el MVP.

### Resultado esperado

Los sobrepagos no se pierden y pueden controlarse como crédito o devolución.

---

## 12. Flujo de reservas vencidas

### Módulo

Pedidos / Reservas

### Actores

ADMIN, SELLER

### Flujo

1. El sistema identifica pedidos reservados cuyo `expiresAt` ya pasó.
2. Estos pedidos aparecen en dashboard y listado de reservas vencidas.
3. El usuario revisa la reserva.
4. Puede contactar a la clienta por WhatsApp.
5. Si decide cancelar, confirma la acción.
6. El pedido pasa a `EXPIRED` o `CANCELLED` según regla definida.
7. El sistema libera stock reservado.
8. Se registra movimiento de inventario.

### Recomendación MVP

La cancelación debe ser manual.

### Recomendación futura

Agregar tarea automática diaria para marcar o cancelar reservas vencidas.

### Resultado esperado

Los productos no quedan bloqueados indefinidamente por clientas que no completan pago.

---

## 13. Flujo de envío agrupado

### Módulo

Envíos / Shipment

### Actores

ADMIN, DISPATCH, SELLER si opera despacho

### Flujo

1. La clienta tiene uno o varios pedidos pagados.
2. El usuario entra al módulo de envíos.
3. Selecciona la clienta.
4. El sistema muestra pedidos pagados pendientes de envío.
5. El usuario selecciona uno o varios pedidos.
6. El sistema valida que todos sean de la misma clienta.
7. El usuario selecciona método de envío.
8. Ingresa dirección, distrito, referencia, agencia, tracking y costo si aplica.
9. El sistema evalúa si corresponde envío gratis según configuración.
10. Se crea el envío.
11. El envío pasa por estados: pendiente, preparando, listo, enviado, entregado.

### Validaciones

- No agrupar pedidos de diferentes clientas.
- No enviar pedidos cancelados o vencidos.
- Preferentemente enviar pedidos pagados.

### Resultado esperado

La tienda puede enviar varios pedidos juntos y reducir errores en despacho.

---

## 14. Flujo de dashboard operativo

### Módulo

Dashboard

### Actores

ADMIN, SELLER, DISPATCH

### Flujo

1. El usuario entra al dashboard.
2. El sistema identifica su rol.
3. Carga métricas permitidas para ese rol.
4. Muestra accesos rápidos.
5. El usuario puede navegar a pagos pendientes, reservas vencidas, pedidos listos o productos con bajo stock.

### Métricas sugeridas

- Ventas del día.
- Pagos validados del día.
- Pagos por validar.
- Deuda acumulada.
- Reservas por vencer.
- Reservas vencidas.
- Créditos disponibles.
- Pedidos listos para despacho.
- Stock bajo.

### Resultado esperado

La operación diaria puede controlarse desde una sola pantalla.

---

## 15. Flujo de mensajes por WhatsApp

### Módulo

WhatsApp Templates

### Actores

ADMIN, SELLER, DISPATCH

### Flujo

1. El usuario abre un pedido, pago, reserva o envío.
2. Selecciona una plantilla.
3. El sistema reemplaza variables como cliente, pedido, total, saldo, vencimiento, agencia y tracking.
4. El usuario copia el mensaje o abre WhatsApp Web.
5. El envío del mensaje se realiza manualmente fuera del sistema.

### Plantillas iniciales

- Separación pendiente de validación.
- Separación confirmada.
- Recordatorio de saldo.
- Reserva por vencer.
- Reserva vencida.
- Pago completo validado.
- Pedido listo.
- Pedido enviado.
- Crédito disponible.

### Resultado esperado

La tienda reduce tiempo escribiendo mensajes repetitivos y mantiene comunicación ordenada.

---

## 16. Flujo de reportes

### Módulo

Reportes

### Actores

ADMIN principalmente

### Flujo

1. El admin entra a `/reportes`.
2. Selecciona tipo de reporte.
3. Aplica filtros por fecha, cliente, live, estado o método.
4. El sistema muestra resultados calculados desde pagos validados y pedidos reales.
5. El admin analiza ventas, deudas, créditos, productos vendidos y stock.

### Reportes mínimos

- Ventas por día.
- Ventas por live.
- Pagos por estado.
- Saldos pendientes.
- Créditos disponibles.
- Productos más vendidos.
- Stock actual.

### Resultado esperado

El negocio puede tomar decisiones con información confiable.

---

## 17. Flujo de auditoría

### Módulo

Auditoría

### Actor

ADMIN

### Flujo

1. Un usuario realiza una acción crítica.
2. El sistema registra usuario, acción, entidad, id de entidad, fecha y valores relevantes.
3. El admin puede consultar la auditoría.
4. Los registros no se editan desde la UI.

### Acciones críticas

- Crear pedido.
- Anular pedido.
- Validar pago.
- Rechazar pago.
- Aplicar pago.
- Crear crédito.
- Registrar devolución.
- Ajustar stock.
- Cambiar precio.
- Cambiar configuración.
- Cambiar estado de envío.

### Resultado esperado

La tienda puede revisar qué ocurrió, cuándo y quién realizó cada acción importante.

---

## 18. Flujo completo recomendado de operación diaria

1. El usuario inicia sesión.
2. Revisa dashboard.
3. Crea o abre live activo.
4. Registra productos vendidos durante el live.
5. Crea pedidos con adelanto obligatorio.
6. Sube capturas de Yape/Plin.
7. El stock queda reservado.
8. Revisa pagos pendientes.
9. Valida pagos.
10. El sistema actualiza saldos y estados.
11. Contacta clientas con saldo pendiente por WhatsApp.
12. Cancela reservas vencidas si corresponde.
13. Agrupa pedidos pagados en envíos.
14. Marca pedidos como enviados o entregados.
15. Revisa reportes y saldos al cierre del día.
