# Operaciones de Producción

## Secretos

- Nunca compartir `.env` local por chat, mail o tickets.
- Configurar en Vercel solo: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `SEED_ADMIN_PASSWORD`, `SEED_SELLER_PASSWORD`, `SEED_DISPATCH_PASSWORD`.
- Rotar secretos si una laptop es comprometida, se comparte una captura del panel o se sospecha fuga.
- Validar que `.env.example` siga siendo documental y no contenga valores reales.

## Deploy

1. Confirmar `pnpm verify` en local o CI.
2. Confirmar `pnpm test:domain` en CI.
3. Aplicar `pnpm db:deploy` en el entorno destino.
4. Ejecutar `pnpm db:seed` solo en bootstrap inicial o staging efímero.
5. Verificar login ADMIN, `/dashboard`, `/envios`, `/reportes` y `/pagos`.

## Observabilidad mínima

- Revisar logs de Vercel después de cada deploy en rutas críticas:
  - `/dashboard`
  - `/reportes`
  - `/api/reportes/[section]`
  - `/pagos/*`
  - `/envios/*`
- Si hay errores repetidos con el mismo `digest`, abrir incidente y registrar timestamp, ruta y actor.
- Mantener `AuditLog` como fuente de trazabilidad funcional y los logs de Vercel como trazabilidad técnica.

## Backups y restore

- Neon debe tener backups/PITR habilitado antes de producción real.
- Probar restore en staging antes de depender del procedimiento.
- Después de restaurar, correr:
  - `pnpm db:deploy`
  - smoke funcional de login + dashboard + reporte + envío.

## Rollback

- Si el fallo es solo de aplicación, revertir deploy desde Vercel al release anterior.
- Si el fallo incluye migración, evaluar primero compatibilidad backward del código anterior con el schema ya migrado.
- Si requiere rollback de datos, usar restore de Neon sobre staging primero y luego producción con ventana aprobada.

## Incidentes

- Prioridad alta si afecta pagos, stock, créditos, envíos o reportes financieros.
- Pausar operaciones manuales del módulo afectado si hay riesgo de corrupción de datos.
- Documentar causa, mitigación, impacto y follow-up en `docs/auditoria/` o en el changelog si corresponde.
