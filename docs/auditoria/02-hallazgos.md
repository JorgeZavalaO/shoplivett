# 02 - Hallazgos de auditoria

Fecha de creacion: 2026-07-01

Estados validos: `Pendiente`, `En progreso`, `Corregido`, `Diferido`, `No aplica`.

Regla: no eliminar hallazgos corregidos. Actualizar estado, observaciones y referencias a PR/commit cuando aplique.

## Seguridad

### AUD-SEC-001 - JWT no revalida usuario activo o rol

- ID: `AUD-SEC-001`
- Titulo: Usuarios desactivados o con rol cambiado pueden conservar acceso por JWT.
- Severidad: Alta.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `auth.ts`.
- Descripcion: el callback JWT solo reconsulta `role/isActive` en `trigger === "update"` o si falta rol en el token.
- Evidencia encontrada: `auth.ts:75-87`.
- Riesgo real: un usuario desactivado o degradado puede mantener permisos hasta expiracion del JWT.
- Recomendacion: revalidar usuario activo y rol en requests criticas, reducir `maxAge` o implementar `sessionVersion/tokenVersion`.
- Criterios de aceptacion: usuario desactivado pierde acceso de forma inmediata o dentro de una ventana definida; cambio de rol se refleja sin esperar expiracion larga.
- Tests recomendados: integracion/auth para usuario desactivado; E2E de cambio de rol.
- Dependencias: resuelta sin cambio de schema; se eligio reducir `maxAge`.
- Observaciones: corregido definiendo `AUTH_SESSION_MAX_AGE_SECONDS = 15 * 60` y aplicandolo a `session.maxAge` y `jwt.maxAge` en `auth.ts`. La ventana maxima de acceso tras desactivar/degradar un usuario queda definida en 15 minutos.

### AUD-SEC-002 - Login sin rate limiting

- ID: `AUD-SEC-002`
- Titulo: Falta proteccion contra fuerza bruta en login.
- Severidad: Alta.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `auth.ts`, `actions/auth.ts`.
- Descripcion: el login credentials ejecuta busqueda de usuario y `bcrypt.compare` sin throttling por IP/email.
- Evidencia encontrada: `auth.ts:45-56`, `actions/auth.ts:43-58`.
- Riesgo real: password spraying, brute force y DoS de CPU.
- Recomendacion: rate limit serverless por IP+email, backoff progresivo y auditoria de fallos.
- Criterios de aceptacion: intentos repetidos quedan limitados; respuesta no revela si existe el email.
- Tests recomendados: integracion/manual de multiples intentos fallidos; test de reset de ventana.
- Dependencias: resuelta con backend PostgreSQL via Prisma.
- Observaciones: se agrego rate limit por hash de email+IP en `LoginRateLimit`, aplicado antes de lookup/bcrypt en `auth.ts`; la respuesta sigue siendo generica. Regresion agregada en `scripts/test-auth-rate-limit.ts`.

### AUD-SEC-003 - Capturas de pago publicas

- ID: `AUD-SEC-003`
- Titulo: Recibos/capturas se almacenan con acceso publico.
- Severidad: Alta.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/blob.ts`, `actions/payments.ts`, `lib/sales.ts`, `app/(dashboard)/pagos/[id]/page.tsx`.
- Descripcion: `uploadImage()` usa `access: "public"` tambien para comprobantes de pago.
- Evidencia encontrada: `lib/blob.ts:91-95`, `lib/sales.ts:147-157`.
- Riesgo real: informacion financiera accesible por URL directa si el enlace se filtra.
- Recomendacion: separar blobs publicos de imagenes y archivos privados; servir recibos mediante route autenticada o URLs firmadas temporales.
- Criterios de aceptacion: un recibo no es accesible sin sesion autorizada; productos siguen mostrando imagenes publicas si aplica.
- Tests recomendados: E2E/manual de acceso anonimo a recibo; test de permiso por rol.
- Dependencias: politica de almacenamiento privado y posible migracion de recibos existentes.
- Observaciones: en 0.34.0 los recibos nuevos se suben como privados y la UI usa `/api/payment-receipts/[id]` autenticado para `ADMIN`/`SELLER`. URLs publicas historicas ya filtradas requieren rotacion/reupload si existieran fuera del sistema.

### AUD-SEC-004 - RBAC incompleto en paginas de lives

- ID: `AUD-SEC-004`
- Titulo: Paginas de lives consultan datos sin guard de rol.
- Severidad: Media.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `app/(dashboard)/lives/nuevo/page.tsx`, `app/(dashboard)/lives/[id]/editar/page.tsx`.
- Descripcion: el layout solo exige sesion y estas paginas consultan usuarios responsables sin `requireRole`.
- Evidencia encontrada: `app/(dashboard)/layout.tsx:11`, `app/(dashboard)/lives/nuevo/page.tsx:6-11`, `app/(dashboard)/lives/[id]/editar/page.tsx:10-21`.
- Riesgo real: usuario autenticado sin rol permitido puede ver datos internos si accede por URL directa.
- Recomendacion: agregar `requireRole(["ADMIN", "SELLER"])` o permiso equivalente en server component.
- Criterios de aceptacion: roles no autorizados redirigen antes de consultar datos.
- Tests recomendados: E2E por rol para rutas de lives.
- Dependencias: ninguna.
- Observaciones: revisar tambien detalle/listado si aplica.

### AUD-SEC-005 - Drift entre permisos declarados y guards reales

- ID: `AUD-SEC-005`
- Titulo: Matriz de permisos y guards por rol no son fuente unica.
- Severidad: Media.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/authorization.ts`, `lib/permissions.ts`, `actions/*`, `components/layout/sidebar.tsx`.
- Descripcion: `authorization.ts` declara no usarse en produccion y difiere de guards reales en credito/inventario/despacho.
- Evidencia encontrada: `lib/authorization.ts:3-6`, `lib/authorization.ts:43-70`, `actions/credits.ts`, `actions/inventory.ts`.
- Riesgo real: accesos inesperados, enlaces muertos y futuras exposiciones por reglas duplicadas.
- Recomendacion: definir fuente unica de permisos y alinear paginas, actions y sidebar.
- Criterios de aceptacion: matriz por rol testeada; no hay acciones o enlaces inconsistentes.
- Tests recomendados: suite de permisos por rol.
- Dependencias: decision funcional sobre permisos de `DISPATCH`.
- Observaciones: en 0.33.0 se alineo `DISPATCH` para no declarar lectura general de clientes/pedidos; el flujo de envios usa loaders acotados y enlaces autorizados. Queda pendiente migrar mas guards a `assertPermission` en lotes futuros.

### AUD-SEC-006 - CSV injection

- ID: `AUD-SEC-006`
- Titulo: Exportaciones CSV no neutralizan formulas.
- Severidad: Media.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/csv-export.ts`, `app/api/reportes/[section]/route.ts`.
- Descripcion: `escapeCell()` escapa comillas/comas/saltos, pero no valores que empiezan con `=`, `+`, `-` o `@`.
- Evidencia encontrada: `lib/csv-export.ts:15-35`.
- Riesgo real: Excel/Sheets puede ejecutar formulas al abrir un CSV con datos controlados por usuarios.
- Recomendacion: prefijar apostrofe, tab u otra neutralizacion para celdas peligrosas.
- Criterios de aceptacion: valores peligrosos se exportan como texto seguro.
- Tests recomendados: unitario de `buildCsv()` con celdas formula-like.
- Dependencias: ninguna.
- Observaciones: aplicar a todos los reportes.

### AUD-SEC-007 - Validacion de subida de archivos incompleta

- ID: `AUD-SEC-007`
- Titulo: Uploads validan MIME declarado y no limitan cantidad total.
- Severidad: Media.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/blob.ts`, `actions/payments.ts`, `actions/sales.ts`.
- Descripcion: se valida `File.type` y 5MB por archivo, pero no magic bytes, cantidad ni tamano agregado por accion.
- Evidencia encontrada: `lib/blob.ts:69-76`, `actions/payments.ts`, `actions/sales.ts`.
- Riesgo real: abuso de storage por usuario autenticado y archivos disfrazados.
- Recomendacion: validar firma/decodificacion, limitar cantidad y tamano total, usar nombres con `crypto.randomUUID()`.
- Criterios de aceptacion: archivos no imagen son rechazados; accion limita cantidad/tamano total.
- Tests recomendados: integracion/manual de upload invalido y lote excesivo.
- Dependencias: ninguna.
- Observaciones: diferenciar productos vs recibos.

