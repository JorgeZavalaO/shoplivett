-- Migration: add_trigram_indexes
-- Descripción: Índices GIN con pg_trgm para búsquedas con ILIKE/contains
--
-- Prisma no soporta índices GIN/trigram nativamente, por lo que esta
-- migración se ejecuta como SQL raw después de las migraciones de Prisma.
--
-- Ejecutar con:
--   psql "$DATABASE_URL" -f prisma/migrations/add_trigram_indexes/migration.sql
--
-- O desde una migración personalizada:
--   prisma migrate dev --create-only
--   reemplazar el contenido de migration.sql con este archivo

-- =====================================================================
-- 1. Extensión pg_trgm (solo si no está instalada)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- 2. Customer — búsqueda por nombre, searchName y whatsapp
-- =====================================================================
-- Las queries de searchCustomersAction usan:
--   searchName: { contains: ... }, name: { contains: ..., mode: "insensitive" }
--   whatsapp: { contains: ... }
-- El índice B-tree en searchName no ayuda con LIKE '%...%'.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_name_trgm
  ON "Customer" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_search_name_trgm
  ON "Customer" USING gin ("searchName" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_whatsapp_trgm
  ON "Customer" USING gin (whatsapp gin_trgm_ops);

-- =====================================================================
-- 3. Order — búsqueda por orderNumber
-- =====================================================================
-- searchOrdersForIncidentAction usa:
--   orderNumber: { contains: trimmed, mode: "insensitive" }
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_order_number_trgm
  ON "Order" USING gin ("orderNumber" gin_trgm_ops);

-- =====================================================================
-- 4. ProductVariant — búsqueda por code y color
-- =====================================================================
-- searchVariantsForIncidentAction usa:
--   code: { contains: ..., mode: "insensitive" }
--   color: { contains: ..., mode: "insensitive" }
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variant_code_trgm
  ON "ProductVariant" USING gin (code gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variant_color_trgm
  ON "ProductVariant" USING gin (color gin_trgm_ops) WHERE color IS NOT NULL;

-- =====================================================================
-- 5. Product — búsqueda por name
-- =====================================================================
-- searchProductsAction usa:
--   name: { contains: ..., mode: "insensitive" }
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_name_trgm
  ON "Product" USING gin (name gin_trgm_ops);

-- =====================================================================
-- 6. Expenses — búsqueda por description, notes, paymentMethod
-- =====================================================================
-- listExpenses usa OR con contains sobre estos campos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_description_trgm
  ON "Expense" USING gin (description gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_notes_trgm
  ON "Expense" USING gin (notes gin_trgm_ops) WHERE notes IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_payment_method_trgm
  ON "Expense" USING gin ("paymentMethod" gin_trgm_ops) WHERE "paymentMethod" IS NOT NULL;

-- =====================================================================
-- Verificación
-- =====================================================================
-- Para verificar que los índices se están usando, ejecutar:
--   EXPLAIN ANALYZE SELECT * FROM "Customer"
--   WHERE name ILIKE '%termino%';
--
-- Si el plan muestra "Bitmap Heap Scan on Customer" + "Recheck Cond"
-- acompañado de "Bitmap Index Scan on idx_customer_name_trgm",
-- el índice está siendo utilizado.
