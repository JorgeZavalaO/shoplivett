# Guía completa de uso de Shoplivett

## Control del documento

| Dato | Valor |
|---|---|
| Sistema | Shoplivett |
| Versión revisada | 0.41.0 |
| Última revisión | 18 de julio de 2026 |
| Audiencia | Administradores, vendedoras y personal de despacho |
| Alcance | Uso funcional del sistema web, módulo por módulo |

Esta guía explica las funciones disponibles en la interfaz actual. No es una
guía de instalación ni una especificación técnica. Para despliegue,
observabilidad, respaldo y recuperación, consultar
[`OPERACIONES_PRODUCCION.md`](./OPERACIONES_PRODUCCION.md).

## Índice

1. [Objetivo y conceptos principales](#1-objetivo-y-conceptos-principales)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Navegación y controles comunes](#3-navegación-y-controles-comunes)
4. [Inicio y cierre de sesión](#4-inicio-y-cierre-de-sesión)
5. [Dashboard](#5-dashboard)
6. [Configuración del negocio](#6-configuración-del-negocio)
7. [Clientes](#7-clientes)
8. [Categorías](#8-categorías)
9. [Productos, variantes e imágenes](#9-productos-variantes-e-imágenes)
10. [Lotes de importación y costeo](#10-lotes-de-importación-y-costeo)
11. [Inventario](#11-inventario)
12. [Lives](#12-lives)
13. [Venta rápida](#13-venta-rápida)
14. [Pedidos y reservas](#14-pedidos-y-reservas)
15. [Pagos](#15-pagos)
16. [Créditos y devoluciones](#16-créditos-y-devoluciones)
17. [Envíos](#17-envíos)
18. [Gastos](#18-gastos)
19. [Incidencias](#19-incidencias)
20. [WhatsApp](#20-whatsapp)
21. [Reportes](#21-reportes)
22. [Auditoría](#22-auditoría)
23. [Flujos completos de principio a fin](#23-flujos-completos-de-principio-a-fin)
24. [Rutina diaria recomendada](#24-rutina-diaria-recomendada)
25. [Estados del sistema](#25-estados-del-sistema)
26. [Solución de situaciones frecuentes](#26-solución-de-situaciones-frecuentes)
27. [Limitaciones y precauciones actuales](#27-limitaciones-y-precauciones-actuales)
28. [Mapa de rutas](#28-mapa-de-rutas)
29. [Glosario](#29-glosario)

### Tareas frecuentes

| Necesito | Ir a |
|---|---|
| Registrar una venta | [Venta rápida](#13-venta-rápida) |
| Validar o rechazar un pago | [Pagos](#15-pagos) |
| Procesar una reserva vencida | [Pedidos y reservas](#14-pedidos-y-reservas) |
| Crear y completar un envío | [Envíos](#17-envíos) |
| Registrar mercadería importada | [Lotes de importación y costeo](#10-lotes-de-importación-y-costeo) |
| Corregir inventario | [Inventario](#11-inventario) |
| Registrar una devolución o pérdida | [Incidencias](#19-incidencias) |
| Revisar rentabilidad | [Reportes](#21-reportes) |

---

## 1. Objetivo y conceptos principales

Shoplivett administra la operación de una tienda que vende principalmente por
transmisiones en vivo. Centraliza clientas, catálogo, compras por lote,
inventario, separaciones, pagos, créditos, envíos, gastos, incidencias y
rentabilidad.

### Conceptos que no deben confundirse

| Concepto | Significado |
|---|---|
| Live | Sesión de transmisión que agrupa las ventas realizadas mientras está abierta. |
| Canal de venta | Origen comercial del pedido: TikTok Live, Instagram Live, tienda, WhatsApp u otro. Es independiente del canal del live. |
| Pedido | Venta registrada con productos, total, importe validado, saldo y vencimiento. |
| Reserva | No es un registro separado. Es un pedido pendiente que mantiene unidades separadas en inventario. |
| Pago | Importe recibido que debe ser validado antes de afectar el saldo del pedido. |
| Aplicación | Parte de un pago o crédito asignada a un pedido concreto. |
| Crédito | Saldo a favor de una clienta, reutilizable en pedidos futuros. |
| Envío | Despacho que puede agrupar uno o varios pedidos pagados de una misma clienta. |
| Lote | Compra o importación que registra cantidades, costos y disponibilidad por variante. |
| Costo aterrizado | Costo del producto más la parte que le corresponde de los gastos adicionales del lote. |
| FIFO | Asignación automática del stock desde los lotes más antiguos primero. |

### Convenciones monetarias

- Los importes operativos se muestran en soles como `S/`.
- Los montos usuales admiten como máximo dos decimales.
- El tipo de cambio y algunos costos unitarios de lote admiten cuatro decimales.
- Registrar un pago no equivale a cobrarlo contablemente: el impacto ocurre al
  validarlo.
- La utilidad se reconoce cuando el pedido llega a `Pagado`.

---

## 2. Roles y permisos

El sistema tiene tres roles. Si un usuario intenta abrir una ruta sin permiso,
normalmente vuelve al dashboard.

### Resumen por rol

| Módulo o acción | ADMIN | SELLER | DISPATCH |
|---|:---:|:---:|:---:|
| Dashboard | Sí | Sí | Sí |
| Clientes | Completo | Crear, consultar y editar | No |
| Dar de baja una clienta | Sí | No | No |
| Categorías | Sí | Sí | No |
| Productos y variantes | Sí | Sí | No; el enlace puede aparecer, pero la página no está disponible |
| Inventario | Ver y ajustar | Solo lectura | Sin listado utilizable; acceso directo de solo lectura limitado |
| Lives | Sí | Sí | No; el enlace puede aparecer, pero la página no está disponible |
| Venta rápida | Sí | Sí | No |
| Pedidos y reservas | Sí | Sí | No |
| Registrar pagos | Sí | Sí | No |
| Validar o rechazar pagos | Según configuración | Según configuración | No configurar: no dispone de pantalla de pagos |
| Créditos desde la ficha de cliente | Sí | Sí | No |
| Lotes | Sí | Sí | No |
| Envíos | Sí | No | Sí |
| Gastos | Sí | No | No |
| Incidencias | Sí | No | No |
| Reportes financieros | Sí | No | No |
| Auditoría | Sí | No | No |
| Configuración | Sí | No | No |

### Responsabilidad recomendada

**ADMIN**

- Configura las reglas del negocio.
- Controla inventario, costos, gastos e incidencias.
- Valida pagos cuando esté autorizado.
- Revisa rentabilidad, reportes y auditoría.
- Ejecuta acciones sensibles como dar de baja clientas.

**SELLER**

- Registra y mantiene clientas.
- Mantiene catálogo, lives y lotes.
- Registra ventas, pagos y créditos.
- Da seguimiento a saldos y reservas.
- Valida pagos solo si la configuración lo permite.

**DISPATCH**

- Revisa pedidos pagados listos para despacho desde el dashboard.
- Crea, prepara, envía, entrega o cancela envíos.
- No administra pagos, pedidos ni datos completos de clientas.

> La visibilidad de una opción en el menú no reemplaza el permiso real de la
> página o de la acción. Consultar también [Limitaciones y precauciones
> actuales](#27-limitaciones-y-precauciones-actuales).

---

## 3. Navegación y controles comunes

### Menú principal

- En escritorio, el menú aparece en la barra lateral izquierda.
- En móvil, se abre desde el botón de menú del encabezado.
- Solo se muestran las entradas permitidas por la matriz de navegación del rol.
- El menú de cuenta muestra nombre, correo, rol y la acción `Cerrar sesión`.
- No existe un buscador global. Cada módulo tiene sus propios filtros.

### Listados

La mayoría de los listados ofrece:

- búsqueda por texto;
- filtros de estado o categoría;
- botón para aplicar o limpiar filtros;
- filas enlazadas al detalle;
- paginación `Anterior` y `Siguiente`;
- entre 20 y 25 registros por página, según el módulo.

### Formularios

- Los campos con `*` son obligatorios.
- Los mensajes debajo de un campo indican qué valor debe corregirse.
- Mientras una operación está en curso, el botón de envío se deshabilita.
- Las operaciones sensibles muestran un diálogo de confirmación.
- Los avisos emergentes confirman el resultado o explican el error.
- No recargar ni reenviar un formulario mientras su botón indique que está
  procesando.

### Búsquedas asíncronas

En venta, pagos, envíos, lotes e incidencias, escriba al menos dos caracteres y
espere los resultados. Después seleccione una fila; escribir texto sin
seleccionar un resultado no asocia el registro.

### Errores y recursos inexistentes

- `Recurso no encontrado` significa que el registro no existe o fue retirado.
- Un retorno al dashboard suele significar que el rol no tiene permiso.
- Ante un error temporal de concurrencia, vuelva a cargar y repita la operación
  una sola vez con los datos actualizados.

---

## 4. Inicio y cierre de sesión

### Iniciar sesión

1. Abra `/login`.
2. Ingrese el correo y la contraseña asignados.
3. Pulse `Iniciar sesión`.
4. Si llegó desde una página protegida, el sistema intenta devolverlo a esa
   página. En los demás casos abre `/dashboard`.

### Reglas de acceso

- El correo se procesa en minúsculas.
- La contraseña debe tener al menos seis caracteres.
- El usuario debe estar activo.
- Después de cinco intentos fallidos puede aplicarse un bloqueo temporal de 15
  minutos.
- La sesión dura hasta 15 minutos y puede requerir un nuevo inicio de sesión al
  expirar.

### Cerrar sesión

1. Abra el menú de cuenta en el encabezado.
2. Pulse `Cerrar sesión`.
3. El sistema vuelve a `/login`.

No existen pantallas de recuperación de contraseña, cambio de contraseña,
creación de usuarios o administración de sesiones. Estas tareas deben ser
gestionadas por el responsable técnico.

---

## 5. Dashboard

**Ruta:** `/dashboard`

El dashboard es el punto de control inicial. Su contenido cambia según el rol.

### Métricas operativas

| Métrica | Qué representa realmente |
|---|---|
| Ventas del día | Suma de pedidos creados hoy, sin limitarse a pedidos pagados. |
| Pedidos del día | Cantidad de pedidos creados hoy. |
| Pagos validados del día | Importe de pagos que fueron validados hoy. |
| Pagos por validar | Cantidad total de pagos pendientes. |
| Reservas por vencer | Pedidos activos cuyo vencimiento está dentro de las próximas 48 horas. |
| Reservas vencidas | Pedidos activos cuya fecha límite ya pasó. |
| Deuda acumulada | Suma de saldos de pedidos todavía activos. |
| Créditos disponibles | Saldo utilizable de créditos disponibles o parcialmente usados. |
| Listos para despacho | Pedidos pagados sin envío activo. |
| Envíos en proceso | Envíos pendientes, preparando, listos o enviados. |

### Uso por rol

**ADMIN**

1. Revise pagos pendientes y reservas vencidas.
2. Abra las listas rápidas para atender los casos más antiguos.
3. Revise deuda, créditos y pedidos listos para despacho.
4. Use el bloque financiero para analizar el mes.

**SELLER**

1. Revise ventas del día y pagos por validar.
2. Atienda reservas próximas a vencer.
3. Consulte deuda y créditos antes de registrar nuevas operaciones.
4. Abra venta rápida, clientes, pedidos o pagos desde los accesos permitidos.

**DISPATCH**

1. Revise pedidos listos para despacho.
2. Abra directamente el formulario de nuevo envío desde una fila disponible.
3. Revise los conteos de envíos pendientes, preparando, listos y enviados.
4. Continúe el estado de cada envío hasta entregarlo.

### Dashboard financiero de ADMIN

Filtros disponibles:

- año y mes;
- canal de venta;
- lote;
- categoría.

Indicadores principales:

- ventas y pedidos pagados del periodo;
- costo de productos;
- utilidad bruta;
- comisión del medio de pago;
- costo de empaque;
- costo real de envío asumido por el negocio;
- gastos operativos;
- pérdidas y recuperaciones por incidencias;
- utilidad neta real y margen;
- stock valorizado;
- capital en lotes;
- rentabilidad por lote;
- productos con mayor utilidad, menor margen o sin rotación;
- alertas de margen o utilidad.

La utilidad neta real se interpreta así:

```text
Utilidad neta real =
  utilidad de pedidos pagados
  - gastos activos
  - pérdidas de incidencias
  + montos recuperados
```

Algunos bloques representan el estado global actual y no todos obedecen a cada
filtro del periodo. Para análisis detallado use `/reportes`.

---

## 6. Configuración del negocio

**Ruta:** `/configuracion`  
**Rol:** ADMIN

La configuración define las reglas aplicadas a operaciones futuras. No modifica
automáticamente pedidos, reservas ni costos históricos.

### Procedimiento general

1. Abra `Configuración`.
2. Revise todas las secciones del formulario.
3. Modifique únicamente los valores acordados por el negocio.
4. Pulse `Guardar cambios`.
5. Espere la confirmación antes de abandonar la página.

### Valores iniciales

| Regla | Valor inicial |
|---|---|
| Reserva | 5 días |
| Adelanto mínimo | S/ 50.00 |
| Envío gratis | Habilitado desde S/ 150.00 |
| Prefijo de producto | `CART` |
| Pagos | Yape y Plin |
| Validadores | ADMIN y SELLER |
| Tipo de cambio | 3.7500 |
| Márgenes | 15% mínimo y 30% objetivo |
| Asignación de costos | Mixta, 50% por valor y 50% por peso |
| Empaque | S/ 2.00 |
| Comisiones | 0% |

La base de datos del negocio puede contener valores diferentes. Revise siempre
el formulario actual antes de operar.

### Reservas

- `Días de reserva`: entre 1 y 60. Determina la fecha de vencimiento de pedidos nuevos.
- `Adelanto mínimo`: importe mínimo requerido cuando el total lo supera.
- Si el total es menor o igual al adelanto mínimo, la venta exige pago completo.

Valores iniciales: 5 días y S/ 50.00.

### Moneda y catálogo

- `Moneda`: código de tres letras. El valor inicial es `PEN`.
- `Prefijo de código`: 2 a 6 caracteres. Se usa solo en variantes nuevas.
- Cambiar la moneda no cambia actualmente el símbolo `S/` de las pantallas.
- Cambiar el prefijo no renombra códigos existentes.

### Envíos

- Habilitar o deshabilitar la regla de envío gratis.
- Definir el umbral de compra.
- Elegir los métodos visibles al crear un envío.
- El formulario de envío también permite forzar manualmente el envío gratis.

### Pagos

- Elegir métodos habilitados: Yape, Plin, efectivo u otro.
- Elegir roles que pueden validar o rechazar.
- Habilitar crédito por sobrepago.
- Habilitar devoluciones.
- Configurar comisión por método.

> Las comisiones se ingresan en puntos básicos: `100 = 1%`, `150 = 1.5%` y
> `1000 = 10%`. Verifique el texto `Actual` mostrado bajo cada campo.

Debe quedar al menos un método y un rol validador seleccionados. Para mantener
un flujo utilizable desde la interfaz, conserve `ADMIN` o `SELLER` como
validador.

### Tipo de cambio y canales

- El tipo de cambio predeterminado se almacena en Configuración, pero la versión
  0.41.0 no lo precarga en el formulario de nuevo lote. Ingréselo manualmente en
  cada lote.
- Cada lote puede usar un tipo de cambio diferente.
- Canales disponibles al registrar ventas: TikTok Live, Instagram Live, tienda
  física, WhatsApp directo u otro.

### Márgenes

- Margen mínimo: umbral de alerta.
- Margen objetivo: referencia para el precio sugerido.

> Los márgenes también se ingresan en puntos básicos: `1500 = 15%` y
> `3000 = 30%`. No ingrese `15` si desea 15%; eso representa 0.15%.

### Costos y asignación

- Costo estándar de empaque aplicado al reconocer utilidad.
- Distribución de costos por valor, por peso o mixta.
- En modo mixto, los dos porcentajes deben sumar 100.
- El modo manual no está disponible.

---

## 7. Clientes

**Rutas:** `/clientes`, `/clientes/nuevo`, `/clientes/[id]`,
`/clientes/[id]/editar`  
**Roles:** ADMIN y SELLER; la baja es solo ADMIN.

### Buscar una clienta

1. Abra `Clientes`.
2. Busque por nombre o WhatsApp.
3. Abra la fila para ver su ficha.

El listado muestra solo clientas activas y ordena primero las más recientes.

### Crear una clienta

1. Pulse `Nueva clienta`.
2. Registre nombre y WhatsApp.
3. Complete, si corresponde, documento, dirección, distrito, referencia,
   canal y notas.
4. Revise la vista del número normalizado.
5. Guarde el formulario.

Reglas:

- El WhatsApp debe ser un móvil peruano válido.
- Se almacena normalmente como `+519XXXXXXXX`.
- No puede repetirse, ni siquiera si la clienta anterior fue dada de baja.
- La clienta se crea activa y con estado comercial `Activa`.

### Editar datos

1. Abra la ficha.
2. Pulse `Editar`.
3. Actualice datos personales, dirección, canal, notas o estado.
4. Guarde y compruebe la ficha.

Una clienta dada de baja no puede editarse desde la pantalla normal.

### Estados comerciales

| Estado | Uso recomendado | Efecto automático |
|---|---|---|
| Activa | Operación normal | Permite venta. |
| Frecuente | Clienta recurrente | Etiqueta informativa. |
| Riesgosa | Requiere seguimiento | Etiqueta informativa. |
| Bloqueada | No aceptar nuevas ventas | La venta rápida queda bloqueada sin excepción de rol. |

Para cambiarlo, seleccione el estado en la ficha y pulse `Actualizar estado`.
El estado comercial es distinto de dar de baja.

### Dar de baja

1. Un ADMIN abre la ficha.
2. Pulsa `Dar de baja`.
3. Revisa la confirmación.
4. Confirma la acción.

La baja es lógica: conserva pedidos, pagos, créditos, envíos y auditoría. No
existe reactivación desde la interfaz actual.

El botón puede aparecer también a SELLER, pero la acción efectiva es exclusiva
de ADMIN.

### Contenido de la ficha

- deuda acumulada;
- crédito disponible;
- datos de contacto y despacho;
- historial paginado de pedidos y pagos;
- historial de créditos y sus aplicaciones;
- historial de envíos;
- acciones de WhatsApp;
- formularios de crédito manual, aplicación y devolución.

Antes de una nueva venta, revise siempre estado, deuda y créditos disponibles.

---

## 8. Categorías

**Rutas:** `/categorias`, `/categorias/nueva`,
`/categorias/[id]/editar`  
**Roles:** ADMIN y SELLER

Las categorías agrupan productos y participan en los códigos de variantes. Se
accede normalmente desde el módulo de productos.

### Crear

1. Abra `Productos` y entre a `Categorías`.
2. Pulse `Nueva categoría`.
3. Ingrese un nombre de 2 a 60 caracteres.
4. Revise la vista previa del slug.
5. Guarde.

El sistema genera un slug sin acentos y agrega un sufijo si ya existe.

### Editar

1. Pulse `Editar` en la categoría.
2. Cambie el nombre.
3. Guarde.

El slug se regenera, pero los códigos de variantes existentes no cambian.

### Activar o desactivar

1. Use el botón de estado en la tabla.
2. Confirme la operación.

Una categoría inactiva no se ofrece para altas nuevas, pero sus productos
existentes no se desactivan automáticamente. Use la acción de la tabla para
desactivar; no confíe en desmarcar el checkbox de edición.

---

## 9. Productos, variantes e imágenes

**Rutas principales:** `/productos`, `/productos/nuevo`, `/productos/[id]`  
**Roles efectivos:** ADMIN y SELLER

### Estructura del catálogo

- Producto: modelo general, descripción, categoría e imágenes.
- Variante: unidad vendible con color, material, tamaño, precio, costo, stock,
  código y código de barras.
- Todo producto tiene al menos una variante, incluso si comercialmente no se
  distingue por color o talla.

### Buscar productos

1. Abra `Productos`.
2. Busque por nombre o código de variante.
3. Opcionalmente filtre por categoría.
4. Abra `Ver`.

El listado normal muestra productos activos.

### Crear producto y variantes en una pantalla

1. Pulse `Nuevo producto`.
2. Complete nombre, categoría y descripción opcional.
3. Elija `Sin variantes` o `Con variantes`.
4. Por cada variante complete:
   - color, material y tamaño si aplican;
   - precio de venta obligatorio;
   - costo legado opcional;
   - stock inicial;
   - código de barras opcional.
5. Adjunte opcionalmente una imagen PNG, JPEG o WebP de hasta 5 MB.
6. Revise todas las filas y guarde.

El sistema crea producto, variantes, códigos, movimientos de stock inicial e
imagen principal en una sola operación.

### Código de variante

El formato general es:

```text
PREFIJO-CATEGORIA-COLOR-NNNN
```

Ejemplo: `CART-MANO-NEG-0001`. Es único y no se puede editar después.

### Detalle del producto

La ficha tiene tres pestañas:

- `Información`: descripción, categoría, fechas y estado.
- `Variantes`: códigos, atributos, stock, precio, alta y cambio de estado.
- `Imágenes`: imagen principal y secundarias.

### Editar producto

1. Abra el detalle y pulse `Editar`.
2. Cambie nombre, descripción o categoría.
3. Guarde.

Para desactivar o reactivar use la acción de ciclo de vida del detalle. Un
producto inactivo deja de aparecer en catálogo, inventario y venta rápida, pero
conserva toda su información.

### Agregar o editar una variante

1. Abra la pestaña `Variantes`.
2. Pulse `Nueva variante` o edite una existente.
3. Complete atributos, precio, costo, stock inicial y barcode.
4. Guarde.

El stock de una variante existente no se edita aquí; use Inventario o Lotes.
Los cambios de precio quedan registrados en auditoría.

### Estados de variante

| Estado | Resultado |
|---|---|
| Activa | Puede venderse y agregarse a lotes. |
| Oculta | No aparece en venta ni búsqueda de lotes. |
| Archivada | Fuera de operación comercial, pero conserva historial. |

Ocultar o archivar no elimina stock ni movimientos.

### Imágenes

- Se admite PNG, JPEG o WebP de hasta 5 MB por imagen.
- La primera queda como principal.
- Desde la pestaña de imágenes puede marcar otra como principal o eliminarla.
- La carga desde edición agrega una imagen; no reemplaza automáticamente la
  anterior.

---

## 10. Lotes de importación y costeo

**Rutas:** `/lotes`, `/lotes/nuevo`, `/lotes/[id]`  
**Roles:** ADMIN y SELLER

### Preparación previa

Antes de crear un lote:

1. Cree categorías, productos y variantes.
2. Mantenga activas las variantes que agregará.
3. Reúna fecha, persona compradora (`shopper`), agencia, tipo de cambio, costos y cantidades.
4. Defina el método global de distribución en Configuración.

> Registre como recibidas únicamente las unidades que ingresaron físicamente.
> La versión actual no permite aumentar después la cantidad recibida de una
> línea existente. Si la compra llegará en entregas parciales, acuerde el
> procedimiento con el ADMIN antes de crear la línea.

### Crear un lote

1. Abra `Lotes` y pulse `Nuevo lote`.
2. Complete fecha de compra, persona compradora (`shopper`), agencia y tipo de cambio.
3. Ingrese costo total de productos en USD.
4. Ingrese costos adicionales en USD y/o PEN.
5. Busque cada variante por código o nombre y agréguela.
6. Por variante registre:
   - cantidad comprada;
   - cantidad recibida;
   - costo unitario USD;
   - peso unitario.
7. Verifique que la suma de los costos de las líneas coincida exactamente con
   el costo total USD.
8. Guarde.

El sistema genera `LOTE-AÑO-NNN`, crea el lote en `Comprado` e ingresa al
inventario las cantidades declaradas como recibidas.

### Cantidades

| Campo | Significado |
|---|---|
| Comprada | Unidades adquiridas al proveedor. |
| Recibida | Unidades que ingresan al inventario al registrar la línea. |
| Disponible del lote | Unidades todavía no asignadas por FIFO a reservas o ventas. |

La recibida no puede superar la comprada.

### Estados del lote

| Estado | Uso |
|---|---|
| Comprado | Compra registrada. |
| En tránsito | Mercadería en traslado. |
| Completo | Recepción operativamente completada. |
| Cerrado | Lote bloqueado para cambios y recálculo. |

Los cambios no son automáticos. Antes de marcar `Cerrado`, recalcule costos y
revise cada línea. El cierre es terminal en la interfaz.

### Agregar o quitar productos

Mientras el lote no esté cerrado:

1. Use `Agregar producto` para incorporar una variante nueva.
2. Registre cantidades, costo y peso.
3. Para retirar una línea, use la papelera y confirme.

No se puede retirar una línea que ya tenga asignaciones a pedidos. Al agregar o
quitar líneas, el costeo queda pendiente de nuevo cálculo.

### Editar encabezado

Puede modificar fecha, persona compradora, agencia, costos adicionales, tipo de cambio,
estado y notas mientras el lote no esté cerrado.

Después de editar, compruebe si el sistema indica que debe recalcular. Evite
cerrar un lote en la misma operación que modifica datos de costo.

### Recalcular costo aterrizado

1. Abra el detalle.
2. Pulse `Recalcular costos`.
3. Confirme.
4. Revise por línea:
   - costo base;
   - costo adicional asignado;
   - costo aterrizado unitario y total;
   - precio mínimo;
   - precio sugerido;
   - margen del precio actual.

Métodos:

- `Por valor`: reparte según el valor base de cada línea.
- `Por peso`: reparte según el peso total.
- `Mixto`: combina ambos porcentajes configurados.

Un lote sin costeo calculado no debe usarse para vender.

### FIFO automático

El usuario no selecciona el lote durante la venta. Al reservar una variante que
opera con lotes, el sistema:

1. busca lotes con unidades disponibles y costo calculado;
2. ordena los más antiguos primero;
3. consume las unidades necesarias;
4. guarda la asignación y el costo histórico en el pedido;
5. devuelve esas unidades a los mismos lotes si la reserva se cancela o vence.

Una vez pagado el pedido, la asignación y el costo quedan como historial.

> Precaución de la versión 0.41.0: el sistema reduce la disponibilidad del lote
> al asignar FIFO y también registra unidades reservadas en la variante. Esto
> puede hacer que el disponible general mostrado sea menor que las unidades que
> aún aparecen en los lotes. Si ambas cifras no coinciden, detenga nuevas ventas
> de la variante y solicite revisión antes de ajustar stock.

### Costo legado

Si una variante no tiene actualmente ninguna línea de lote, el sistema utiliza
el costo guardado en la variante. En cuanto existe una línea, debe mantener
lotes recibidos y calculados. Quitar la última línea sin asignaciones devuelve
la variante al modo de costo legado.

---

## 11. Inventario

**Rutas:** `/inventario`, `/inventario/[variantId]`  
**Roles:** ADMIN consulta y ajusta; SELLER consulta; DISPATCH debe operar desde
Dashboard y Envíos, salvo un acceso directo limitado de solo lectura.

### Métricas

| Métrica | Descripción |
|---|---|
| Stock | Contador base. Los lotes lo ajustan por diferencias, pero no lo reemplazan automáticamente por la suma disponible de los lotes. Stock legado, ajustes e incidencias pueden dejar cifras distintas. |
| Reservado | Unidades separadas por pedidos aún no completados. |
| Vendido | Unidades confirmadas por pedidos pagados. |
| Disponible visible | `máximo de 0 y stock - reservado - vendido`. |

> En variantes con lotes, FIFO reduce la disponibilidad del lote y el stock, y
> además incrementa reservado; al pagar, esas unidades pasan a vendido. Por ello
> el disponible visible puede volver a descontar unidades reservadas o vendidas
> y bloquear existencias que aún figuran en los lotes. No compense esta
> diferencia con un ajuste manual sin una revisión técnica.

### Consultar inventario

1. Abra `Inventario`.
2. Busque por código, producto o color.
3. Revise stock, reservado, vendido y disponible.
4. Abra una variante para ver atributos y movimientos.

El detalle muestra los movimientos más recientes primero y pagina 25 por vez.

### Movimientos habituales

| Tipo visible | Origen habitual |
|---|---|
| Entrada | Stock inicial, lote recibido, devolución o ajuste positivo. |
| Reserva | Creación de venta rápida. |
| Venta | Pedido que llega a pagado. |
| Ajuste | Corrección manual, daño, pérdida o retiro de línea de lote. |
| Vencimiento | Cancelación o vencimiento de una reserva impaga. |

El historial no se edita.

### Ajuste manual de ADMIN

1. Abra el detalle de la variante.
2. Elija `Ingreso` o `Ajuste`.
3. Ingrese una cantidad entera distinta de cero.
4. Escriba un motivo de 5 a 200 caracteres.
5. Revise el resumen del diálogo.
6. Confirme.

Reglas:

- `Ingreso` solo admite cantidad positiva.
- `Ajuste` puede ser positivo o negativo.
- No puede dejar stock negativo.
- No puede reducir el stock por debajo de lo ya reservado y vendido.

Para variantes administradas por lotes, priorice correcciones desde el lote o
una incidencia correctamente registrada. Un ajuste manual no modifica la
disponibilidad interna de cada lote.

### Efectos de otros módulos

- Crear una venta reserva stock.
- Validar el pago completo mueve reservado a vendido.
- Cancelar o vencer una reserva libera unidades.
- Registrar un lote ingresa unidades recibidas.
- Una devolución puede reducir vendido.
- Un daño o pérdida puede reducir stock.

En variantes con lotes, las devoluciones, daños y pérdidas de Incidencias
modifican los contadores de la variante, pero no reasignan ni descuentan
`Disponible del lote`. Antes de volver a vender, compare Inventario con el
detalle de los lotes afectados.

---

## 12. Lives

**Rutas:** `/lives`, `/lives/nuevo`, `/lives/[id]`,
`/lives/[id]/editar`  
**Roles efectivos:** ADMIN y SELLER

### Crear

1. Abra `Lives` y pulse `Nuevo live`.
2. Ingrese nombre.
3. Elija TikTok, Instagram, Facebook, WhatsApp u otro.
4. Asigne opcionalmente un responsable ADMIN o SELLER.
5. Agregue observaciones.
6. Guarde.

Solo puede existir un live abierto. Si ya hay uno, ciérrelo o cancélelo antes.

### Durante el live

- Venta rápida detecta automáticamente el live abierto.
- No se elige manualmente en cada pedido.
- Si no hay live abierto, la venta puede registrarse sin live.
- El canal comercial del pedido se selecciona aparte.

### Editar

Mientras esté abierto puede cambiar nombre, canal, responsable y notas.

### Cerrar

1. Abra el detalle.
2. Pulse `Cerrar live`.
3. Confirme.

Pasa de `Abierto` a `Cerrado` y deja de asociarse a nuevas ventas. Los pedidos
anteriores se conservan.

### Cancelar

Use esta opción si la sesión no debe continuar. Queda `Cancelada` y tampoco
elimina pedidos ya asociados. No existe reapertura.

### Métricas

El detalle y `Ventas por live` cuentan todos los pedidos vinculados. La cantidad
y el total vendido incluyen también pedidos cancelados o vencidos. `Cobrado`
suma importes validados de pedidos pagados, parcialmente pagados o reservados.
`Pendiente` suma los saldos de esos estados y el total de pedidos todavía
pendientes de validación.

---

## 13. Venta rápida

**Ruta:** `/ventas`  
**Roles:** ADMIN y SELLER

Venta rápida crea en una sola operación el pedido, sus líneas, una reserva de
stock y un pago pendiente por el adelanto.

### Requisitos

- Clienta activa y no bloqueada.
- Variantes y productos activos.
- Stock disponible suficiente.
- Si la variante usa lotes, unidades recibidas con costeo calculado.
- Adelanto que cumpla la configuración.
- Al menos un método y un canal habilitados.

### Registrar una venta

1. Abra `Venta rápida`.
2. Busque y seleccione la clienta.
3. Revise su estado comercial.
4. Busque productos por categoría, código, nombre o color.
5. Agregue variantes al carrito y ajuste cantidades.
6. Revise stock, precio, costo estimado, precio mínimo y margen.
7. Ingrese descuento, si corresponde.
8. Ingrese el importe de envío cobrado dentro del pedido.
9. Registre el adelanto.
10. Elija método de pago y canal de venta.
11. Registre número de operación y notas si existen.
12. Adjunte hasta cinco capturas válidas si corresponde.
13. Revise subtotal, descuento, envío y total.
14. Pulse el botón de registro una sola vez.

### Cálculo

```text
Total = máximo de 0 y (subtotal - descuento + envío)
```

- Si el total es menor o igual al adelanto mínimo, debe adelantarse el total.
- Si es mayor, debe adelantarse al menos el mínimo.
- El adelanto debe ser mayor que cero y no puede superar el total del pedido.
- Un pedido cuyo total calculado sea S/ 0.00 no puede registrarse por este flujo.
- La alerta por precio inferior al mínimo informa un riesgo de margen, pero no
  bloquea por sí sola el registro.

### Resultado

- Pedido en `Pendiente de validación de pago`.
- Pago en `Pendiente`.
- Stock reservado inmediatamente, aunque la captura aún no esté validada.
- Vencimiento calculado con los días de reserva.
- Live abierto asociado automáticamente si todavía continúa abierto.
- Lotes asignados por FIFO cuando aplica.
- Redirección al detalle del pedido.

### Capturas

- Formatos: PNG, JPEG o WebP.
- Máximo: 5 MB por imagen.
- Máximo por operación: 5 archivos y 15 MB en total.
- Las capturas son evidencia; nunca validan el pago automáticamente.

### Si aparece un error de stock o conflicto

1. Lea el aviso emergente.
2. Espere la actualización del catálogo.
3. Revise cantidades y disponibilidad.
4. Retire o sustituya el producto sin stock.
5. Reintente con la información actualizada.

No cree un segundo pedido sin comprobar primero si el anterior llegó a
registrarse.

---

## 14. Pedidos y reservas

**Rutas:** `/pedidos`, `/pedidos/[id]`, `/pedidos/vencidos`  
**Roles:** ADMIN y SELLER

### Buscar y filtrar

En `/pedidos` puede buscar por número o nombre de clienta y filtrar por estado.

### Contenido del detalle

- clienta, WhatsApp, canal y live;
- estado y aviso de vencimiento;
- total, importe validado y saldo;
- productos, cantidades y precios;
- descuento y envío cobrado;
- pagos vinculados directamente y capturas disponibles;
- envío activo;
- notas y plantillas de WhatsApp;
- costos, lotes y utilidad solo para ADMIN.

La tarjeta `Pagos y capturas` no reúne todos los pagos por aplicación. Un pago
manual o multipedido vinculado únicamente mediante aplicaciones puede no
aparecer allí. Revíselo desde `/pagos`, la ficha de la clienta o el detalle del
pago.

### Flujo de estados

```text
Pendiente de validación
  -> Parcialmente pagado, si se valida solo una parte
  -> Pagado, si se cubre todo el saldo
  -> Cancelado, si se cierra manualmente sin dinero validado
  -> Vencido, si pasó la fecha y se procesa el vencimiento
```

El estado `Reservado` existe para pedidos activos sin monto validado, aunque el
flujo normal suele comenzar como pendiente de validación.

### Cancelar una reserva impaga

Disponible únicamente en pedidos `Pendiente de validación` o `Reservado` sin
dinero validado.

1. Abra el pedido.
2. Revise pagos pendientes y confirme que la venta no continuará.
3. Ingrese un motivo opcional.
4. Pulse la acción de cancelación y confirme.

El sistema:

- marca el pedido `Cancelado`;
- deja saldo en cero;
- libera stock y asignaciones FIFO;
- rechaza pagos pendientes exclusivos o retira la aplicación correspondiente;
- conserva el historial.

### Vencer una reserva

No existe vencimiento automático.

1. Abra `Reservas vencidas`.
2. Compruebe que la fecha ya pasó.
3. Contacte a la clienta si corresponde.
4. Ingrese un motivo opcional.
5. Confirme el vencimiento.

El pedido pasa a `Vencido` y libera stock de manera atómica.

No se puede vencer por este mecanismo un pedido parcialmente pagado o pagado.
Mantenga activo un pedido parcialmente pagado y escálelo al ADMIN. El ADMIN debe
decidir si se continuará cobrando; cualquier cierre, devolución o reversión
debe seguir el procedimiento administrativo definido por el negocio. No intente
liberarlo como reserva impaga.

### Pedido pagado

Al cubrir el saldo mediante pagos y/o créditos:

- pasa a `Pagado`;
- el stock reservado pasa a vendido;
- se reconoce costo y utilidad;
- queda disponible para crear un envío.

---

## 15. Pagos

**Rutas:** `/pagos`, `/pagos/nuevo`, `/pagos/[id]`  
**Roles de consulta y registro:** ADMIN y SELLER  
**Validación y rechazo:** roles elegidos en Configuración

### Listado

Puede buscar por clienta, WhatsApp o número de operación y filtrar por
pendiente, validado o rechazado.

### Registrar un pago manual

1. Abra `Pagos` y pulse `Nuevo pago`.
2. Busque y seleccione una clienta activa.
3. Busque sus pedidos pendientes, reservados o parcialmente pagados.
4. Agregue uno o varios pedidos.
5. Indique cuánto aplicar a cada uno.
6. Ingrese monto total y método.
7. Registre número de operación y notas si existen.
8. Adjunte capturas.
9. Guarde.

> Si falla la carga de una captura, el pago puede haberse creado antes de que
> aparezca el error. Busque primero la operación en `/pagos` y compruebe sus
> capturas antes de volver a registrarla, para evitar duplicados.

No existe una acción para adjuntar o reemplazar capturas después de crear el
pago. No duplique la operación; conserve su identificador y solicite asistencia
técnica si falta evidencia.

Reglas:

- Todos los pedidos deben pertenecer a la misma clienta.
- Cada aplicación debe ser positiva y no superar el saldo de ese pedido.
- La suma aplicada no puede superar el monto total del pago.
- Puede quedar una parte sin aplicar; se trata como excedente al validar.
- Registrar el pago no modifica saldos ni stock.

### Editar aplicaciones pendientes

Mientras el pago esté `Pendiente`:

1. Abra su detalle.
2. Edite la sección de pedidos aplicados.
3. Agregue, quite o cambie importes.
4. Deje al menos una aplicación.
5. Revise el resumen y confirme.

No puede editar aplicaciones después de validar o rechazar.

### Validar un pago

1. Abra el detalle.
2. Compruebe clienta, monto, método, operación, capturas y aplicaciones.
3. Si hay monto no aplicado, elija su tratamiento:
   - rechazar la validación;
   - crear crédito;
   - registrar devolución.
4. Confirme la validación.

El sistema:

- marca el pago `Validado`;
- incrementa el monto validado de cada pedido;
- recalcula saldos;
- deja cada pedido parcialmente pagado o pagado;
- confirma stock y utilidad de los pedidos que queden pagados;
- crea el registro de crédito o devolución del excedente si corresponde.

### Pago aplicado a varios pedidos

Ejemplo:

```text
Pago total: S/ 200.00
Pedido A:   S/ 120.00
Pedido B:   S/  80.00
```

Una sola validación actualiza ambos pedidos. No mezcle pedidos de clientas
diferentes.

### Rechazar un pago

1. Revise que la evidencia no sea válida.
2. Pulse `Rechazar`.
3. Escriba un motivo de 5 a 500 caracteres.
4. Confirme.

El pago queda `Rechazado` y no suma dinero validado. Si los pedidos afectados no
tienen dinero validado ni otro pago pendiente que sostenga la reserva, el
sistema puede cancelarlos y liberar su stock. Revise el pedido después.

> Precaución de la versión 0.41.0: la comprobación de otro pago pendiente
> detecta correctamente los pagos vinculados directamente al pedido, pero puede
> omitir un pago manual relacionado solo mediante aplicaciones. Revise todas las
> aplicaciones pendientes de la clienta antes de rechazar.

### Sobrepago

El excedente normalmente es la parte del pago que queda sin aplicar.

- `Crear crédito`: genera saldo disponible para la clienta.
- `Registrar devolución`: deja constancia histórica del monto devuelto, sin
  saldo reutilizable.
- Si la opción elegida está deshabilitada en Configuración, la validación no
  continuará.

---

## 16. Créditos y devoluciones

**Ubicación principal:** ficha `/clientes/[id]`  
**Roles:** ADMIN y SELLER

No existe un módulo independiente de créditos. Se administran en el historial
de la clienta y se consultan globalmente en Reportes.

### Orígenes

| Origen | Cómo se genera |
|---|---|
| Sobrepago | Excedente de un pago validado. |
| Manual | Registro administrativo o crédito emitido por incidencia. |
| Devolución de excedente | Constancia del dinero excedente devuelto; no crea saldo reutilizable. |

### Crear crédito manual

1. Abra la ficha de la clienta.
2. En créditos, pulse `Crédito manual`.
3. Ingrese un monto mayor que cero.
4. Escriba opcionalmente una nota de hasta 500 caracteres. Por control interno,
   documente siempre el sustento.
5. Guarde.

Queda `Disponible`. Use créditos manuales solo con sustento verificable.

### Aplicar crédito a un pedido

1. Elija un crédito disponible o parcialmente usado.
2. Pulse `Aplicar`.
3. Busque un pedido activo de la misma clienta.
4. Ingrese el monto.
5. Confirme.

El sistema usa como máximo el saldo real del pedido, reduce el disponible del
crédito y actualiza el pedido. Si cubre el saldo, el pedido queda pagado y
confirma stock y utilidad.

### Estados

| Estado | Significado |
|---|---|
| Disponible | No se ha usado. |
| Parcialmente usado | Conserva saldo. |
| Usado | Saldo agotado. |
| Devuelto | Crédito usado marcado posteriormente como devuelto. |
| Anulado | Sin saldo utilizable. |

### Marcar un crédito usado como devuelto

1. Seleccione un crédito en estado `Usado`.
2. Pulse `Devolver`.
3. Escriba un motivo de 5 a 500 caracteres.
4. Confirme.

Esta acción marca el crédito usado como devuelto. No es lo mismo que devolver un
excedente al validar un pago ni que registrar una devolución de producto. No
reabre pedidos, no revierte
aplicaciones, no devuelve stock y no registra por sí misma una salida de caja.
La devolución física del dinero debe ejecutarse por el procedimiento contable
del negocio.

### Crédito de una incidencia

Una devolución registrada con decisión `Emitir crédito` crea un crédito manual
en la ficha. Si la incidencia se cancela antes de usarlo, el crédito puede
anularse. Si ya fue aplicado, la incidencia no podrá cancelarse.

---

## 17. Envíos

**Rutas:** `/envios`, `/envios/nuevo`, `/envios/[id]`  
**Roles:** ADMIN y DISPATCH

### Requisitos de los pedidos

- Deben estar `Pagados`.
- Deben pertenecer a la misma clienta.
- No deben estar vinculados a otro envío activo.

### Crear un envío

1. Abra `Envíos` y pulse `Nuevo envío`, o use un pedido listo desde el dashboard.
2. Seleccione la clienta si no está preseleccionada.
3. Agregue uno o varios pedidos elegibles.
4. Elija método:
   - delivery propio;
   - Olva;
   - Shalom;
   - motorizado por aplicativo;
   - recojo en tienda.
5. Registre el costo operativo del envío que desea conservar en la ficha.
6. Registre costo real asumido por el negocio.
7. Marque envío gratis si se autorizó manualmente.
8. Complete agencia, número de seguimiento (`tracking`), dirección, distrito, referencia y notas.
9. Guarde.

Si deja vacíos los datos de dirección, el sistema intenta copiar los datos
actuales de la clienta. Revise siempre la copia de dirección guardada antes de despachar.

### Envío gratis

El sistema lo aplica si:

- la regla está habilitada y los pedidos alcanzan el umbral; o
- el operador marca el envío gratis de forma manual.

El costo real puede existir aunque la clienta no pague envío. Este costo reduce
la utilidad del pedido.

### Costo cobrado y costo real

| Campo | Quién lo asume | Efecto |
|---|---|---|
| `Envío` del pedido | Clienta, según la venta | Se suma al total del pedido y no cambia al crear el despacho. |
| `Costo de envío` de la ficha | Referencia operativa | Se guarda en el envío y queda en cero si se aplica envío gratis; no reemplaza ni modifica el total del pedido. |
| `Costo real asumido` | Negocio | Se distribuye entre los pedidos agrupados y reduce su utilidad neta. |

### Estados

```text
Pendiente -> Preparando -> Listo -> Enviado -> Entregado
```

1. Abra el detalle.
2. Ejecute solo la siguiente acción de la secuencia.
3. Antes de `Enviado`, compruebe los datos aplicables al método: agencia y
   número de seguimiento para transportista; dirección y referencia para
   delivery; instrucciones para recojo en tienda.
4. Marque `Entregado` únicamente con confirmación de recepción.

### Editar

Mientras no esté entregado ni cancelado puede editar método, costos, envío
gratis, agencia, número de seguimiento, dirección y notas. No puede agregar o quitar pedidos
después de crear el envío.

### Cancelar y reenviar

1. Pulse `Cancelar envío`.
2. Escriba un motivo de al menos 5 caracteres.
3. Confirme.

Los pedidos quedan disponibles para crear un envío nuevo. El envío cancelado se
conserva en el historial y no se reactiva.

---

## 18. Gastos

**Rutas:** `/gastos`, `/gastos/nuevo`, `/gastos/[id]`  
**Rol:** ADMIN

Los gastos activos se descuentan de la utilidad neta real.

### Categorías

- alquiler;
- sueldos;
- publicidad;
- servicios de luz y agua;
- internet y telefonía;
- material de empaque;
- envíos;
- útiles de oficina;
- servicios profesionales;
- impuestos y tasas;
- mantenimiento;
- otros.

Cada gasto se clasifica además como `Fijo` o `Variable`.

### Registrar

1. Abra `Gastos` y pulse `Nuevo gasto`.
2. Seleccione fecha, categoría y tipo.
3. Ingrese monto.
4. Registre medio de pago si corresponde.
5. Escriba un detalle claro.
6. Agregue notas opcionales.
7. Guarde.

Queda `Activo` y afecta los indicadores financieros del periodo.

### Consultar y filtrar

Puede buscar en detalle, notas o medio de pago y filtrar por categoría, tipo,
estado y periodo. Abra la fila para ver la información completa.

### Editar

1. Abra un gasto activo.
2. Modifique fecha, categoría, tipo, monto, medio, detalle o notas.
3. Guarde.

Los cambios quedan auditados.

### Anular

1. Pulse `Anular gasto`.
2. Escriba un motivo de 5 a 200 caracteres.
3. Confirme.

El registro queda `Anulado`, deja de descontarse de los agregados y no puede
editarse ni reactivarse. No se elimina.

Para exportación use `Reportes > Gastos`.

---

## 19. Incidencias

**Rutas:** `/incidencias`, `/incidencias/nuevo`, `/incidencias/[id]`  
**Rol:** ADMIN

Las incidencias registran devoluciones, daños, pérdidas, reclamos y cambios.
Pueden afectar stock, créditos y rentabilidad.

### Tipos

| Tipo | Uso |
|---|---|
| Devolución | La clienta retorna mercadería. |
| Daño | Producto dañado en inventario o postventa. |
| Pérdida | Unidad perdida. |
| Reclamo | Caso comercial sin movimiento automático. |
| Cambio | Solicitud de cambio; la entrega de reemplazo se gestiona manualmente. |

### Decisiones de devolución

| Decisión | Efecto al crear |
|---|---|
| Volver a stock | Reduce unidades vendidas y aumenta el disponible visible de la variante. |
| Emitir crédito | Crea crédito para la clienta si el monto recuperado es mayor que cero. |
| Reemplazar | Registra la decisión; no crea automáticamente otro pedido. |
| Solo registrar | Guarda el caso sin automatización adicional. |

### Registrar una devolución

1. Pulse `Nueva incidencia`.
2. Elija `Devolución`.
3. Seleccione fecha y decisión.
4. Busque el pedido y, de ser posible, la línea exacta.
5. Seleccione o confirme variante y clienta según la decisión.
6. Ingrese cantidad y, para reingreso a inventario, cantidad que vuelve a stock.
7. Registre monto perdido y recuperado.
8. Describa el caso y agregue notas.
9. Guarde.

Los efectos de stock o crédito se ejecutan al crear la incidencia, no al
resolverla.

> En la versión 0.41.0, una devolución con decisión `Emitir crédito` utiliza
> `Monto recuperado` como importe del crédito y el mismo monto se suma como
> recuperación en los indicadores financieros. No lo interprete necesariamente
> como efectivo cobrado; compruebe este efecto al revisar la utilidad.

### Registrar daño o pérdida de inventario

1. Elija `Daño` o `Pérdida`.
2. Seleccione la variante.
3. Ingrese cantidad y monto perdido.
4. Describa el hecho.
5. Guarde.

Si no hay pedido asociado, el sistema descuenta stock disponible visible y
registra un ajuste. No puede descontar unidades ya reservadas o vendidas. Si la
variante usa lotes, compruebe también la disponibilidad de cada lote porque la
incidencia no la modifica.

### Reclamo o cambio

- Asocie pedido, línea y clienta cuando estén disponibles.
- Registre pérdidas, recuperaciones y descripción.
- El sistema no crea automáticamente un reemplazo, envío ni pedido nuevo.

### Resolver

1. Abra una incidencia `Abierta`.
2. Pulse `Resolver`.
3. Añada notas de resolución.
4. Confirme.

Resolver cambia el estado, pero no vuelve a ejecutar efectos financieros o de
stock.

### Cancelar

Solo puede cancelar una incidencia abierta.

1. Pulse `Cancelar`.
2. Ingrese un motivo de 5 a 200 caracteres.
3. Confirme.

El sistema intenta revertir stock o anular el crédito generado. Puede rechazar
la cancelación si ya no hay disponibilidad suficiente o si el crédito fue
utilizado.

> El diálogo de confirmación de 0.41.0 indica erróneamente que no se revierten
> stock ni créditos. La acción real sí intenta revertirlos. Trate la cancelación
> como una reversión y compruebe inventario y crédito después. Si la incidencia
> ya está resuelta, el botón puede aparecer, pero la acción será rechazada.

### Efecto financiero

- Monto perdido resta utilidad neta real.
- Monto recuperado la incrementa.
- Las incidencias canceladas no participan en estos totales.

---

## 20. WhatsApp

WhatsApp no tiene módulo propio. Sus botones aparecen en clientes, pedidos,
pagos, reservas, créditos, envíos y listas rápidas.

### Botón rápido

Abre `wa.me` con el número de la clienta. En algunas listas abre solo el chat,
sin texto prellenado.

### Panel de plantillas

1. Abra el panel de WhatsApp dentro del registro.
2. Elija una plantilla disponible para ese contexto.
3. Revise el texto generado.
4. Pulse `Copiar mensaje` o `Abrir WhatsApp`.
5. Revise destinatario e importe.
6. Envíe manualmente desde WhatsApp.

### Plantillas disponibles

1. Separación pendiente de validación.
2. Separación confirmada.
3. Recordatorio de saldo.
4. Reserva por vencer.
5. Reserva vencida.
6. Pago validado.
7. Pedido enviado.
8. Crédito disponible.

Las variables pueden incluir nombre, pedido, total, saldo, vencimiento, pago,
método, operación, agencia, número de seguimiento y crédito disponible.

### Importante

- El sistema no envía mensajes automáticamente.
- No existe integración con WhatsApp Business API.
- Copiar o abrir una plantilla no registra entrega ni lectura.
- En pagos multipedido o envíos agrupados, revise el texto porque la plantilla
  puede tomar como referencia el primer pedido.
- La versión 0.41.0 puede mostrar una plantilla aunque falte parte de su
  contexto. Use `Crédito disponible` solo si la pantalla muestra un crédito y
  `Pedido enviado` solo si existe un envío; de lo contrario el panel puede
  producir un error.

---

## 21. Reportes

**Ruta:** `/reportes`  
**Rol:** ADMIN

### Uso general

1. Abra `Reportes`.
2. Elija una sección.
3. Complete únicamente los filtros propios de esa sección.
4. Pulse `Aplicar`.
5. Revise tarjetas, avisos y tabla.
6. Use paginación cuando exista.
7. En reportes financieros, pulse `Descargar CSV` si necesita Excel.

No todos los filtros significan lo mismo en cada sección. Revise siempre el
título y las fechas aplicadas.

Precauciones de filtros en 0.41.0:

- En `Saldos pendientes`, `Ventas por mes`, `Rentabilidad por lote` y
  `Clientes`, pulsar `Aplicar` puede volver a `Resumen`. Si ocurre, seleccione
  nuevamente la sección.
- `Limpiar` puede conservar parámetros anteriores. Para reiniciar por completo,
  abra `/reportes` sin parámetros y seleccione otra vez la sección.
- En la interfaz, la fecha `Hasta` se interpreta como las 00:00 del día elegido,
  por lo que excluye el resto de ese día. Para incluirlo en pantalla, use
  temporalmente el día siguiente y revise cualquier registro de medianoche.
- El CSV interpreta `Hasta` como el final del día, por lo que puede contener más
  filas que la pantalla.

### Reportes operativos

| Sección | Fecha o corte | Estados y alcance principales |
|---|---|---|
| Resumen | Creación de pedido y validación del pago | Pedidos de todos los estados; cobros solo validados; deuda y crédito muestran saldo actual. |
| Pagos | Fecha de registro del pago | Pendientes, validados o rechazados según filtro. |
| Saldos pendientes | Fecha de creación del pedido | Pedidos con deuda activa; muestra clientas y vencimientos. |
| Créditos | Fecha de creación del crédito | Todos los estados y orígenes según filtro. |
| Ventas por live | Inicio del live | Lives y pedidos asociados según estado del live. |
| Stock actual | Estado actual, sin periodo | Variantes de cualquier estado; usa los contadores vigentes. |
| Productos más vendidos | Creación del pedido si hay fechas | Puede incluir líneas de pedidos no pagados, cancelados o vencidos. |

Consideraciones:

- `Pedidos creados` no significa pedidos pagados.
- En Pagos, el rango se basa en fecha de registro del pago.
- Deuda y créditos pueden representar el saldo actual, no solo el rango.
- Productos más vendidos puede incluir operaciones de distintos estados según
  el filtro usado.

### Reportes financieros

| Sección | Fecha y estados | Filtros principales | CSV |
|---|---|---|:---:|
| Ventas por mes | Pedidos pagados por fecha de reconocimiento de utilidad | Desde y hasta | Sí |
| Utilidad por producto | Líneas con costo de pedidos pagados | Fechas, categoría y mínimo de unidades | Sí |
| Rentabilidad por lote | Asignaciones de lote de pedidos pagados | Fechas | Sí |
| Stock valorizado | Estado actual; excluye variantes archivadas | Texto y categoría | Sí |
| Productos sin rotación | Última venta de pedidos actualmente pagados | Días y categoría | Sí |
| Gastos | Fecha del gasto y estados filtrados | Año, mes, categoría, tipo, estado y texto | Sí |
| Clientes | Pedidos del rango; crédito disponible actual | Fechas y texto | Sí |
| Devoluciones | Fecha de incidencia; filas de todos los estados y totales sin canceladas | Fechas, tipo, estado y decisión | Sí |

### Interpretación financiera

- Las ventas financieras se reconocen con pedidos `Pagados`.
- La utilidad por pedido descuenta costo de producto, comisión, empaque y costo
  real de envío.
- Los gastos e incidencias se presentan en sus reportes y en la utilidad neta
  real del dashboard.
- Stock valorizado usa costo de lotes disponible o costo legado.
- ROI del lote compara utilidad asignada con inversión del lote.

> En la versión 0.41.0, la comisión del cálculo histórico de utilidad toma pagos
> validados vinculados directamente al pedido. Pagos manuales o multipedido
> relacionados únicamente mediante aplicaciones pueden quedar fuera. Además,
> una línea repartida entre varios lotes puede repetir ingresos en Rentabilidad
> por lote. Use estas cifras para control operativo y verifíquelas antes de un
> cierre contable definitivo.

### Exportación CSV

- Se descarga en UTF-8 compatible con Excel.
- Replica los filtros enviados al endpoint de exportación.
- Puede limitarse a 5.000 filas.
- Si aparece un aviso de truncamiento, reduzca el rango o los filtros y vuelva a
  exportar.
- La interfaz y el CSV pueden tratar la hora final del rango de forma diferente;
  use rangos claros y compruebe los totales.

---

## 22. Auditoría

**Ruta:** `/auditoria`  
**Rol:** ADMIN

La auditoría es un historial inmutable de operaciones críticas. No sustituye
los reportes financieros.

### Consultar

1. Abra `Auditoría`.
2. Filtre por fecha, acción, entidad o actor.
3. Use texto libre para buscar entidad, identificador, nombre o correo.
4. Pulse `Aplicar`.
5. Revise totales, distribución por acción y filas.
6. Abra o inspeccione los metadatos en formato JSON del evento.

La fecha `Hasta` también se interpreta como las 00:00 del día seleccionado. Si
necesita incluir el día completo, use el día siguiente y revise eventos de
medianoche.

### Eventos principales

- pedido creado, cancelado o vencido;
- pago validado, rechazado o con aplicaciones modificadas;
- ajuste de inventario;
- envío creado, editado, cambiado de estado o cancelado;
- producto creado o precio cambiado;
- clienta desactivada o con estado modificado;
- crédito creado, aplicado o devuelto;
- configuración modificada;
- lote creado, editado, recalculado o con líneas modificadas;
- asignación o liberación FIFO;
- utilidad reconocida;
- gasto creado, editado o anulado;
- incidencia creada, resuelta o cancelada.

### Interpretación

- `Actor` identifica al usuario cuando está disponible.
- `Entidad` y `entityId` identifican el registro afectado.
- `Metadata` contiene valores relevantes anteriores o nuevos.
- Los registros no pueden editarse ni eliminarse desde la interfaz.
- Login, logout, vistas y descargas no generan necesariamente eventos.

---

## 23. Flujos completos de principio a fin

### 23.1 Abastecimiento, venta y entrega

1. ADMIN configura tipo de cambio, márgenes, empaque y asignación de costos.
2. ADMIN o SELLER crea categorías, productos y variantes.
3. ADMIN o SELLER crea el lote con cantidades compradas y recibidas.
4. Recalcula el costo aterrizado.
5. Revisa precio mínimo, sugerido y margen.
6. Abre un live, si la venta ocurre en transmisión.
7. Registra la venta rápida con clienta, productos y adelanto.
8. El sistema reserva stock y asigna lotes FIFO.
9. Un validador revisa y valida el pago.
10. Si falta saldo, registra y valida pagos adicionales o aplica crédito.
11. Al quedar pagado, el sistema confirma stock y reconoce utilidad.
12. ADMIN o DISPATCH crea el envío con costo real.
13. Avanza por preparación, listo, enviado y entregado.
14. ADMIN revisa dashboard financiero y reportes.

### 23.2 Venta con adelanto y saldo posterior

1. Registre venta rápida con el adelanto mínimo.
2. Valide el pago inicial.
3. El pedido queda parcialmente pagado si aún tiene saldo.
4. Contacte a la clienta con `Recordatorio de saldo`.
5. Registre un segundo pago o aplique crédito.
6. Valídelo.
7. Cuando el saldo llegue a cero, el pedido queda pagado y habilitado para
   envío.

### 23.3 Un pago para varios pedidos

1. Abra `Nuevo pago`.
2. Seleccione la clienta.
3. Agregue todos sus pedidos activos.
4. Distribuya el monto sin superar cada saldo.
5. Guarde y revise capturas.
6. Valide una sola vez.
7. Abra cada pedido y compruebe su estado resultante.

### 23.4 Sobrepago convertido en crédito

1. Registre el pago total recibido.
2. Aplique a pedidos solo los importes que corresponden.
3. Deje el excedente sin aplicar.
4. Al validar, elija `Crear crédito`.
5. Compruebe el nuevo crédito en la ficha de la clienta.
6. En una compra futura, aplíquelo manualmente al pedido.

### 23.5 Reserva impaga vencida

1. Revise `Reservas vencidas` cada día.
2. Contacte a la clienta.
3. Si no continuará, procese el vencimiento.
4. El sistema libera stock y lotes, rechaza o desvincula pagos pendientes y deja
   saldo cero.
5. Compruebe el movimiento de inventario.

### 23.6 Pago rechazado

1. Abra el pago y revise evidencia.
2. Rechace con un motivo claro.
3. Abra los pedidos aplicados.
4. Compruebe si continuaron activos por otro pago o si fueron cancelados.
5. Si fueron cancelados, confirme la liberación de stock.

### 23.7 Envío agrupado

1. Espere a que todos los pedidos estén pagados.
2. Cree envío y seleccione una sola clienta.
3. Agregue varios pedidos elegibles.
4. Registre costo real, dirección, agencia y número de seguimiento.
5. Complete la secuencia hasta entregado.
6. Revise la utilidad recalculada por el costo de despacho.

### 23.8 Devolución que vuelve a stock

1. Cree incidencia de tipo `Devolución`.
2. Seleccione pedido, línea y variante.
3. Elija `Volver a stock`.
4. Registre cantidad devuelta y monto perdido o recuperado.
5. Guarde y compruebe inventario.
6. Cuando el caso administrativo termine, márquelo resuelto.

### 23.9 Devolución con crédito

1. Cree incidencia de devolución.
2. Elija `Emitir crédito`.
3. Seleccione la clienta.
4. Registre el importe en `Monto recuperado`.
5. Guarde.
6. Compruebe el crédito disponible en la ficha.
7. Resuelva la incidencia cuando finalice el caso.

---

## 24. Rutina diaria recomendada

### Rutina de ADMIN

1. Inicie sesión y revise pagos, reservas, stock y alertas financieras.
2. Atienda pagos que requieran validación administrativa.
3. Procese reservas vencidas sin dinero validado.
4. Revise diferencias entre inventario y disponibilidad por lote.
5. Confirme que lotes nuevos estén recalculados antes de vender.
6. Registre gastos, daños, pérdidas, devoluciones y reclamos del día.
7. Revise operaciones sensibles en Auditoría.
8. Al cierre, analice utilidad, margen, gastos e incidencias en Reportes.

### Rutina de SELLER

1. Revise el dashboard, pagos pendientes y reservas próximas a vencer.
2. Antes del live, confirme productos activos, precios y disponibilidad.
3. Cierre cualquier live abierto anterior y cree la nueva sesión.
4. Durante la transmisión, revise estado y crédito de cada clienta.
5. Registre cada venta una sola vez y compruebe el detalle del pedido.
6. No considere cobrado un adelanto hasta que sea validado.
7. Valide o rechace pagos solo si SELLER está configurado como validador. En
   caso contrario, deje el pago pendiente y notifíquelo al ADMIN.
8. Envíe recordatorios de saldo y cierre el live al terminar.
9. Entregue a despacho la lista de pedidos que hayan quedado pagados.

### Rutina de DISPATCH

1. Revise en el dashboard los pedidos pagados listos para despacho.
2. Abra cada caso desde la cola y cree el envío.
3. Compruebe clienta, pedidos agrupados, dirección y referencia.
4. Registre costo real y número de seguimiento cuando corresponda.
5. Actualice `Preparando`, `Listo`, `Enviado` y `Entregado` el mismo día que
   ocurra cada evento.
6. Si un envío se cancela, registre el motivo y cree otro solo después de
   comprobar que los pedidos volvieron a quedar elegibles.

### Traspasos entre roles

- SELLER entrega a ADMIN pagos que no puede validar y pedidos parcialmente
  pagados que requieren decisión.
- ADMIN entrega a DISPATCH únicamente pedidos pagados y sin envío activo.
- DISPATCH informa a ADMIN costos reales, cancelaciones e incidencias de
  entrega.
- Cualquier rol detiene la operación de una variante cuando stock visible y
  disponibilidad por lote no coinciden.

---

## 25. Estados del sistema

### Cliente

| Estado | Etiqueta |
|---|---|
| `ACTIVE` | Activa |
| `FREQUENT` | Frecuente |
| `RISKY` | Riesgosa |
| `BLOCKED` | Bloqueada |

La baja de una clienta se guarda aparte como activo/inactivo.

### Variante

| Estado | Etiqueta |
|---|---|
| `ACTIVE` | Activa |
| `HIDDEN` | Oculta |
| `ARCHIVED` | Archivada |

### Live

```text
Abierto -> Cerrado
Abierto -> Cancelado
```

### Pedido

| Estado | Significado |
|---|---|
| Pendiente de validación | Tiene pago registrado aún no validado. |
| Reservado | Mantiene stock sin monto validado. |
| Parcialmente pagado | Tiene dinero validado y saldo pendiente. |
| Pagado | Saldo cero, stock confirmado y utilidad reconocida. |
| Cancelado | Cierre manual sin pago validado. |
| Vencido | Reserva expirada procesada manualmente. |

### Pago

```text
Pendiente -> Validado
Pendiente -> Rechazado
```

### Crédito

```text
Disponible -> Parcialmente usado -> Usado -> Devuelto
Disponible/relacionado -> Anulado, cuando corresponde
```

### Envío

```text
Pendiente -> Preparando -> Listo -> Enviado -> Entregado
Pendiente/Preparando/Listo/Enviado -> Cancelado
```

### Lote

```text
Comprado / En tránsito / Completo -> Cerrado
```

La interfaz permite cambiar entre estados no cerrados; el cierre bloquea el
lote.

### Gasto

```text
Activo -> Anulado
```

### Incidencia

```text
Abierta -> Resuelta
Abierta -> Cancelada
```

---

## 26. Solución de situaciones frecuentes

### No aparece una opción del menú

- Compruebe el rol mostrado en el menú de cuenta.
- La función puede pertenecer a ADMIN u otro rol.
- Si el enlace aparece pero vuelve al dashboard, no existe acceso efectivo para
  ese rol.

### La sesión vuelve al login

La sesión puede haber alcanzado sus 15 minutos. Inicie sesión de nuevo; si llegó
desde una ruta protegida, el sistema intentará regresar a ella.

### No puedo registrar una clienta

- Revise nombre y WhatsApp.
- Use un móvil peruano válido.
- El número puede pertenecer a una clienta dada de baja y seguir reservado.

### La clienta no puede comprar

Revise su estado. `Bloqueada` impide nuevas ventas para todos los roles. Cambie
el estado solo con autorización del negocio.

### La variante no aparece en venta

Compruebe:

- producto activo;
- variante activa;
- stock disponible;
- lote recibido y recalculado si opera con lotes.

### La venta informa stock insuficiente

Otra operación pudo reservar unidades. Recargue, revise disponibilidad global y
por lote, reduzca cantidad o elija otra variante.

### El pago no cambió el saldo

Un pago recién registrado permanece pendiente. Debe abrirse y validarse por un
rol autorizado.

### El pedido no queda pagado

- Revise que la suma de aplicaciones cubra el saldo.
- Compruebe si parte del pago quedó sin aplicar.
- Revise créditos aplicados.
- Abra el detalle para confirmar el importe validado real.

### No se puede cancelar o vencer un pedido

Solo se cierran como impagas las reservas sin dinero validado en estados
pendiente o reservado. La interfaz no permite vencer ni cancelar como impago un
pedido parcialmente pagado. Manténgalo activo y escálelo al ADMIN para decidir
si se continuará cobrando y cómo se tratará el dinero ya validado.

### No aparece un pedido para envío

Debe estar pagado, pertenecer a la clienta seleccionada y no tener otro envío
activo.

### No puedo editar o recalcular un lote

Un lote `Cerrado` es terminal. No existe reapertura desde la interfaz.

### No puedo cancelar una incidencia

- Debe seguir abierta.
- El crédito generado no debe haberse usado.
- Debe existir disponibilidad para revertir los movimientos originales.

### El CSV está incompleto

Revise el aviso de límite. Reduzca fechas, categoría o búsqueda y vuelva a
descargar.

---

## 27. Limitaciones y precauciones actuales

Estas condiciones forman parte del comportamiento de la versión documentada:

1. No hay administración de usuarios, recuperación ni cambio de contraseña en
   la interfaz.
2. Las reservas no vencen automáticamente; un operador debe procesarlas.
3. Los pedidos parcialmente pagados pueden aparecer en indicadores de
   vencimiento, pero no pueden cerrarse como reservas impagas.
4. No existe una pantalla global de créditos; se administran desde cada
   clienta.
5. WhatsApp solo prepara o copia mensajes; no envía ni registra entregas.
6. No existe flujo para reactivar una clienta dada de baja.
7. Un producto inactivo desaparece del listado normal; conserve control sobre
   las desactivaciones antes de ejecutarlas.
8. La recepción adicional de una línea de lote ya creada no tiene un formulario
   específico. Si ya tiene asignaciones, tampoco puede quitarse y recrearse.
9. Cerrar un lote impide editarlo y recalcularlo. Recalcule y revise antes del
   cierre.
10. En variantes con lotes, un ajuste manual de inventario no modifica las
    cantidades disponibles de cada lote. Puede existir diferencia entre stock
    visible y stock vendible por FIFO.
11. Los campos visuales de margen y comisión reciben puntos básicos, no el
    porcentaje humano directo.
12. El reemplazo de una incidencia no crea automáticamente un pedido o envío.
13. Marcar un crédito como devuelto no registra una salida de caja ni revierte
    pedidos.
14. Los filtros de mes y `Limpiar` en Gastos e Incidencias pueden no reflejar el
    resultado esperado. Verifique el rango desde Reportes cuando el total sea
    crítico.
15. Algunos reportes operativos incluyen pedidos cancelados, vencidos o
    pendientes. Lea la definición de cada métrica antes de tomar decisiones.
16. Los filtros del dashboard financiero no se aplican de forma idéntica a
    todos los bloques.
17. La navegación puede mostrar `Productos`, `Inventario` o `Lives` a DISPATCH,
    aunque sus páginas principales no sean utilizables por ese rol.
18. Configurar únicamente a DISPATCH como validador deja la validación de pagos
    sin un recorrido normal desde la interfaz.
19. Un pago manual puede existir aunque falle la carga de sus capturas. Busque
    antes de volver a registrarlo.
20. Rechazar un pago puede omitir otros pagos pendientes vinculados solo por
    aplicaciones y cancelar la reserva. Revise todas las aplicaciones primero.
21. La disponibilidad visible de una variante con lotes puede descontar dos
    veces las unidades reservadas y ser menor que la disponibilidad por lote.
22. Devoluciones, daños y pérdidas no actualizan la disponibilidad interna de
    los lotes.
23. La utilidad puede omitir comisiones de pagos manuales o multipedido, y el
    reporte por lote puede repetir ingreso cuando una línea usa varios lotes.
24. La fecha `Hasta` de Reportes y Auditoría excluye actualmente el resto del
    día seleccionado en pantalla, aunque el CSV sí lo incluye.
25. En incidencias con crédito, `Monto recuperado` determina el crédito y también
    se suma como recuperación financiera.
26. No hay un flujo para trasladar stock legado a un primer lote. Crear la línea
    de lote suma lo recibido, pero FIFO solo considera las unidades representadas
    en lotes. La migración requiere conciliación técnica previa.
27. No se pueden agregar o reemplazar capturas después de crear un pago.
28. En una venta de varias unidades con costo legado, la versión actual puede
    guardar solo una unidad de costo y sobreestimar la utilidad. Verifique esos
    pedidos antes de usar su margen en un cierre contable.

Ante diferencias de stock, costos o rentabilidad, detenga nuevas operaciones de
la variante afectada y solicite revisión del ADMIN o responsable técnico antes
de compensar con ajustes manuales.

---

## 28. Mapa de rutas

| Ruta | Uso |
|---|---|
| `/login` | Inicio de sesión |
| `/dashboard` | Resumen operativo y financiero por rol |
| `/configuracion` | Reglas del negocio |
| `/clientes` | Listado de clientas |
| `/clientes/nuevo` | Alta de clienta |
| `/clientes/[id]` | Ficha e historiales |
| `/clientes/[id]/editar` | Edición de clienta |
| `/categorias` | Categorías |
| `/categorias/nueva` | Alta de categoría |
| `/categorias/[id]/editar` | Edición de categoría |
| `/productos` | Catálogo de productos |
| `/productos/nuevo` | Alta unificada de producto y variantes |
| `/productos/[id]` | Detalle, variantes e imágenes |
| `/productos/[id]/editar` | Edición e imágenes |
| `/productos/[id]/variantes/nueva` | Nueva variante |
| `/productos/[id]/variantes/[variantId]/editar` | Editar variante |
| `/lotes` | Lotes de importación |
| `/lotes/nuevo` | Crear lote |
| `/lotes/[id]` | Detalle, edición y costeo |
| `/inventario` | Stock por variante |
| `/inventario/[variantId]` | Movimientos y ajuste |
| `/lives` | Sesiones de transmisión |
| `/lives/nuevo` | Crear live |
| `/lives/[id]` | Métricas y cierre |
| `/lives/[id]/editar` | Editar live abierto |
| `/ventas` | Venta rápida |
| `/pedidos` | Listado de pedidos |
| `/pedidos/[id]` | Detalle del pedido |
| `/pedidos/vencidos` | Reservas vencidas |
| `/pagos` | Listado de pagos |
| `/pagos/nuevo` | Registrar pago manual |
| `/pagos/[id]` | Aplicaciones, capturas, validación y rechazo |
| `/envios` | Listado de envíos |
| `/envios/nuevo` | Crear envío |
| `/envios/[id]` | Editar y cambiar estado |
| `/gastos` | Listado de gastos |
| `/gastos/nuevo` | Registrar gasto |
| `/gastos/[id]` | Editar o anular gasto |
| `/incidencias` | Listado de incidencias |
| `/incidencias/nuevo` | Registrar incidencia |
| `/incidencias/[id]` | Resolver o cancelar incidencia |
| `/reportes` | Reportes operativos y financieros |
| `/auditoria` | Registro de acciones críticas |

---

## 29. Glosario

**Adelanto:** primer importe registrado para separar productos.

**Aplicación:** distribución de un pago o crédito a un pedido.

**Código de barras:** identificador opcional y único de una variante.

**Puntos básicos:** unidad de porcentaje donde 100 representa
1%.

**Clienta activa:** registro disponible en búsquedas normales. No es lo mismo
que estado comercial `Activa`.

**Costo legado:** costo guardado directamente en una variante que actualmente
no tiene líneas de lote.

**Costo real de envío:** importe asumido por la tienda para despachar.

**Crédito disponible:** saldo a favor todavía reutilizable.

**FIFO:** consumo de los lotes más antiguos primero.

**Live abierto:** transmisión que venta rápida asocia automáticamente a nuevos
pedidos.

**Persona compradora (`shopper`):** responsable que realizó la compra o
importación registrada en un lote.

**Lote calculado:** lote cuyos costos adicionales fueron distribuidos y cuyas
líneas tienen costo aterrizado.

**Pago pendiente:** pago registrado que todavía no modifica el saldo.

**Reserva:** pedido que mantiene stock separado mientras espera validación o
pago.

**SKU o código de variante:** identificador interno único del artículo
vendible.

**Snapshot:** copia histórica de precio, costo, dirección o regla usada en el
momento de una operación.

**Número de seguimiento (`tracking`):** código proporcionado por la agencia para
consultar el traslado del envío.

**Stock disponible:** unidades que el sistema presenta como utilizables después
de descontar reservado y vendido.

**Utilidad reconocida:** costo y margen congelados cuando el pedido queda
pagado.