### AUD-SEC-008 - Falta de headers de seguridad explicitos

- ID: `AUD-SEC-008`
- Titulo: No hay politica explicita de headers defensivos.
- Severidad: Baja.
- Categoria: Seguridad.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `next.config.ts` o plataforma Vercel.
- Descripcion: no se observaron CSP, `frame-ancestors`, `X-Content-Type-Options` ni `Referrer-Policy` configurados explicitamente.
- Evidencia encontrada: revision de config actual.
- Riesgo real: menor defensa ante XSS futuro, clickjacking y sniffing.
- Recomendacion: agregar headers globales compatibles con Next/Auth/Blob.
- Criterios de aceptacion: respuestas incluyen headers esperados y no rompen assets ni auth.
- Tests recomendados: verificacion manual/curl y smoke UI.
- Dependencias: definir politica de blobs privados/publicos.
- Observaciones: en 0.34.0 se agregaron CSP, `frame-ancestors`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` en `next.config.ts`.

### AUD-SEC-009 - Secretos reales o aparentes en `.env` local

- ID: `AUD-SEC-009`
- Titulo: El workspace contiene `.env` con secretos reales o aparentes.
- Severidad: Critica.
- Categoria: Seguridad.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `.env` local no rastreado.
- Descripcion: existe un `.env` ignorado por Git con credenciales/tokens reales o aparentes.
- Evidencia encontrada: `.gitignore` ignora `.env`; `git ls-files` no lo rastrea. El contenido exacto no se replica en esta documentacion por seguridad.
- Riesgo real: fuga por backup, zip, soporte remoto o copia accidental.
- Recomendacion: rotar secretos si hubo exposicion, usar vault/env manager y evitar compartir workspace con `.env` real.
- Criterios de aceptacion: secretos rotados si aplica; `.env` local no se comparte; `.env.example` sin secretos.
- Tests recomendados: revision manual de repositorio y secret scanning.
- Dependencias: acceso a proveedores Neon/Vercel/Auth.
- Observaciones: no esta trackeado, pero sigue siendo riesgo operativo.

## Datos y consistencia

### AUD-DATA-001 - Utilidad excluye pago actual

- ID: `AUD-DATA-001`
- Titulo: `paymentFeePen` excluye el pago que esta validando.
- Severidad: Critica.
- Categoria: Datos.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/payments.ts`, `lib/order-batch-allocation.ts`.
- Descripcion: la utilidad se reconoce antes de actualizar el pago a `VALIDATED`.
- Evidencia encontrada: `lib/payments.ts:418-430`, `lib/payments.ts:467-477`, `lib/order-batch-allocation.ts:450-452`, `lib/order-batch-allocation.ts:469-488`.
- Riesgo real: utilidad neta sobrestimada y congelada por idempotencia.
- Recomendacion: marcar pago como validado antes de reconocer utilidad o incluir explicitamente el pago en curso.
- Criterios de aceptacion: pedido que queda `PAID` incluye fees del pago actual; test de regresion cubre cierre por pago.
- Tests recomendados: dominio/integracion de `validatePayment()` y reporte financiero.
- Dependencias: ninguna.
- Observaciones: P0. Corregido reordenando `validatePayment()` para marcar el pago como `VALIDATED` antes de reconocer utilidad en pedidos que pasan a `PAID`. Regresion agregada en `e2e/flows.spec.ts` y validada con script temporal de dominio (`paymentFeePen=3.00`, `netProfitPen=55.00`).

### AUD-DATA-002 - Cancelacion de incidencias no revierte efectos

- ID: `AUD-DATA-002`
- Titulo: Incidencias canceladas dejan stock o creditos aplicados.
- Severidad: Critica.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/incidents.ts`.
- Descripcion: `createIncident()` aplica efectos reales; `cancelIncident()` solo cambia estado.
- Evidencia encontrada: `lib/incidents.ts:439-544`, `lib/incidents.ts:675-683`.
- Riesgo real: stock inflado/reducido y creditos disponibles por incidencias canceladas.
- Recomendacion: implementar reversas transaccionales o bloquear cancelacion de incidencias con efectos.
- Criterios de aceptacion: cancelar no deja efectos inconsistentes; creditos ya usados tienen regla clara.
- Tests recomendados: dominio para `RESTOCK`, `DAMAGE`, `LOSS`, `CREDIT` y cancelacion.
- Dependencias: decision funcional resuelta: cancelar revierte efectos; creditos ya aplicados bloquean cancelacion.
- Observaciones: P0. Corregido con reversas transaccionales en `cancelIncident()`: RESTOCK revierte `soldStock`, DAMAGE/LOSS de inventario propio devuelve stock y CREDIT anula credito si no fue aplicado; si ya fue usado, se bloquea con `CREDIT_ALREADY_USED`. Regresiones en `scripts/test-incidents.ts`.

### AUD-DATA-003 - Restock duplica disponibilidad

- ID: `AUD-DATA-003`
- Titulo: `RETURN + RESTOCK` incrementa disponibilidad dos veces.
- Severidad: Critica.
- Categoria: Datos.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/incidents.ts`, `lib/inventory.ts`.
- Descripcion: al devolver unidades, incrementa `stock` y decrementa `soldStock` simultaneamente cuando `qty <= soldStock`.
- Evidencia encontrada: `lib/incidents.ts:475-480`; disponibilidad depende de `stock - reservedStock - soldStock`.
- Riesgo real: una devolucion de 1 unidad puede aumentar disponible en 2 unidades.
- Recomendacion: definir modelo de inventario y aplicar una sola compensacion coherente.
- Criterios de aceptacion: disponibilidad aumenta exactamente por unidades devueltas.
- Tests recomendados: test de stock antes/despues de devolucion.
- Dependencias: `AUD-DATA-002` corregido.
- Observaciones: P0. Corregido haciendo que `RETURN + RESTOCK` reduzca solo `soldStock`; `ProductVariant.stock` no se incrementa cuando la unidad vuelve desde venta, por lo que disponible sube exactamente por `qty`. Regresion en `scripts/test-incidents.ts`.

### AUD-DATA-004 - Lotes no sincronizan stock operativo

- ID: `AUD-DATA-004`
- Titulo: `ImportBatchItem.quantityAvailable` no actualiza `ProductVariant.stock`.
- Severidad: Critica.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/import-batches.ts`, `lib/inventory.ts`, `lib/sales.ts`.
- Descripcion: lotes registran disponibilidad y movimiento `IN`, pero la reserva valida contra `ProductVariant.stock`.
- Evidencia encontrada: `actions/import-batches.ts:301-324`, `actions/import-batches.ts:587-610`, `lib/inventory.ts:137-147`, `lib/sales.ts:104-106`.
- Riesgo real: ventas fallan con stock por lote disponible o stock mostrado diverge.
- Recomendacion: unificar fuente de verdad o sincronizar `ProductVariant.stock` transaccionalmente.
- Criterios de aceptacion: venta por lote funciona y mantiene stock/lotes coherentes.
- Tests recomendados: FIFO/lote desde recepcion hasta venta, cancelacion y expiracion.
- Dependencias: decisiones de modelo de inventario.
- Observaciones: P0.

### AUD-DATA-005 - Ajuste manual de stock inseguro

- ID: `AUD-DATA-005`
- Titulo: `adjustStock()` puede dejar stock menor a compromisos y perder updates.
- Severidad: Alta.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/inventory.ts`.
- Descripcion: solo valida `newStock < 0`; no valida `reservedStock + soldStock`; no usa aislamiento `Serializable`.
- Evidencia encontrada: `lib/inventory.ts:327-339`.
- Riesgo real: inventario comprometido inconsistente y race conditions.
- Recomendacion: validar invariantes completos y usar `Serializable` o update condicional.
- Criterios de aceptacion: no se puede reducir por debajo de compromisos; ajustes concurrentes no se pisan.
- Tests recomendados: concurrencia de ajustes e invariant tests.
- Dependencias: `AUD-DATA-004`.
- Observaciones: P1.

### AUD-DATA-006 - Danos/perdidas consumen stock comprometido

