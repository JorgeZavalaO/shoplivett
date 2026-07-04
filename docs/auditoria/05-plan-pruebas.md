# 05 - Plan de pruebas derivado de auditoria

Fecha de creacion: 2026-07-01

Este plan convierte los hallazgos en pruebas de regresion y hardening. La prioridad es cubrir primero dinero, stock, pagos, incidencias, permisos y CI.

## Tests obligatorios antes de produccion

| Prueba | Que valida | Modulo afectado | Hallazgo cubierto | Tipo de test | Criterio de exito |
| --- | --- | --- | --- | --- | --- |
| Validacion de pago que cierra pedido | El pago actual se incluye en fees y utilidad neta. | Pagos, utilidad, reportes | `AUD-DATA-001` | Integracion/e2e; regresion en `e2e/flows.spec.ts` | `paymentFeePen` y `netProfitPen` son correctos al quedar `PAID`. |
| Pago parcial a pagado con credito/sobrepago | Excedentes no rompen utilidad ni aplicaciones. | Pagos, creditos | `AUD-DATA-001`, `AUD-FUNC-002` | Integracion | Excedente se registra segun tratamiento y utilidad queda correcta. |
| Incidencia `RETURN + RESTOCK` | Disponibilidad aumenta exactamente por unidades devueltas. | Incidencias, inventario | `AUD-DATA-002`, `AUD-DATA-003` | Integracion con `scripts/test-incidents.ts` | Stock disponible cambia en `+qty`, no en `+2qty`. |
| Cancelacion de incidencia con stock | Cancelar incidencia no deja movimientos incoherentes. | Incidencias, inventario | `AUD-DATA-002` | Integracion con `scripts/test-incidents.ts` | Se revierte efecto o se bloquea cancelacion segun regla. |
| Incidencia `RETURN + CREDIT` y cancelacion | Creditos creados por incidencia se revierten o bloquean si corresponde. | Incidencias, creditos | `AUD-DATA-002` | Integracion con `scripts/test-incidents.ts` | No queda credito disponible por incidencia cancelada. |
| Dano/perdida con stock reservado | No se consume stock reservado o vendido. | Incidencias, inventario | `AUD-DATA-006` | Integracion con `scripts/test-incidents.ts` | La accion falla si no hay disponible real. |
| Creacion de lote y venta FIFO | `ImportBatchItem.quantityAvailable` y `ProductVariant.stock` son coherentes. | Lotes, inventario, ventas | `AUD-DATA-004` | Integracion con `scripts/test-order-batch-fifo.ts` y `scripts/reconcile-variant-stock.ts` | Variante con lote recibido se vende correctamente y descuenta FIFO. |
| Cancelacion/expiracion de pedido con lote | Libera reserva y allocations de lote consistentemente. | Pedidos, lotes, inventario | `AUD-DATA-004`, `AUD-DATA-013` | Integracion con `scripts/test-order-batch-fifo.ts` | Stock reservado y lote disponible vuelven al estado esperado. |
| Ajuste manual concurrente | Dos ajustes simultaneos no pierden updates ni rompen invariantes. | Inventario | `AUD-DATA-005` | Integracion con `scripts/test-incidents.ts`; concurrencia recomendada | Resultado final equivale a ambos ajustes o uno falla con conflicto controlado. |
| Validar pago contra pedido cerrado | Bloquea aplicaciones a `CANCELLED` o `EXPIRED`. | Pagos, pedidos | `AUD-DATA-014` | Integracion con `scripts/test-payment-reservation-closure.ts` | La validacion falla con mensaje claro. |
| Cierre de reserva con pago aplicado por `PaymentApplication` | Pagos pendientes aplicados se resuelven correctamente. | Reservas, pagos | `AUD-DATA-013` | Integracion con `scripts/test-payment-reservation-closure.ts` | No quedan pagos pendientes huerfanos. |
| Cliente bloqueado en venta rapida | El servidor impide venta o exige override aprobado. | Clientes, ventas | `AUD-UX-009`, `AUD-UX-013` | Dominio con `scripts/test-customer-blocked-sale.ts` | Venta a `BLOCKED` falla con `OrderError CUSTOMER_BLOCKED`; cliente `ACTIVE` sigue pudiendo comprar. |
| Login con multiples intentos fallidos | Rate limiting funciona por IP/email. | Autenticacion | `AUD-SEC-002` | Integracion con `scripts/test-auth-rate-limit.ts`; manual UI recomendado | Intentos repetidos son limitados sin revelar si el email existe. |
| Usuario desactivado con sesion activa | Sesion queda invalidada segun politica. | Autenticacion, permisos | `AUD-SEC-001` | Integracion/e2e; politica de 15 minutos definida en `auth.ts` | Usuario desactivado no accede a dashboard ni actions tras expirar la ventana definida. |
| Matriz de rutas por rol | Cada rol puede abrir solo rutas autorizadas. | Autorizacion | `AUD-SEC-004`, `AUD-SEC-005`, `AUD-UX-002`, `AUD-UX-003` | E2E; `pnpm typecheck` aplicado para 0.33.0 | ADMIN/SELLER/DISPATCH cumplen matriz esperada. |
| Server actions por rol | Actions criticas rechazan roles no autorizados. | Actions | `AUD-SEC-005`, `AUD-TEST-004` | Integracion; `pnpm typecheck` aplicado para 0.33.0 | Mutaciones protegidas no ejecutan para roles incorrectos. |
| Acceso anonimo a recibo de pago | Capturas no son publicas. | Archivos, pagos | `AUD-SEC-003` | E2E/manual; `pnpm typecheck` aplicado para 0.34.0 | URL o endpoint de recibo rechaza anonimos. |
| CI E2E con base correcta | Workflow crea/apunta a DB existente. | CI, deploy | `AUD-PROD-001`, `AUD-DATA-012`, `AUD-PROD-004` | CI validado en GitHub Actions | `db:deploy`, seed y Playwright terminan exitosamente. |
| Reenvio tras envio cancelado | Pedido puede incluirse en nuevo envio despues de cancelar anterior. | Envios | `AUD-DATA-008` | Integracion con `e2e/flows.spec.ts`; validacion transaccional `Serializable` | No hay error de unique y no hay dos envios activos. |
| Descuento en venta | Snapshots financieros reflejan descuento. | Ventas, reportes | `AUD-DATA-007` | Integracion con `scripts/test-order-batch-fifo.ts` | `lineDiscountPen` y utilidad por linea son correctos. |
| Costo unitario 4 decimales | Costos aterrizados se redondean correctamente. | Lotes, utilidad | `AUD-DATA-009` | Integracion en `scripts/test-order-batch-fifo.ts` | Subtotal de costo coincide con regla definida. |

