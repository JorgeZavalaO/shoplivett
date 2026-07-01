# 03 - Plan de accion

Este plan agrupa los hallazgos en fases tecnicas. Los IDs referencian `02-hallazgos.md` y el detalle accionable vive en `04-backlog-correcciones.md`.

## Fase 1: Bloqueantes para produccion

Objetivo: corregir defectos que pueden corromper datos financieros, inventario, creditos o bloquear CI basico.

Hallazgos incluidos:

* `AUD-DATA-001` - Utilidad excluye pago actual.
* `AUD-DATA-002` - Cancelacion de incidencias no revierte efectos.
* `AUD-DATA-003` - Restock duplica disponibilidad.
* `AUD-DATA-004` - Lotes no sincronizan stock operativo.
* `AUD-PROD-001` - CI E2E usa base inexistente.
* `AUD-SEC-001` - JWT no revalida usuario activo/rol.
* `AUD-SEC-002` - Login sin rate limiting.

Orden recomendado:

1. `AUD-DATA-001`.
2. `AUD-DATA-002`.
3. `AUD-DATA-003`.
4. `AUD-DATA-004`.
5. `AUD-PROD-001`.
6. `AUD-SEC-002`.
7. `AUD-SEC-001`.

Riesgo que reduce: corrupcion de utilidad, stock y creditos; falso sentido de calidad por CI roto; acceso no revocado; ataques de fuerza bruta.

Resultado esperado: flujos centrales de pago, utilidad, inventario, lotes e incidencias dejan de generar estados incorrectos y el pipeline E2E queda ejecutable.

## Fase 2: Seguridad y consistencia de datos

Objetivo: cerrar exposiciones de datos, harden de permisos y reforzar invariantes de negocio.

Hallazgos incluidos:

* `AUD-SEC-003` - Capturas de pago publicas.
* `AUD-SEC-004` - RBAC incompleto en paginas de lives.
* `AUD-SEC-005` - Drift entre permisos declarados y guards reales.
* `AUD-SEC-006` - CSV injection.
* `AUD-SEC-007` - Validacion de subida incompleta.
* `AUD-DATA-005` - Ajuste manual de stock inseguro.
* `AUD-DATA-006` - Danos/perdidas pueden consumir stock comprometido.
* `AUD-DATA-007` - Descuentos no reflejados en snapshots.
* `AUD-DATA-008` - Reenvio bloqueado por constraint.
* `AUD-DATA-009` - Costos 4 decimales truncados.
* `AUD-DATA-013` - Pagos pendientes via aplicaciones no se cierran correctamente.
* `AUD-DATA-014` - Validacion de pago no valida estado del pedido.
* `AUD-UX-009` - Cliente bloqueado no impide venta.

Orden recomendado:

1. Proteger capturas de pago.
2. Corregir ajuste manual e incidencias sobre stock disponible.
3. Corregir snapshots financieros con descuentos y costos 4dp.
4. Corregir validacion de pagos y cierre de reservas con `PaymentApplication`.
5. Homogeneizar permisos y paginas protegidas.
6. Corregir reenvio y cliente bloqueado.
7. Neutralizar CSV injection y endurecer uploads.

Riesgo que reduce: fuga de informacion financiera, IDOR parcial por UI/rutas, corrupcion silenciosa de inventario y pagos, errores de rentabilidad.

Resultado esperado: permisos y datos criticos se comportan de forma consistente bajo flujos normales y casos borde.

## Fase 3: Arquitectura y mantenibilidad

Objetivo: reducir drift funcional, duplicacion de reglas y deuda que dificulta correcciones seguras.

Hallazgos incluidos:

* `AUD-ARCH-001` - Dos capas de permisos sin fuente unica.
* `AUD-ARCH-002` - Archivos grandes y acoplamiento en reportes/dashboard.
* `AUD-ARCH-003` - Documentacion funcional desalineada.
* `AUD-ARCH-004` - README contradice estrategia actual de cache.
* `AUD-FUNC-001` - Historial de cliente incompleto.
* `AUD-FUNC-002` - UI de creditos incompleta.
* `AUD-FUNC-003` - Edicion de aplicaciones de pago sin UI.
* `AUD-FUNC-004` - Edicion de envios sin UI.
* `AUD-FUNC-005` - Gestion de lotes sin UI completa.
* `AUD-FUNC-006` - Costeo manual es placeholder.
* `AUD-FUNC-007` - Modelo no cubre costo real de envio prometido.

