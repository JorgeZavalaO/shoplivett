# 06 - Riesgos de produccion

Fecha de creacion: 2026-07-01

Estado recomendado: no desplegar a produccion con usuarios reales hasta corregir P0 y P1 o aceptar formalmente los riesgos con mitigaciones.

## Riesgos bloqueantes

* Datos financieros incorrectos por `AUD-DATA-001`, `AUD-DATA-007` y `AUD-DATA-009`.
* Stock incorrecto por `AUD-DATA-002`, `AUD-DATA-003`, `AUD-DATA-004`, `AUD-DATA-005` y `AUD-DATA-006`.
* Creditos inconsistentes por `AUD-DATA-002` y `AUD-FUNC-002`.
* Pagos aplicados a pedidos cerrados o reservas mal cerradas por `AUD-DATA-013` y `AUD-DATA-014`.
* Sesiones de usuarios desactivados o degradados por `AUD-SEC-001`.
* Login sin rate limiting por `AUD-SEC-002`.
* Capturas de pago publicas por `AUD-SEC-003`.
* CI E2E potencialmente roto por `AUD-PROD-001`.
* Reenvio de pedidos bloqueado por `AUD-DATA-008` si despacho opera cancelaciones reales.

## Riesgos aceptables temporalmente

Estos riesgos podrian diferirse si existe decision explicita y mitigacion operativa:

* Buscador global decorativo (`AUD-UX-010`) si se retira u oculta antes de produccion.
* Loading y error boundaries genericos (`AUD-UX-015`, `AUD-UX-016`) si soporte interno conoce el sistema.
* Falta de `vercel.json` (`AUD-PROD-002`) si reportes se optimizan o no se usan con volumen grande.
* Modularizacion de reportes (`AUD-ARCH-002`) si los bugs funcionales ya estan corregidos y cubiertos por tests.
* Confirmaciones de categoria/variante (`AUD-UX-006`, `AUD-UX-007`) si se acepta como riesgo operativo bajo.

## Riesgos que requieren monitoreo

* Tiempo de respuesta de `/dashboard` y `/reportes`.
* Memoria y duracion de `app/api/reportes/[section]/route.ts`.
* Errores Prisma `P2002`, `P2034` y timeouts.
* Reintentos o fallos en validacion de pagos.
* Diferencias entre `ProductVariant.stock`, `reservedStock`, `soldStock` e items de lote.
* Creacion/cancelacion de incidencias con efectos financieros.
* Accesos denegados inesperados por rol `DISPATCH`.
* Uso y costos de Vercel Blob.
* Intentos fallidos de login por IP/email.

## Checklist minimo antes de produccion

* Todos los hallazgos P0 del backlog estan `Corregido`.
* Todos los hallazgos P1 estan `Corregido` o tienen decision formal de riesgo aceptado.
* `pnpm verify` pasa en CI.
* `pnpm test:e2e` pasa en CI contra base creada correctamente.
* Tests de dominio financiero/inventario/incidencias corren en CI o paso obligatorio de release.
* No hay secretos en archivos rastreados ni en artefactos.
* Variables productivas configuradas en Vercel.
* Base de datos productiva tiene backups habilitados.
* Estrategia de migraciones definida y probada en staging.
* Capturas de pago no son publicas o hay decision formal de riesgo aceptado.
* Rate limiting de login activo.
* Usuarios seed no usan contrasenas debiles ni compartidas.
* Existe runbook de rollback y restauracion.
* Reportes pesados probados con dataset representativo.

## Variables de entorno necesarias

Variables esperadas segun documentacion actual:

* `DATABASE_URL`: conexion pooled Neon/PostgreSQL para runtime.
* `DIRECT_URL`: conexion directa para migraciones o tareas administrativas.
* `AUTH_SECRET`: secreto fuerte de Auth.js, 32 bytes base64 o equivalente.
* `AUTH_URL`: URL canonica del deploy.
* `AUTH_TRUST_HOST`: mantener politica explicita para Vercel/proxy.
* `BLOB_READ_WRITE_TOKEN`: token de Vercel Blob.
* `SEED_ADMIN_PASSWORD`: password inicial admin, solo para seed.
* `SEED_SELLER_PASSWORD`: password inicial seller, solo para seed.
* `SEED_DISPATCH_PASSWORD`: password inicial dispatch, solo para seed.
* `NEXT_PUBLIC_APP_NAME`: nombre publico de aplicacion si se usa.
* `NEXT_PUBLIC_APP_URL`: URL publica si se usa.

Consideraciones:

* No usar valores seed debiles en produccion.
* Rotar `AUTH_SECRET` invalida sesiones; planificar ventana.
* Separar entornos local, staging, E2E y produccion.
* Evitar compartir `.env` real en zips, tickets o sesiones remotas.

## Logs

* Registrar errores de auth, pagos, stock, incidencias y reportes con identificadores no sensibles.
* No loggear passwords, tokens, URLs privadas de recibos ni datos completos de comprobantes.
* Monitorear errores de transaccion y conflictos de serializacion.
* Definir retencion y acceso a logs segun sensibilidad financiera.

## Backups

* Habilitar backups automaticos de Neon/PostgreSQL.
* Probar restauracion en staging antes de produccion.
* Documentar RPO y RTO esperados.
* Antes de migraciones de schema, tomar backup o snapshot.
* Para Vercel Blob, definir politica de recuperacion de archivos borrados accidentalmente. Pendiente de confirmar segun plan del proveedor.

## Almacenamiento de archivos

* Separar imagenes publicas de producto y recibos privados de pago.
* Definir retencion de capturas de pago.
* Limitar cantidad y tamano total de uploads por accion.
* Validar tipo real de archivo, no solo MIME declarado.
* Evitar URLs publicas permanentes para documentos financieros.

## Seguridad

* Rate limiting en login obligatorio.
* Revocacion o revalidacion de usuario activo/rol obligatoria.
* Headers de seguridad recomendados antes de produccion.
* CSV injection debe corregirse antes de habilitar exports a usuarios no tecnicos.
* Permisos por rol deben tener fuente unica y tests.
* Auditoria debe permanecer inmutable.

## Monitoreo

Metricas recomendadas:

* Latencia y errores de `/dashboard`.
* Latencia y errores de `/reportes` y CSV.
* Conteo de pagos pendientes, rechazados y validados.
* Conteo de reservas vencidas.
* Conflictos de stock o errores `INSUFFICIENT_STOCK`.
* Errores de subida a Blob.
* Intentos fallidos de login.
* Errores Prisma por codigo.
* Uso de memoria/duracion en funciones serverless.

## Rollback

Antes de produccion debe existir un procedimiento para:

* Revertir deploy de Vercel a version anterior.
* Restaurar backup de base de datos si una migracion corrompe datos.
* Invalidar sesiones si se filtra `AUTH_SECRET` o se compromete una cuenta.
* Revocar/rotar `BLOB_READ_WRITE_TOKEN`.
* Desactivar temporalmente reportes/exportaciones pesadas si causan timeouts.
* Comunicar al equipo que flujos de pago/stock quedan en pausa durante incidente.

## Decision de salida a produccion

Recomendacion actual: no salir a produccion.

Condicion minima para reconsiderar:

* P0 corregidos.
* P1 corregidos o aceptados formalmente.
* CI verde con E2E y tests de dominio.
* Checklist minimo completado.
* Riesgos residuales documentados en `07-registro-decisiones.md`.