## Tests importantes

| Prueba | Que valida | Modulo afectado | Hallazgo cubierto | Tipo de test | Criterio de exito |
| --- | --- | --- | --- | --- | --- |
| CSV injection | Valores que empiezan con formula se exportan como texto. | Reportes CSV | `AUD-SEC-006` | Unitario en `scripts/test-financial-reports.ts` | `=`, `+`, `-`, `@` quedan neutralizados. |
| Upload invalido | Archivo no imagen o lote excesivo se rechaza. | Blob, pagos, productos | `AUD-SEC-007` | Integracion en `scripts/test-upload-validation.ts` | MIME falso, firma invalida, tamano total excesivo o cantidad excesiva fallan. |
| Metodo manual bloqueado | El costeo manual no puede quedar activo como placeholder silencioso. | Lotes, configuracion | `AUD-FUNC-006` | Integracion/validacion en `scripts/test-order-batch-fifo.ts` y Zod/UI | `MANUAL` falla explicitamente o no puede seleccionarse. |
| Headers de seguridad | Respuestas incluyen headers definidos. | Produccion web | `AUD-SEC-008` | Manual/integracion; `pnpm typecheck` aplicado para 0.34.0 | CSP y headers no rompen app. |
| Baja rotacion con dataset grande | No hay N+1 ni timeout. | Dashboard, reportes | `AUD-PERF-001`, `AUD-PERF-005` | Performance/integracion con `scripts/test-perf-fixes.ts` | Query count constante al crecer N; `getLowRotationProducts` y `getLowRotationReport` no escalan con el numero de variantes. |
| Rentabilidad por lote grande | No carga todo el grafo historico. | Reportes financieros | `AUD-PERF-003` | Performance/integracion con `scripts/test-perf-fixes.ts` | `getBatchProfitability` y `getBatchProfitabilityReport` ejecutan <= 8 queries acotadas y completan bajo 2s con docenas de lotes. |
| Alertas financieras reusan resultados | `getFinancialAlerts` no recalcula overview/baja rotacion. | Dashboard | `AUD-PERF-001` | Integracion con `scripts/test-perf-fixes.ts` | Llamada con `precomputed` ejecuta <= 4 queries y devuelve el `lowRotationCount` recibido. |
| Export CSV grande | Export no trunca silenciosamente ni consume memoria excesiva. | Reportes | `AUD-PERF-002`, `AUD-PERF-006` | Performance/manual | Usuario recibe export completo o aviso de limite. |
| Reporte de lives multiple | Cada live muestra totales propios. | Reportes operativos | `AUD-PERF-009` | Integracion | Dos lives con ventas distintas no comparten metricas. |
| Top productos historico | Revenue no muestra cero falso. | Reportes | `AUD-PERF-012` | Integracion | Ingresos historicos se calculan o se ocultan claramente. |
| Gastos edicion vs anulacion concurrente | No se edita gasto anulado. | Gastos | `AUD-DATA-016` | Dominio; validacion dentro de transaccion | Una de las operaciones falla limpiamente. |
| Lote cerrado vs edicion concurrente | No se modifica lote cerrado. | Lotes | `AUD-DATA-010` | Concurrencia con `scripts/test-batch-closed-race.ts` | Edicion falla (revalidacion o conflicto de serializacion) si el cierre gana la carrera; el lote nunca queda CLOSED con los cambios de la edicion aplicados. |
| Codigos concurrentes | No hay error visible por colision secuencial. | Pedidos, lotes | `AUD-DATA-017` | Integracion; regresion cubierta | Colisiones se reintentan o evitan. |
| WhatsApp sin contexto | Plantillas no rompen si faltan order/payment/credit. | WhatsApp, cliente | `AUD-UX-001` | Unitario/integracion; regresion cubierta | No hay TypeError y solo aparecen plantillas validas. |
| Dashboard dispatch | Links y metricas son coherentes con permisos. | Dashboard, envios | `AUD-UX-002`, `AUD-UX-012` | E2E; `pnpm typecheck` aplicado para 0.33.0 | No hay links muertos y conteos son reales. |
| Nuevo envio preseleccionado dispatch | Despacho abre formulario con cliente/pedido precargado. | Envios | `AUD-UX-003` | E2E; `pnpm typecheck` aplicado para 0.33.0 | Form carga y permite crear envio elegible. |
| Menu movil | Navegacion aparece en sheet movil por rol. | Layout | `AUD-UX-011` | E2E viewport movil | Links visibles y navegables. |
| Acciones destructivas con confirmacion | Ajuste de stock, variantes y categorias piden confirmacion o feedback. | UI critica | `AUD-UX-005`, `AUD-UX-006`, `AUD-UX-007` | E2E; ConfirmDialog implementado | Accion no se ejecuta accidentalmente. |
| Motivo de cancelacion de envio | Motivo obligatorio o decision documentada. | Envios | `AUD-UX-008` | E2E | Cancelacion sin motivo se bloquea si aplica. |
| Historial de cliente | Detalle muestra pedidos/pagos reales. | Clientes | `AUD-FUNC-001` | E2E + typecheck + lint | No hay placeholders y datos enlazan. Componentes: CustomerOrdersHistory, CustomerPaymentsHistory. Regresiones: test-order-batch-fifo.ts 14/14, test-financial-reports.ts 12/12, test-upload-validation.ts ok. |
| Operaciones de creditos | Crear, aplicar y devolver creditos desde UI. | Creditos | `AUD-FUNC-002` | E2E + typecheck + lint | Credito afecta pedido/saldo correctamente. Componentes: CreateManualCreditForm, ApplyCreditToOrderForm, RefundCreditForm. Regresiones: test-order-batch-fifo.ts 14/14, test-financial-reports.ts 12/12, test-upload-validation.ts ok. |
| Editar aplicaciones de pago | Pago pendiente permite corregir aplicaciones. | Pagos | `AUD-FUNC-003` | E2E | Aplicaciones actualizadas recalculan validacion esperada. |
| Editar envio | Tracking/agencia/costo/direccion se editan segun estado. | Envios | `AUD-FUNC-004` | E2E | Cambios persisten y se auditan. |
| Gestion de lotes UI | Editar lote, items y estado desde detalle. | Lotes | `AUD-FUNC-005` | E2E + typecheck + lint | Lote no cerrado se gestiona y cerrado se bloquea. Componentes: BatchEditForm, AddBatchItemForm, RemoveBatchItemButton, BatchDetailActions. Regresiones: test-order-batch-fifo.ts 14/14, test-financial-reports.ts 12/12, test-upload-validation.ts ok. |