Orden recomendado:

1. Definir matriz de permisos unica.
2. Completar o diferir explicitamente funcionalidades documentadas.
3. Actualizar documentacion funcional.
4. Modularizar reportes y dashboard despues de estabilizar bugs.

Riesgo que reduce: regresiones por reglas duplicadas, promesas de producto no cumplidas, costo alto de mantenimiento.

Resultado esperado: funcionalidades y documentacion quedan alineadas; nuevas correcciones se implementan sobre arquitectura mas predecible.

## Fase 4: Performance

Objetivo: evitar timeouts, exceso de memoria y consultas N+1 en entorno serverless.

Hallazgos incluidos:

* `AUD-PERF-001` - Dashboard financiero duplica trabajo y tiene N+1.
* `AUD-PERF-002` - Reportes y CSV cargan datasets completos.
* `AUD-PERF-003` - Rentabilidad por lote carga grafo completo.
* `AUD-PERF-004` - Falta indice para `status + profitCalculatedAt`.
* `AUD-PERF-005` - Baja rotacion de reportes tiene N+1.
* `AUD-PERF-006` - Export de gastos trunca a 1000 filas.
* `AUD-PERF-007` - Overview financiero hace aggregates duplicados.
* `AUD-PERF-008` - Fallback mensual puede hacer muchas consultas.
* `AUD-PERF-010` - Historial de movimientos sin paginacion.
* `AUD-PERF-011` - Pagina de producto carga todo.

Orden recomendado:

1. Eliminar N+1 de baja rotacion.
2. Optimizar rentabilidad por lote.
3. Controlar CSV/exportaciones.
4. Evaluar indice con `EXPLAIN ANALYZE`.
5. Paginacion en historiales y detalles pesados.

Riesgo que reduce: timeouts, costos altos de DB, errores de memoria y mala UX bajo datos reales.

Resultado esperado: dashboard y reportes responden de forma estable con datasets mayores al seed.

## Fase 5: Testing y hardening

Objetivo: convertir los bugs encontrados en pruebas de regresion y asegurar calidad antes de release.

Hallazgos incluidos:

* `AUD-TEST-001` - Scripts de dominio no integrados a CI.
* `AUD-TEST-002` - Smoke E2E deja datos persistentes.
* `AUD-TEST-003` - Playwright no genera trace con retries 0.
* `AUD-TEST-004` - Faltan pruebas de permisos/seguridad.
* Todos los hallazgos P0 y P1 deben tener pruebas de regresion asociadas.

Orden recomendado:

1. Arreglar CI E2E.
2. Integrar scripts de dominio al CI.
3. Agregar pruebas de permisos y seguridad.
4. Agregar pruebas de concurrencia para inventario, pagos, lotes e incidencias.
5. Ajustar trazas/artefactos de Playwright.

Riesgo que reduce: regresiones silenciosas y releases sin senal confiable.

Resultado esperado: cada bug critico corregido queda protegido por pruebas automatizadas o checklist manual documentado.

## Fase 6: Mejoras futuras

Objetivo: completar producto y operacion una vez estabilizada la base.

Hallazgos incluidos:

* `AUD-UX-001` a `AUD-UX-016`.
* `AUD-PROD-002` - No hay `vercel.json`.
* `AUD-PROD-003` - Secretos reales/aparentes en `.env` local.
* `AUD-PROD-004` - Sin migraciones versionadas.
* `AUD-PROD-005` - Falta estrategia explicita de observabilidad, backups y rollback.

Orden recomendado:

1. Corregir navegacion movil y enlaces rotos.
2. Mejorar confirmaciones y estados de formularios.
3. Definir estrategia Vercel/observabilidad/backups.
4. Formalizar migraciones antes de produccion real.
5. Mantener documentacion viva.

Riesgo que reduce: errores operativos, UX rota, despliegues no reproducibles y respuesta lenta ante incidentes.

Resultado esperado: sistema mas operable, auditable y mantenible.
