# 01 - Resumen ejecutivo

Fecha de auditoria: 2026-07-01

## Resumen del sistema

Shoplivett es un administrador interno de ventas para una tienda que vende principalmente por TikTok Live. El sistema gestiona clientas, productos, variantes, stock, sesiones live, ventas rapidas, pedidos, pagos, capturas, creditos, reservas, envios, reportes, auditoria, lotes de importacion, gastos operativos, incidencias y rentabilidad financiera.

La aplicacion esta orientada a operacion interna con roles diferenciados: `ADMIN`, `SELLER` y `DISPATCH`.

## Stack identificado

* Next.js 16 App Router.
* React 19.
* TypeScript strict.
* Prisma 7 con PostgreSQL/Neon.
* Auth.js v5 con provider Credentials y sesiones JWT.
* Tailwind CSS 4 y `@base-ui/react`.
* Vercel Blob para archivos.
* Server Actions y validacion Zod.
* Playwright para E2E.
* Sonner, Lucide React y TanStack Table.

## Modulos principales

* Autenticacion y roles.
* Dashboard operativo y financiero.
* Clientes.
* Productos, categorias, variantes e imagenes.
* Inventario y movimientos.
* Lives.
* Venta rapida y pedidos.
* Pagos, capturas y aplicaciones a pedidos.
* Creditos y reservas vencidas.
* Envios agrupados.
* WhatsApp templates.
* Reportes operativos y financieros.
* Auditoria.
* Configuracion de negocio.
* Lotes de importacion y costeo aterrizado.
* Gastos operativos.
* Incidencias, devoluciones, danos y perdidas.

## Estado general de implementacion

El sistema esta avanzado y contiene bastante logica de dominio real. Existen transacciones, auditoria, validaciones, permisos basicos y pruebas E2E/dominio. Sin embargo, la implementacion no esta terminada para produccion porque contiene bloqueantes en flujos financieros, inventario, incidencias, seguridad y performance.

El principal riesgo no es sintactico; es de consistencia de negocio. Algunos flujos pueden guardar datos validos desde el punto de vista de Prisma, pero incorrectos para el negocio: utilidad neta inflada, stock duplicado, creditos vivos por incidencias canceladas o reenvios imposibles.

## Riesgo general

Critico.

## Principales bloqueantes

* La utilidad se reconoce antes de marcar el pago actual como validado, dejando `paymentFeePen` y `netProfitPen` incorrectos.
* Las incidencias aplican efectos en stock o creditos, pero al cancelarse no revierten esos efectos.
* La devolucion con restock puede duplicar disponibilidad al incrementar `stock` y decrementar `soldStock` simultaneamente.
* Los lotes registran disponibilidad por lote y movimientos `IN`, pero no sincronizan `ProductVariant.stock`, que sigue siendo usado por reservas.
* Las sesiones JWT no revalidan de forma efectiva usuario activo o rol en cada request critica.
* El login no tiene rate limiting.
* Las capturas de pago se guardan como blobs publicos.
* El CI E2E apunta a una base que el servicio Postgres no crea.
* Reportes financieros y dashboard tienen consultas sin limite, N+1 y trabajo duplicado.
* Hay funcionalidades prometidas o parcialmente implementadas sin UI real: creditos manuales, aplicacion de creditos, edicion de envios, gestion de lotes e historial real de cliente.

## Recomendacion final antes de produccion

No pasar a produccion hasta corregir como minimo los hallazgos P0 y P1 del backlog. El orden recomendado es corregir primero consistencia financiera y stock, luego seguridad de autenticacion/archivos, despues permisos y CI, y finalmente performance/reportes.

Tambien se recomienda no introducir nuevas funcionalidades hasta estabilizar los invariantes de dinero, stock, pagos, creditos, incidencias y lotes.