## Tests deseables

| Prueba | Que valida | Modulo afectado | Hallazgo cubierto | Tipo de test | Criterio de exito |
| --- | --- | --- | --- | --- | --- |
| Unit tests de dinero | Conversiones, redondeo, negativos y 4dp. | Money/costeo | `AUD-DATA-009` | Unitario | Resultados exactos para casos borde. |
| Unit tests de permisos | `rolesFor`, `hasPermission` y matriz final. | Permisos | `AUD-ARCH-001` | Unitario | Matriz coincide con decision documentada. |
| Snapshot de reportes financieros | Cambios en agregadores detectan regresiones. | Reportes | `AUD-ARCH-002` | Integracion | Totales esperados se mantienen. |
| Producto con muchas variantes | Detalle de producto no se degrada. | Productos | `AUD-PERF-011` | Performance/manual | Tiempo de carga dentro de limite definido. |
| Historial de inventario grande | Paginacion mantiene respuesta rapida. | Inventario | `AUD-PERF-010` | Performance; paginada (25 por pagina) | No carga todos los movimientos. |
| Buscador global | Si se implementa, navega a resultados correctos. | Layout/busqueda | `AUD-UX-010` | E2E | Buscar cliente/producto/pedido abre resultados. |
| Loading por modulo | Skeleton no confunde por ruta. | UX | `AUD-UX-015` | Manual | Loading corresponde a tipo de pantalla. |
| Error boundaries contextuales | Errores ofrecen recuperacion util. | UX | `AUD-UX-016` | Manual | Mensaje y CTA son claros por modulo. |
| Restore de backup | Backup Neon se restaura en staging. | Produccion | `AUD-PROD-005` | Manual/runbook | Restore documentado y probado. |
| Rollback de release | Version anterior puede restaurarse. | Produccion | `AUD-PROD-005` | Manual/runbook | Procedimiento validado en staging. |
| Secret scanning | Repo no contiene secretos rastreados. | Seguridad/produccion | `AUD-SEC-009`, `AUD-PROD-003` | CI/manual | `secret-scan.yml` corre y el workspace no comparte `.env` reales. |
| Trace de Playwright en fallo | Artefactos ayudan a diagnosticar. | Testing | `AUD-TEST-003` | CI | Fallo genera trace/reporte. |

## Reglas para agregar pruebas

* Toda correccion P0 debe agregar al menos una prueba automatizada o justificar por que no es viable.
* Toda correccion de permisos debe tener prueba por rol afectado.
* Toda correccion financiera debe validar montos exactos en centavos o strings decimales.
* Toda correccion de concurrencia debe probar dos operaciones simultaneas o usar test de integracion que reproduzca la carrera.
* Si una prueba queda manual, documentar pasos, datos requeridos y criterio de exito.