- ID: `AUD-DATA-006`
- Titulo: Incidencias de dano/perdida validan stock total, no disponible.
- Severidad: Alta.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/incidents.ts`.
- Descripcion: para inventario propio valida `variant.stock < qty`, pero no `stock - reservedStock - soldStock`.
- Evidencia encontrada: `lib/incidents.ts:497-508`.
- Riesgo real: puede reducir stock comprometido por reservas o ventas.
- Recomendacion: validar disponible real y registrar conflicto si hay unidades comprometidas.
- Criterios de aceptacion: dano/perdida no afecta reservas/ventas existentes.
- Tests recomendados: incidencia sobre variante con reservas activas.
- Dependencias: `AUD-DATA-005`.
- Observaciones: P1.

### AUD-DATA-007 - Descuentos no reflejados en snapshots

- ID: `AUD-DATA-007`
- Titulo: `lineDiscountPen` siempre queda en cero.
- Severidad: Alta.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/order-batch-allocation.ts`, `lib/sales.ts`.
- Descripcion: snapshots por linea usan subtotal bruto y no prorratean descuento del pedido.
- Evidencia encontrada: `lib/order-batch-allocation.ts:603-617`, `lib/sales.ts:127-128`.
- Riesgo real: utilidad bruta y neta por producto/pedido sobrestimada.
- Recomendacion: prorratear descuento por linea y calcular `netLineRevenuePen` real.
- Criterios de aceptacion: pedido con descuento reduce margen por linea y total.
- Tests recomendados: dominio financiero con descuento.
- Dependencias: `AUD-DATA-001`.
- Observaciones: P1.

### AUD-DATA-008 - Reenvio bloqueado por constraint

- ID: `AUD-DATA-008`
- Titulo: Pedido con envio cancelado no puede reenviarse.
- Severidad: Alta.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `prisma/schema.prisma`, `lib/shipments.ts`.
- Descripcion: el codigo permite envio nuevo si el anterior esta `CANCELLED`, pero `ShipmentOrder.orderId` es unico.
- Evidencia encontrada: `prisma/schema.prisma:649-654`, `lib/shipments.ts:132-140`, `lib/shipments.ts:194-197`.
- Riesgo real: operacion de reenvio falla por constraint.
- Recomendacion: cambiar modelo a historial con envio activo unico o liberar relacion al cancelar.
- Criterios de aceptacion: reenvio funciona y no permite dos envios activos.
- Tests recomendados: E2E/dominio de cancelar envio y crear otro.
- Dependencias: estrategia de migraciones.
- Observaciones: P1.

### AUD-DATA-009 - Costos unitarios 4 decimales truncados

- ID: `AUD-DATA-009`
- Titulo: Costos aterrizados pierden precision.
- Severidad: Alta.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/order-batch-allocation.ts`, `lib/money.ts`.
- Descripcion: `toCents()` conserva 2 decimales, pero `landedUnitCostPen` tiene 4 decimales.
- Evidencia encontrada: `lib/money.ts:49-55`, `lib/order-batch-allocation.ts:179-185`.
- Riesgo real: costo y utilidad sub/sobrestimados.
- Recomendacion: crear helper para dinero 4dp o calcular subtotal con Decimal/enteros de menor unidad.
- Criterios de aceptacion: subtotal de lote con costos 4dp redondea correctamente.
- Tests recomendados: unitarios con costos fraccionarios.
- Dependencias: `AUD-DATA-007`.
- Observaciones: P1.

### AUD-DATA-010 - Mutaciones de lotes validan estado fuera de transaccion

- ID: `AUD-DATA-010`
- Titulo: Lotes cerrados pueden modificarse por carrera.
- Severidad: Alta.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/import-batches.ts`.
- Descripcion: varias acciones leen `status !== CLOSED` antes de transaccion y luego escriben sin revalidar dentro.
- Evidencia encontrada: `actions/import-batches.ts:380-406`, `actions/import-batches.ts:564-571`, `actions/import-batches.ts:649-675`, `actions/import-batches.ts:781-804`.
- Riesgo real: una operacion concurrente puede modificar lote recien cerrado.
- Recomendacion: revalidar estado dentro de transaccion `Serializable`.
- Criterios de aceptacion: no se modifica lote cerrado bajo concurrencia.
- Tests recomendados: test de carrera cierre vs edicion.
- Dependencias: ninguna.
- Observaciones: P1/P2.

### AUD-DATA-011 - Faltan constraints de invariantes

- ID: `AUD-DATA-011`
- Titulo: Invariantes financieros y de inventario viven solo en aplicacion.
- Severidad: Media.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `prisma/schema.prisma`.
- Descripcion: no hay checks DB para negativos, creditos disponibles, balances o stock comprometido.
- Evidencia encontrada: modelos `ProductVariant`, `Order`, `Payment`, `CustomerCredit`, `ImportBatchItem`, `Expense`, `Incident`.
- Riesgo real: scripts, bugs o imports pueden persistir datos imposibles.
- Recomendacion: agregar constraints SQL donde Prisma lo permita via migraciones.
- Criterios de aceptacion: DB rechaza invariantes basicos invalidos.
- Tests recomendados: migracion/check constraints con casos negativos.
- Dependencias: migraciones versionadas.
- Observaciones: requiere limpiar datos existentes.

### AUD-DATA-012 - No hay migraciones versionadas

- ID: `AUD-DATA-012`
- Titulo: Schema se aplica con `db:push` sin historial formal.
- Severidad: Media.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `prisma/migrations`.
- Descripcion: no se encontraron migraciones versionadas.
- Evidencia encontrada: carpeta `prisma/migrations` inexistente.
- Riesgo real: dificil reproducir BD, auditar cambios y aplicar constraints en produccion.
- Recomendacion: crear baseline y estrategia formal de migraciones antes de produccion.
- Criterios de aceptacion: migraciones aplican schema desde cero y sobre entorno existente controlado.
- Tests recomendados: levantar BD limpia con migraciones y seed.
- Dependencias: estabilizar cambios P0/P1.
- Observaciones: tambien es riesgo de produccion.

### AUD-DATA-013 - Cierre de reservas ignora pagos aplicados por `PaymentApplication`

- ID: `AUD-DATA-013`
- Titulo: Pagos pendientes multi-pedido pueden quedar vivos al cerrar reserva.
- Severidad: Media.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/order-expiry.ts`, `prisma/schema.prisma`.
- Descripcion: `closeUnpaidReservation()` incluye `payments` por relacion `Order.payments`, no por `PaymentApplication`.
- Evidencia encontrada: `lib/order-expiry.ts:54-59`, `lib/order-expiry.ts:105-116`, `prisma/schema.prisma:513-514`, `prisma/schema.prisma:554-560`.
- Riesgo real: pagos pendientes aplicados a un pedido cerrado quedan pendientes indebidamente.
- Recomendacion: consultar pagos pendientes aplicados y definir regla para multi-pedido.
- Criterios de aceptacion: cerrar reserva gestiona todos los pagos pendientes vinculados.
- Tests recomendados: pago pendiente aplicado a varios pedidos y expiracion de uno.
- Dependencias: `AUD-DATA-014` corregido.
- Observaciones: corregido consultando pagos pendientes via `PaymentApplication`. Si el pago solo estaba aplicado al pedido cerrado, se rechaza; si era multi-pedido, se elimina solo la aplicacion del pedido cerrado y el pago queda pendiente para los demas pedidos. Regresion en `scripts/test-payment-reservation-closure.ts`.

### AUD-DATA-014 - Validacion de pago no valida estado de pedido

- ID: `AUD-DATA-014`
- Titulo: Pago puede validarse contra pedido cerrado si conserva saldo inconsistente.
- Severidad: Media.
- Categoria: Datos.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `lib/payments.ts`.
- Descripcion: al validar, trae pedidos sin `status` y solo compara balance/aplicacion.
- Evidencia encontrada: `lib/payments.ts:330-339`, `lib/payments.ts:350-360`.
- Riesgo real: pago aplicado a pedido cancelado/expirado si hay datos inconsistentes.
- Recomendacion: incluir `status` y bloquear estados cerrados.
- Criterios de aceptacion: pagos no se validan contra `CANCELLED` o `EXPIRED`.
- Tests recomendados: dominio pago vs pedido expirado/cancelado.
- Dependencias: ninguna.
- Observaciones: P1. Corregido bloqueando validacion de pagos aplicados a pedidos `CANCELLED` o `EXPIRED` con error `ORDER_CLOSED`. Regresion en `scripts/test-payment-reservation-closure.ts`.

### AUD-DATA-015 - Recuperos de incidencias no suman a utilidad real

- ID: `AUD-DATA-015`
- Titulo: `recoveredAmount` se calcula pero no aumenta utilidad real.
- Severidad: Media.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/expenses.ts`.
- Descripcion: `incidentRecoveredCents` se calcula pero `realNetProfitCents` resta solo gastos y perdidas.
- Evidencia encontrada: `lib/expenses.ts:341-350`.
- Riesgo real: utilidad real subestimada cuando hay recuperos.
- Recomendacion: definir regla contable y sumar recuperos si corresponde.
- Criterios de aceptacion: reportes reflejan recuperos segun regla acordada.
- Tests recomendados: reporte mensual con perdida y recupero.
- Dependencias: decision contable.
- Observaciones: pendiente de confirmar con negocio.

### AUD-DATA-016 - Gastos validan estado fuera de transaccion

- ID: `AUD-DATA-016`
- Titulo: Edicion/anulacion de gasto tiene carrera.
- Severidad: Media.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/expenses.ts`.
- Descripcion: `updateExpenseAction` y `voidExpenseAction` leen estado antes de transaccion y actualizan despues.
- Evidencia encontrada: `actions/expenses.ts:157-174`, `actions/expenses.ts:230-241`, `actions/expenses.ts:270-295`.
- Riesgo real: editar un gasto recien anulado.
- Recomendacion: revalidar estado dentro de transaccion.
- Criterios de aceptacion: no se actualiza gasto `VOIDED` bajo carrera.
- Tests recomendados: concurrencia edicion vs anulacion.
- Dependencias: ninguna.
- Observaciones: prioridad menor que pagos/stock.

### AUD-DATA-017 - Codigos secuenciales dependen de lectura previa

- ID: `AUD-DATA-017`
- Titulo: Generacion de codigos puede colisionar bajo concurrencia.
- Severidad: Media.
- Categoria: Datos.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/orders.ts`, `lib/import-batches.ts`.
- Descripcion: genera siguiente codigo leyendo el ultimo registro; unique evita duplicado pero puede fallar al usuario.
- Evidencia encontrada: `generateOrderNumber`, `nextBatchCodeWithRetry`.
- Riesgo real: errores `P2002` bajo alta concurrencia.
- Recomendacion: usar retry robusto o secuencia DB.
- Criterios de aceptacion: colisiones concurrentes se reintentan o se evitan.
- Tests recomendados: concurrencia de creacion de pedidos/lotes.
- Dependencias: ninguna.
- Observaciones: lotes ya tienen cierto retry; pedidos requieren manejo mas amigable.

## Arquitectura y mantenibilidad

### AUD-ARCH-001 - Fuente de permisos no unificada

- ID: `AUD-ARCH-001`
- Titulo: Coexisten permisos por rol y permisos por accion sin adopcion consistente.
- Severidad: Media.
- Categoria: Arquitectura.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/permissions.ts`, `lib/authorization.ts`, `actions/*`, `app/(dashboard)/*`.
- Descripcion: nueva capa de permisos existe, pero la mayoria de codigo usa `requireRole`.
- Evidencia encontrada: `lib/authorization.ts:3-6`.
- Riesgo real: nuevas features pueden aplicar reglas distintas.
- Recomendacion: definir patron unico y migrar progresivamente.
- Criterios de aceptacion: permisos testeados por rol y accion.
- Tests recomendados: unit/integracion de matriz.
- Dependencias: `AUD-SEC-005`.
- Observaciones: consolidar junto con sidebar.

### AUD-ARCH-002 - Archivos grandes y alto acoplamiento en reportes

- ID: `AUD-ARCH-002`
- Titulo: Reportes/dashboard concentran demasiadas responsabilidades.
- Severidad: Media.
- Categoria: Arquitectura.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/reportes/page.tsx`, `lib/financial-reports.ts`, `lib/financial-dashboard.ts`.
- Descripcion: multiples secciones, agregadores y reglas financieras viven en archivos grandes.
- Evidencia encontrada: auditoria de estructura y funciones de reportes/dashboard.
- Riesgo real: cambios pequenos pueden romper reportes no relacionados.
- Recomendacion: modularizar por reporte/seccion y agregar tests por modulo.
- Criterios de aceptacion: cada reporte tiene modulo y contrato testeable.
- Tests recomendados: regression por reporte.
- Dependencias: corregir bugs P0/P1 antes de refactor grande.
- Observaciones: no bloquear P0 por este refactor.

### AUD-ARCH-003 - Documentacion funcional desalineada

- ID: `AUD-ARCH-003`
- Titulo: Requerimientos formales llegan a Sprint 15, README a Sprint 27.
- Severidad: Baja.
- Categoria: Arquitectura.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `docs/REQUERIMIENTOS_FUNCIONALES.md`, `README.md`, `CHANGELOG.md`.
- Descripcion: la fuente funcional no documenta formalmente las features financieras recientes.
- Evidencia encontrada: `docs/REQUERIMIENTOS_FUNCIONALES.md:546-574`.
- Riesgo real: auditorias futuras no tienen fuente unica de verdad.
- Recomendacion: actualizar requisitos hasta Sprint 27 o documentar brecha.
- Criterios de aceptacion: docs reflejan estado real y pendientes.
- Tests recomendados: revision documental.
- Dependencias: completar o diferir funcionalidades faltantes.
- Observaciones: esta carpeta inicia la trazabilidad.

### AUD-ARCH-004 - README contradice estrategia de cache

- ID: `AUD-ARCH-004`
- Titulo: README menciona cache en memoria para settings.
- Severidad: Baja.
- Categoria: Arquitectura.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `README.md`, `lib/settings.ts`, `AGENTS.md`.
- Descripcion: la documentacion antigua habla de cache en memoria, pero las reglas actuales usan cache distribuible de Next con tags.
- Evidencia encontrada: `README.md:300`, `AGENTS.md`.
- Riesgo real: futuros cambios pueden reintroducir cache en proceso incompatible con serverless.
- Recomendacion: actualizar README.
- Criterios de aceptacion: documentacion no recomienda cache en memoria.
- Tests recomendados: revision documental.
- Dependencias: ninguna.
- Observaciones: cambio documental.

## Performance

### AUD-PERF-001 - Dashboard financiero duplica trabajo y tiene N+1

- ID: `AUD-PERF-001`
- Titulo: Baja rotacion se calcula varias veces y con consulta por variante.
- Severidad: Alta.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/dashboard/page.tsx`, `lib/financial-dashboard.ts`.
- Descripcion: dashboard llama baja rotacion y alertas; alertas vuelven a calcular overview y baja rotacion.
- Evidencia encontrada: `app/(dashboard)/dashboard/page.tsx:377-399`, `lib/financial-dashboard.ts:570-609`, `lib/financial-dashboard.ts:841-842`.
- Riesgo real: timeout y alto costo DB con catalogo grande.
- Recomendacion: compartir resultados, usar agregacion por variante y limitar datos.
- Criterios de aceptacion: sin N+1 y sin recalculo duplicado.
- Tests recomendados: performance smoke con miles de variantes.
- Dependencias: ninguna.
- Observaciones: P1/P2.

### AUD-PERF-002 - Reportes y CSV cargan datasets completos

- ID: `AUD-PERF-002`
- Titulo: Reportes financieros/exportaciones no tienen limites consistentes.
- Severidad: Alta.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/financial-reports.ts`, `app/api/reportes/[section]/route.ts`, `lib/csv-export.ts`.
- Descripcion: varias funciones usan `findMany` sin `take`; CSV se arma completo en memoria.
- Evidencia encontrada: `lib/financial-reports.ts` reportes de productos, lotes, stock, clientes, devoluciones; `lib/csv-export.ts:42-49`.
- Riesgo real: memoria/timeout en Vercel.
- Recomendacion: paginar, limitar, stream CSV o generar jobs/exportaciones controladas.
- Criterios de aceptacion: exportaciones grandes no bloquean serverless ni ocultan truncamiento.
- Tests recomendados: dataset grande y medicion de tiempo/memoria.
- Dependencias: definicion de volumen esperado.
- Observaciones: no cachear datos financieros sensibles sin decision.

### AUD-PERF-003 - Rentabilidad por lote carga grafo completo

- ID: `AUD-PERF-003`
- Titulo: `getBatchProfitabilityReport()` filtra historico en JS.
- Severidad: Alta.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/financial-reports.ts`.
- Descripcion: carga lotes, items, allocations, orderItem y order sin `take`, luego filtra fecha/estado en loops.
- Evidencia encontrada: `lib/financial-reports.ts:468-527`.
- Riesgo real: payload excesivo y tiempos crecientes.
- Recomendacion: consultar asignaciones relevantes con filtros en DB.
- Criterios de aceptacion: reporte filtra en DB y limita resultados.
- Tests recomendados: performance con muchos lotes/asignaciones.
- Dependencias: tests de rentabilidad.
- Observaciones: P2.

### AUD-PERF-004 - Falta indice para `status + profitCalculatedAt`

- ID: `AUD-PERF-004`
- Titulo: Reportes financieros filtran por `Order.status` y `profitCalculatedAt` sin indice compuesto.
- Severidad: Alta.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `prisma/schema.prisma`, `lib/financial-dashboard.ts`, `lib/financial-reports.ts`.
- Descripcion: schema tiene indices por status/createdAt/expiresAt, pero no status/profitCalculatedAt.
- Evidencia encontrada: `prisma/schema.prisma:455-463`.
- Riesgo real: scans sobre ordenes pagadas en reportes mensuales.
- Recomendacion: correr `EXPLAIN ANALYZE` y agregar indice si mejora.
- Criterios de aceptacion: plan de consulta usa indice y costo de escritura es aceptable.
- Tests recomendados: explain antes/despues.
- Dependencias: migraciones versionadas.
- Observaciones: no agregar sin medicion.

### AUD-PERF-005 - Baja rotacion de reportes tiene N+1

- ID: `AUD-PERF-005`
- Titulo: `getLowRotationReport()` consulta ultima venta por variante.
- Severidad: Alta.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/financial-reports.ts`.
- Descripcion: carga variantes candidatas y hace `orderItem.findFirst` por cada una.
- Evidencia encontrada: `lib/financial-reports.ts:760-797`.
- Riesgo real: muchas queries para reportes/exportaciones.
- Recomendacion: agrupar ultima venta por variante en una consulta.
- Criterios de aceptacion: numero de queries no crece linealmente por variante.
- Tests recomendados: performance/regresion con muchas variantes.
- Dependencias: ninguna.
- Observaciones: similar a `AUD-PERF-001`.

### AUD-PERF-006 - Export de gastos trunca a 1000 filas

- ID: `AUD-PERF-006`
- Titulo: CSV de gastos parece completo pero limita a 1000.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/api/reportes/[section]/route.ts`, `app/(dashboard)/reportes/page.tsx`.
- Descripcion: `runExpensesReport` usa `perPage: 1000` sin comunicarlo.
- Evidencia encontrada: `app/api/reportes/[section]/route.ts:289-298`.
- Riesgo real: exportacion incompleta y decisiones basadas en datos truncados.
- Recomendacion: indicar limite, paginar export o exportar completo de forma controlada.
- Criterios de aceptacion: usuario conoce alcance o recibe export completo.
- Tests recomendados: reporte con mas de 1000 gastos.
- Dependencias: estrategia CSV.
- Observaciones: tambien afecta UX/confianza.

### AUD-PERF-007 - Overview financiero hace aggregates duplicados

- ID: `AUD-PERF-007`
- Titulo: `getFinancialOverview()` usa multiples aggregates separadas.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/financial-dashboard.ts`.
- Descripcion: suma campos de orden en varias queries separadas sobre el mismo filtro.
- Evidencia encontrada: revision de `getFinancialOverview()`.
- Riesgo real: roundtrips y carga DB innecesaria.
- Recomendacion: consolidar aggregates.
- Criterios de aceptacion: una consulta suma multiples campos cuando sea posible.
- Tests recomendados: snapshot de resultados antes/despues.
- Dependencias: ninguna.
- Observaciones: optimizacion posterior a P0.

### AUD-PERF-008 - Fallback mensual puede hacer muchas consultas

- ID: `AUD-PERF-008`
- Titulo: Fallback de ventas por mes escala por cantidad de meses.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/financial-reports.ts`.
- Descripcion: si falla raw SQL, fallback itera meses y hace consultas por mes.
- Evidencia encontrada: auditoria de `getSalesByMonthReport()`.
- Riesgo real: hasta cientos de queries en rangos largos.
- Recomendacion: fallback con groupBy o limite de rango.
- Criterios de aceptacion: fallback mantiene numero acotado de queries.
- Tests recomendados: forzar fallback en rango largo.
- Dependencias: ninguna.
- Observaciones: raw SQL actual esta parametrizado.

### AUD-PERF-009 - Reporte de lives calcula metricas incorrectamente

- ID: `AUD-PERF-009`
- Titulo: Agregados de lives se repiten para cada live.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/reports.ts`.
- Descripcion: agrega todos los `liveIds` juntos y asigna el mismo resultado a cada live.
- Evidencia encontrada: `lib/reports.ts:665-700`.
- Riesgo real: reporte enganoso con totales inflados/repetidos.
- Recomendacion: agrupar por `liveSessionId`.
- Criterios de aceptacion: cada live muestra metricas propias.
- Tests recomendados: reporte con dos lives y ventas distintas.
- Dependencias: ninguna.
- Observaciones: categorizado como performance por ubicacion, pero es bug funcional de reporte.

### AUD-PERF-010 - Historial de movimientos sin paginacion

- ID: `AUD-PERF-010`
- Titulo: Detalle de inventario carga todos los movimientos.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/inventory.ts`, `app/(dashboard)/inventario/[variantId]/page.tsx`.
- Descripcion: `getMovementHistory()` usa `findMany` sin `take`.
- Evidencia encontrada: `lib/inventory.ts:356-361`.
- Riesgo real: pagina lenta para variantes antiguas.
- Recomendacion: paginar o limitar historial reciente con link a vista completa.
- Criterios de aceptacion: detalle carga rapido con miles de movimientos.
- Tests recomendados: performance manual con fixture grande.
- Dependencias: ninguna.
- Observaciones: P2/P3.

### AUD-PERF-011 - Pagina de producto carga demasiados datos

- ID: `AUD-PERF-011`
- Titulo: Detalle de producto incluye todas las variantes e imagenes.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/productos/[id]/page.tsx`.
- Descripcion: `findUnique` incluye variantes e imagenes sin limite.
- Evidencia encontrada: auditoria de pagina de producto.
- Riesgo real: payload grande y render lento para productos con muchas variantes.
- Recomendacion: paginar variantes/imagenes o usar tabs con carga separada.
- Criterios de aceptacion: pagina mantiene performance con catalogo grande.
- Tests recomendados: fixture con muchas variantes.
- Dependencias: ninguna.
- Observaciones: prioridad media.

### AUD-PERF-012 - Top productos historico muestra ingresos cero

- ID: `AUD-PERF-012`
- Titulo: Revenue historico de top productos es dummy.
- Severidad: Media.
- Categoria: Performance.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/reports.ts`.
- Descripcion: modo sin rango calcula revenue con expresion que siempre da 0.
- Evidencia encontrada: `lib/reports.ts:930-934`.
- Riesgo real: reporte enganoso.
- Recomendacion: calcular revenue real con agregacion historica o ocultar columna en modo acumulado.
- Criterios de aceptacion: revenue no muestra cero falso.
- Tests recomendados: reporte historico con ventas.
- Dependencias: ninguna.
- Observaciones: bug funcional de reporte.

## Experiencia de usuario

### AUD-UX-001 - WhatsAppActions puede romper sin contexto

- ID: `AUD-UX-001`
- Titulo: Plantillas disponibles no respetan datos requeridos.
- Severidad: Alta.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/whatsapp.ts`, `app/(dashboard)/clientes/[id]/page.tsx`.
- Descripcion: `getAvailableTemplates()` devuelve plantillas que requieren `order` aunque `hasOrder=false`.
- Evidencia encontrada: `lib/whatsapp.ts:227-295`, `lib/whatsapp.ts:303-326`, `app/(dashboard)/clientes/[id]/page.tsx:180-197`.
- Riesgo real: TypeError en ficha de cliente sin pedido/credito.
- Recomendacion: filtrar plantillas segun contexto real o validar input antes de construir mensaje.
- Criterios de aceptacion: ficha de cliente sin pedido no rompe.
- Tests recomendados: unitario de plantillas y render de ficha.
- Dependencias: ninguna.
- Observaciones: bug rapido de corregir.

### AUD-UX-002 - Dashboard de despacho enlaza a rutas no permitidas

- ID: `AUD-UX-002`
- Titulo: `DISPATCH` ve links a modulos que no puede abrir.
- Severidad: Alta.
- Categoria: UX.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `app/(dashboard)/dashboard/page.tsx`, `actions/orders.ts`, `components/layout/sidebar.tsx`.
- Descripcion: dashboard usa links a pedidos, pagos, ventas y lives aunque sidebar/guards no los permiten.
- Evidencia encontrada: `app/(dashboard)/dashboard/page.tsx:620-639`, `app/(dashboard)/dashboard/page.tsx:681`, `app/(dashboard)/dashboard/page.tsx:714-731`.
- Riesgo real: flujo de despacho roto y redirecciones inesperadas.
- Recomendacion: alinear dashboard con permisos reales o ampliar lectura para despacho.
- Criterios de aceptacion: todos los links visibles para `DISPATCH` son navegables.
- Tests recomendados: E2E dashboard dispatch.
- Dependencias: `AUD-SEC-005`.
- Observaciones: en 0.33.0 el dashboard de `DISPATCH` deja de enlazar a pagos, pedidos, clientes, lives y ventas; los pedidos listos apuntan a `/envios/nuevo?orderId=...`.

### AUD-UX-003 - Preseleccion de envio falla para despacho

- ID: `AUD-UX-003`
- Titulo: `/envios/nuevo?customerId&orderId` usa actions no permitidas para `DISPATCH`.
- Severidad: Alta.
- Categoria: UX.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `app/(dashboard)/envios/nuevo/page.tsx`, `actions/customers.ts`, `actions/orders.ts`.
- Descripcion: pagina permite `ADMIN|DISPATCH`, pero preseleccion llama acciones que requieren `ADMIN|SELLER`.
- Evidencia encontrada: auditoria de permisos y pagina de nuevo envio.
- Riesgo real: despacho no puede crear envio desde link preseleccionado.
- Recomendacion: crear loaders de solo lectura permitidos para despacho o ajustar permisos.
- Criterios de aceptacion: `DISPATCH` puede abrir nuevo envio preseleccionado.
- Tests recomendados: E2E dispatch crear envio desde pedido elegible.
- Dependencias: `AUD-SEC-005`.
- Observaciones: en 0.33.0 `/envios/nuevo` usa `getShipmentDraftDefaultsAction`, permitido para `ADMIN`/`DISPATCH`, y solo precarga pedidos `PAID` elegibles para envio.

### AUD-UX-004 - Ajuste de inventario visible para roles no autorizados

- ID: `AUD-UX-004`
- Titulo: Formulario de ajuste aparece aunque action exige admin.
- Severidad: Media.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/inventario/[variantId]/page.tsx`, `actions/inventory.ts`.
- Descripcion: pagina permite `ADMIN|SELLER|DISPATCH` y siempre renderiza `InventoryAdjustForm`; action exige `ADMIN`.
- Evidencia encontrada: `app/(dashboard)/inventario/[variantId]/page.tsx:26`, `app/(dashboard)/inventario/[variantId]/page.tsx:98-109`.
- Riesgo real: usuarios ven acciones que fallan al enviar.
- Recomendacion: ocultar o deshabilitar por permiso.
- Criterios de aceptacion: solo roles autorizados ven ajuste.
- Tests recomendados: E2E por rol.
- Dependencias: `AUD-SEC-005`.
- Observaciones: relacionado con permisos.

### AUD-UX-005 - Ajuste de inventario sin confirmacion

- ID: `AUD-UX-005`
- Titulo: Accion destructiva de inventario se ejecuta directo.
- Severidad: Media.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/forms/inventory-adjust-form.tsx`.
- Descripcion: submit directo sin `ConfirmDialog`.
- Evidencia encontrada: auditoria del formulario de ajuste.
- Riesgo real: errores operativos de stock por click o dato incorrecto.
- Recomendacion: agregar confirmacion y resumen del ajuste.
- Criterios de aceptacion: ajuste requiere confirmacion explicita.
- Tests recomendados: E2E/manual de confirmacion.
- Dependencias: ninguna.
- Observaciones: RNF documentado lo exige.

### AUD-UX-006 - Activar/desactivar categoria sin confirmacion ni feedback

- ID: `AUD-UX-006`
- Titulo: Toggle de categoria ejecuta accion directa.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/tables/categories-table.tsx`.
- Descripcion: toggle llama action inmediatamente, sin pending/error claro.
- Evidencia encontrada: auditoria de tabla de categorias.
- Riesgo real: cambios accidentales e incertidumbre ante error.
- Recomendacion: confirmacion o undo/feedback robusto.
- Criterios de aceptacion: usuario confirma o puede ver resultado/error.
- Tests recomendados: manual/UI.
- Dependencias: ninguna.
- Observaciones: prioridad baja.

### AUD-UX-007 - Cambio de estado de variante sin confirmacion

- ID: `AUD-UX-007`
- Titulo: Select de estado ejecuta cambio inmediato.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/forms/product-lifecycle-actions.tsx`.
- Descripcion: cambiar select dispara `setVariantStatusAction` sin confirmacion.
- Evidencia encontrada: auditoria del componente.
- Riesgo real: variante oculta/archivada accidentalmente.
- Recomendacion: confirmacion para estados sensibles.
- Criterios de aceptacion: archivar/ocultar requiere confirmacion o undo.
- Tests recomendados: manual/UI.
- Dependencias: ninguna.
- Observaciones: prioridad baja.

### AUD-UX-008 - Cancelacion de envio permite motivo vacio

- ID: `AUD-UX-008`
- Titulo: Motivo de cancelacion de envio es opcional.
- Severidad: Media.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/forms/shipment-status-actions.tsx`, `actions/shipments.ts`.
- Descripcion: UI indica motivo opcional y Zod lo permite.
- Evidencia encontrada: auditoria de form/action de envio.
- Riesgo real: auditoria operativa debil.
- Recomendacion: hacer motivo obligatorio si la politica de negocio lo requiere.
- Criterios de aceptacion: cancelacion guarda motivo no vacio o decision documentada.
- Tests recomendados: E2E cancelacion sin motivo.
- Dependencias: decision funcional.
- Observaciones: pendiente de confirmar.

### AUD-UX-009 - Cliente bloqueado no impide venta

- ID: `AUD-UX-009`
- Titulo: Estado `BLOCKED` es informativo aunque ventas ya existen.
- Severidad: Media.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/sales.ts`, `app/(dashboard)/clientes/[id]/page.tsx`.
- Descripcion: `createQuickSale()` valida existencia de cliente, no estado `BLOCKED`.
- Evidencia encontrada: `lib/sales.ts:79-84`, `app/(dashboard)/clientes/[id]/page.tsx:138-142`.
- Riesgo real: venta a cliente marcado como bloqueado.
- Recomendacion: bloquear venta o pedir override admin documentado.
- Criterios de aceptacion: regla de bloqueo se aplica en servidor.
- Tests recomendados: venta con cliente bloqueado.
- Dependencias: decision de negocio.
- Observaciones: tambien afecta datos/operacion.

### AUD-UX-010 - Buscador global decorativo

- ID: `AUD-UX-010`
- Titulo: Header muestra buscador sin funcionalidad.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/layout/header.tsx`.
- Descripcion: input de busqueda no tiene accion, navegacion ni handlers.
- Evidencia encontrada: `components/layout/header.tsx:61-67`.
- Riesgo real: expectativa falsa para usuarios.
- Recomendacion: implementar busqueda global o retirarla.
- Criterios de aceptacion: input busca o no se muestra.
- Tests recomendados: manual/UI.
- Dependencias: decision de producto.
- Observaciones: mejora futura.

### AUD-UX-011 - Menu movil queda oculto

- ID: `AUD-UX-011`
- Titulo: Sheet movil renderiza sidebar con `hidden md:flex`.
- Severidad: Media.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/layout/header.tsx`, `components/layout/sidebar.tsx`.
- Descripcion: el menu movil abre un `Sidebar` que sigue oculto por clases responsive.
- Evidencia encontrada: `components/layout/header.tsx:56-58`, `components/layout/sidebar.tsx:65`.
- Riesgo real: navegacion movil rota.
- Recomendacion: extraer nav reusable o agregar variante movil.
- Criterios de aceptacion: menu movil muestra links navegables por rol.
- Tests recomendados: E2E viewport movil.
- Dependencias: ninguna.
- Observaciones: importante para uso en tienda/operacion movil.

### AUD-UX-012 - Dashboard despacho tiene metricas placeholder

- ID: `AUD-UX-012`
- Titulo: Cards de despacho muestran `—`.
- Severidad: Media.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/dashboard/page.tsx`.
- Descripcion: estados de envio para `DISPATCH` no muestran conteos reales.
- Evidencia encontrada: `app/(dashboard)/dashboard/page.tsx:643-667`.
- Riesgo real: dashboard no cumple promesa operativa.
- Recomendacion: agregar agregados por estado de envio.
- Criterios de aceptacion: cards muestran conteos reales.
- Tests recomendados: E2E o integracion dashboard dispatch.
- Dependencias: `AUD-UX-002`.
- Observaciones: funcionalidad incompleta.

### AUD-UX-013 - Venta rapida pierde WhatsApp seleccionado

- ID: `AUD-UX-013`
- Titulo: Cliente seleccionado no muestra WhatsApp real.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/forms/quick-sale-form.tsx`.
- Descripcion: muestra `formatWhatsAppDisplay("")` tras seleccionar clienta.
- Evidencia encontrada: auditoria de `quick-sale-form`.
- Riesgo real: operadora no confirma numero durante live.
- Recomendacion: conservar y mostrar WhatsApp seleccionado.
- Criterios de aceptacion: cliente seleccionado muestra nombre y telefono.
- Tests recomendados: UI/manual.
- Dependencias: ninguna.
- Observaciones: mejora rapida.

### AUD-UX-014 - Pago manual calcula `canSubmit` pero no lo aplica

- ID: `AUD-UX-014`
- Titulo: Submit de pago manual no se deshabilita con datos incompletos.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `components/forms/create-payment-form.tsx`.
- Descripcion: `canSubmit` se calcula, pero `SubmitButton` solo depende de pending.
- Evidencia encontrada: auditoria de `create-payment-form`.
- Riesgo real: feedback tardio desde servidor en flujo critico.
- Recomendacion: deshabilitar submit y mostrar motivos.
- Criterios de aceptacion: submit se habilita solo con datos minimos validos.
- Tests recomendados: UI/manual.
- Dependencias: ninguna.
- Observaciones: no sustituye validacion servidor.

### AUD-UX-015 - Loading generico para todo dashboard group

- ID: `AUD-UX-015`
- Titulo: Skeleton de dashboard se usa para rutas heterogeneas.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/loading.tsx`.
- Descripcion: loading no corresponde a formularios, detalles o reportes.
- Evidencia encontrada: auditoria de loading.
- Riesgo real: experiencia inconsistente.
- Recomendacion: loading por segmento o skeleton mas generico.
- Criterios de aceptacion: loading representa la pantalla real o no confunde.
- Tests recomendados: manual.
- Dependencias: ninguna.
- Observaciones: baja prioridad.

### AUD-UX-016 - Error boundaries genericos

- ID: `AUD-UX-016`
- Titulo: Errores no dan contexto por modulo.
- Severidad: Baja.
- Categoria: UX.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/error.tsx`, `app/(dashboard)/error.tsx`.
- Descripcion: mensaje unico para pagos, inventario, reportes y otros modulos.
- Evidencia encontrada: auditoria de error boundaries.
- Riesgo real: soporte y recuperacion mas dificiles.
- Recomendacion: boundaries por modulo o mensajes con acciones contextuales.
- Criterios de aceptacion: errores criticos ofrecen accion util.
- Tests recomendados: manual.
- Dependencias: ninguna.
- Observaciones: mejora futura.

## Testing

### AUD-TEST-001 - Scripts de dominio no integrados a CI

- ID: `AUD-TEST-001`
- Titulo: Pruebas financieras se ejecutan manualmente.
- Severidad: Media.
- Categoria: Testing.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `package.json`, `.github/workflows/ci.yml`, `scripts/test-*.ts`.
- Descripcion: scripts de dominio existen, pero no estan agrupados en package/CI.
- Evidencia encontrada: `package.json` solo expone `typecheck`, `lint`, `verify`, `test:e2e`.
- Riesgo real: regresiones financieras no bloquean merge.
- Recomendacion: agregar scripts y job CI para dominio.
- Criterios de aceptacion: CI ejecuta tests de dominio relevantes.
- Tests recomendados: los propios scripts.
- Dependencias: `AUD-PROD-001`.
- Observaciones: no reemplaza E2E.

### AUD-TEST-002 - Smoke E2E deja datos persistentes

- ID: `AUD-TEST-002`
- Titulo: Smoke crea clientes sin cleanup alineado.
- Severidad: Baja.
- Categoria: Testing.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `e2e/smoke.spec.ts`, `e2e/fixtures/db.ts`.
- Descripcion: crea `Cliente E2E ...` y cleanup compartido no parece cubrir ese patron.
- Evidencia encontrada: `e2e/smoke.spec.ts:10-27`.
- Riesgo real: base E2E contaminada entre corridas.
- Recomendacion: usar prefijo comun y cleanup o base efimera.
- Criterios de aceptacion: E2E no acumula datos residuales.
- Tests recomendados: dos corridas consecutivas.
- Dependencias: ninguna.
- Observaciones: relevante si se reutiliza DB E2E.

### AUD-TEST-003 - Playwright no genera trace actualmente

- ID: `AUD-TEST-003`
- Titulo: `trace: on-first-retry` con `retries: 0` no produce trazas.
- Severidad: Baja.
- Categoria: Testing.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `playwright.config.ts`.
- Descripcion: al no haber retry, no hay first retry.
- Evidencia encontrada: `playwright.config.ts:26`, `playwright.config.ts:34`.
- Riesgo real: diagnostico pobre en CI.
- Recomendacion: usar `trace: retain-on-failure` o habilitar retries en CI.
- Criterios de aceptacion: fallo E2E genera artefacto util.
- Tests recomendados: forzar fallo controlado en rama temporal.
- Dependencias: ninguna.
- Observaciones: cambio de config, no de negocio.

### AUD-TEST-004 - Faltan pruebas de permisos y seguridad

- ID: `AUD-TEST-004`
- Titulo: No hay suite integral de autorizacion por rol.
- Severidad: Media.
- Categoria: Testing.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `e2e/*`, `actions/*`, `lib/authorization.ts`.
- Descripcion: los hallazgos de RBAC no estan protegidos por pruebas sistematicas.
- Evidencia encontrada: auditoria de rutas/actions/sidebar.
- Riesgo real: regresiones de permisos pasan desapercibidas.
- Recomendacion: crear matriz de acceso por rol y tests.
- Criterios de aceptacion: rutas/actions criticas tienen expectativas por rol.
- Tests recomendados: E2E y tests de integracion de server actions.
- Dependencias: `AUD-SEC-005`.
- Observaciones: obligatorio antes de produccion.

## Produccion

### AUD-PROD-001 - CI E2E usa base inexistente

- ID: `AUD-PROD-001`
- Titulo: GitHub Actions crea `ci` pero E2E apunta a `ci_e2e`.
- Severidad: Critica.
- Categoria: Produccion.
- Estado: Corregido.
- Archivo, ruta o modulo afectado: `.github/workflows/ci.yml`.
- Descripcion: servicio Postgres crea una DB distinta a la del `DATABASE_URL` E2E.
- Evidencia encontrada: `.github/workflows/ci.yml:45-50`, `.github/workflows/ci.yml:59-60`, `.github/workflows/ci.yml:79`.
- Riesgo real: E2E falla antes de correr o no valida lo esperado.
- Recomendacion: usar misma DB o crear `ci_e2e` antes de `db:push`.
- Criterios de aceptacion: CI E2E corre schema, seed y tests contra DB existente.
- Tests recomendados: ejecutar workflow.
- Dependencias: ninguna.
- Observaciones: P0/P1. Se ajusto `.github/workflows/ci.yml` para que E2E use la misma base `ci` que crea Postgres y se agregaron URLs `E2E_*` alineadas. Tambien se ajusto el fixture E2E para Prisma 7 con `@prisma/adapter-pg` y `lib/settings.ts` para permitir pruebas de dominio fuera del runtime Next. Corregido tras confirmacion de workflow `CI` exitoso en GitHub Actions.

### AUD-PROD-002 - No hay `vercel.json`

- ID: `AUD-PROD-002`
- Titulo: Configuracion operacional de Vercel no esta explicitada.
- Severidad: Baja.
- Categoria: Produccion.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `vercel.json` inexistente.
- Descripcion: no hay duraciones/regiones/politicas especificas para rutas pesadas.
- Evidencia encontrada: no se encontro `vercel.json`.
- Riesgo real: reportes pesados dependen de defaults de plataforma.
- Recomendacion: definir solo si se justifica tras optimizar reportes.
- Criterios de aceptacion: configuracion productiva documentada o decision de no usarla.
- Tests recomendados: deploy preview con reportes.
- Dependencias: optimizaciones performance.
- Observaciones: no es obligatorio, pero util.

### AUD-PROD-003 - Secretos y rotacion productiva pendientes

- ID: `AUD-PROD-003`
- Titulo: Riesgo operativo de secretos locales y variables productivas.
- Severidad: Alta.
- Categoria: Produccion.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `.env`, `.env.example`, Vercel env.
- Descripcion: hay secretos locales no trackeados y produccion requiere rotacion/gestion segura.
- Evidencia encontrada: `.env` ignorado, `.env.example` define variables necesarias.
- Riesgo real: fuga de DB, Blob o Auth secret.
- Recomendacion: secret manager, rotacion previa a produccion y checklist.
- Criterios de aceptacion: variables productivas configuradas en Vercel y secretos no compartidos.
- Tests recomendados: secret scanning y revision manual.
- Dependencias: acceso a proveedores.
- Observaciones: relacionado con `AUD-SEC-009`.

### AUD-PROD-004 - Produccion sin migraciones formales

- ID: `AUD-PROD-004`
- Titulo: Deploy depende de `db:push`.
- Severidad: Media.
- Categoria: Produccion.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `prisma/schema.prisma`, scripts de deploy.
- Descripcion: documentacion actual usa `db:push`; no hay historial formal para prod.
- Evidencia encontrada: README/AGENTS y ausencia de `prisma/migrations`.
- Riesgo real: cambios de schema no auditables y rollback dificil.
- Recomendacion: crear baseline y migraciones antes de datos reales.
- Criterios de aceptacion: produccion aplica migraciones versionadas.
- Tests recomendados: restaurar DB limpia desde migraciones.
- Dependencias: `AUD-DATA-012`.
- Observaciones: bloquear antes de produccion real.

### AUD-PROD-005 - Falta estrategia explicita de observabilidad, backups y rollback

- ID: `AUD-PROD-005`
- Titulo: Operacion productiva no esta completamente definida.
- Severidad: Media.
- Categoria: Produccion.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: documentacion de deploy y plataforma.
- Descripcion: se documenta deploy basico, pero faltan detalles de monitoreo, alertas, backups, restauracion y rollback.
- Evidencia encontrada: revision de README y docs actuales.
- Riesgo real: respuesta lenta ante incidentes o perdida de datos.
- Recomendacion: definir checklist productivo, backups Neon, logs, alertas y rollback.
- Criterios de aceptacion: existe runbook minimo de produccion.
- Tests recomendados: simulacro de restore/rollback en staging.
- Dependencias: definicion de plataforma final.
- Observaciones: ver `06-riesgos-produccion.md`.

## Funcionalidades faltantes o incompletas

### AUD-FUNC-001 - Historial de cliente incompleto

- ID: `AUD-FUNC-001`
- Titulo: Ficha de cliente mantiene placeholders de pedidos y pagos.
- Severidad: Alta.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `app/(dashboard)/clientes/[id]/page.tsx`.
- Descripcion: se muestran tarjetas `Disponible en Sprint` para historial.
- Evidencia encontrada: `app/(dashboard)/clientes/[id]/page.tsx:199-213`.
- Riesgo real: ficha no cumple flujo esperado de consulta de cliente.
- Recomendacion: mostrar historial real paginado de pedidos, pagos y creditos/envios relacionados.
- Criterios de aceptacion: no hay placeholders y los datos enlazan a detalles.
- Tests recomendados: E2E detalle cliente con pedidos/pagos.
- Dependencias: ninguna.
- Observaciones: P2.

### AUD-FUNC-002 - UI de creditos incompleta

- ID: `AUD-FUNC-002`
- Titulo: Acciones de creditos existen, pero no hay UI operativa.
- Severidad: Alta.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/credits.ts`, `components/dashboard/customer-credits-history.tsx`.
- Descripcion: se puede listar credito, pero no crear manual, aplicar a pedido o registrar devolucion desde UI.
- Evidencia encontrada: acciones en `actions/credits.ts`; UI informativa en `components/dashboard/customer-credits-history.tsx:131-141`.
- Riesgo real: funcionalidades prometidas no son ejecutables por usuarios.
- Recomendacion: crear formularios con permisos, validacion y auditoria.
- Criterios de aceptacion: admin/seller puede operar creditos desde UI.
- Tests recomendados: E2E credito manual, aplicacion y devolucion.
- Dependencias: `AUD-DATA-001`, `AUD-DATA-014`.
- Observaciones: cuidado porque aplicar credito puede cerrar pedido y mover stock.

### AUD-FUNC-003 - Edicion de aplicaciones de pago no expuesta

- ID: `AUD-FUNC-003`
- Titulo: `updatePaymentApplicationsAction` no tiene consumidor UI.
- Severidad: Media.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/payments.ts`, `app/(dashboard)/pagos/[id]/page.tsx`.
- Descripcion: si un pago pendiente fue mal aplicado, no hay flujo visible de correccion.
- Evidencia encontrada: accion existe y detalle solo muestra aplicaciones.
- Riesgo real: operadores no pueden corregir pagos sin intervencion tecnica.
- Recomendacion: agregar UI para editar aplicaciones antes de validar.
- Criterios de aceptacion: pago pendiente permite modificar aplicaciones con validacion.
- Tests recomendados: E2E editar aplicaciones.
- Dependencias: `AUD-DATA-014`.
- Observaciones: P2.

### AUD-FUNC-004 - Edicion de envios sin UI

- ID: `AUD-FUNC-004`
- Titulo: `updateShipmentAction` no esta expuesta en detalle de envio.
- Severidad: Media.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/shipments.ts`, `app/(dashboard)/envios/[id]/page.tsx`.
- Descripcion: no hay formulario para tracking, agencia, costo, direccion o notas despues de crear.
- Evidencia encontrada: auditoria de detalle de envio y action existente.
- Riesgo real: despacho no puede corregir informacion operativa.
- Recomendacion: crear pagina/form de edicion con restricciones por estado.
- Criterios de aceptacion: admin/dispatch edita datos permitidos y queda auditado.
- Tests recomendados: E2E editar envio.
- Dependencias: `AUD-DATA-008`.
- Observaciones: P2.

### AUD-FUNC-005 - Gestion de lotes sin UI completa

- ID: `AUD-FUNC-005`
- Titulo: Actions de lotes no estan completamente accesibles desde UI.
- Severidad: Media.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `actions/import-batches.ts`, `app/(dashboard)/lotes/[id]/page.tsx`.
- Descripcion: existen update/add/remove/recalculate, pero detalle expone principalmente recalculo.
- Evidencia encontrada: auditoria de actions y detalle de lote.
- Riesgo real: gestion real de lotes queda incompleta.
- Recomendacion: agregar UI para editar lote, estado e items con guardas.
- Criterios de aceptacion: lote no cerrado se puede gestionar desde UI; cerrado queda bloqueado.
- Tests recomendados: E2E gestion lote.
- Dependencias: `AUD-DATA-004`, `AUD-DATA-010`.
- Observaciones: no implementar antes de corregir consistencia de stock.

### AUD-FUNC-006 - Costeo manual es placeholder

- ID: `AUD-FUNC-006`
- Titulo: Metodo `MANUAL` distribuye cero costos adicionales.
- Severidad: Alta.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `lib/import-batch-costing.ts`, settings financieros.
- Descripcion: UI/settings exponen manual, pero la funcion devuelve distribucion cero.
- Evidencia encontrada: `lib/import-batch-costing.ts:295-327`.
- Riesgo real: rentabilidad subestimada si se configura `MANUAL`.
- Recomendacion: implementar overrides por item o retirar opcion hasta completar.
- Criterios de aceptacion: `MANUAL` distribuye costos reales o no puede seleccionarse.
- Tests recomendados: unitarios de costeo manual o test de bloqueo de configuracion.
- Dependencias: decision funcional.
- Observaciones: P1/P2 segun uso real.

### AUD-FUNC-007 - Modelo no cubre costo real de envio prometido

- ID: `AUD-FUNC-007`
- Titulo: No existen campos financieros para costo real de delivery asumido.
- Severidad: Media.
- Categoria: Funcionalidades faltantes.
- Estado: Pendiente.
- Archivo, ruta o modulo afectado: `prisma/schema.prisma`, reportes financieros, envios.
- Descripcion: documentacion financiera menciona costos reales de envio, pero `Order`/`ShipmentOrder` no modelan asignacion de costo real.
- Evidencia encontrada: `prisma/schema.prisma:418-441`, `prisma/schema.prisma:649-659`.
- Riesgo real: reportes no pueden responder costo real de envios con precision.
- Recomendacion: agregar modelo/campos o ajustar documentacion si queda fuera de alcance.
- Criterios de aceptacion: costo real de envio queda modelado y reportado, o diferido explicitamente.
- Tests recomendados: reporte financiero con envio gratis asumido por negocio.
- Dependencias: migraciones versionadas y decision contable.
- Observaciones: pendiente de confirmar con negocio.
