-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SHIPMENT_UPDATED';

-- DropIndex
DROP INDEX "idx_customer_name_trgm";

-- DropIndex
DROP INDEX "idx_customer_search_name_trgm";

-- DropIndex
DROP INDEX "idx_customer_whatsapp_trgm";

-- DropIndex
DROP INDEX "idx_expense_description_trgm";

-- DropIndex
DROP INDEX "idx_order_order_number_trgm";

-- DropIndex
DROP INDEX "idx_product_name_trgm";

-- DropIndex
DROP INDEX "idx_variant_code_trgm";

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "estimatedArrivalDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApiRateLimit" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiRateLimit_scope_key_windowStart_idx" ON "ApiRateLimit"("scope", "key", "windowStart");

-- CreateIndex
CREATE INDEX "ApiRateLimit_blockedUntil_idx" ON "ApiRateLimit"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRateLimit_scope_key_key" ON "ApiRateLimit"("scope", "key");

-- CreateIndex
CREATE INDEX "CustomerCreditApplication_creditId_createdAt_idx" ON "CustomerCreditApplication"("creditId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerCreditApplication_orderId_createdAt_idx" ON "CustomerCreditApplication"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_shopper_idx" ON "ImportBatch"("shopper");

-- CreateIndex
CREATE INDEX "ImportBatch_agency_idx" ON "ImportBatch"("agency");

-- CreateIndex
CREATE INDEX "ImportBatchItem_variantId_calculatedAt_idx" ON "ImportBatchItem"("variantId", "calculatedAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_status_profitCalculatedAt_idx" ON "Order"("status", "profitCalculatedAt");

-- CreateIndex
CREATE INDEX "Payment_status_validatedAt_idx" ON "Payment"("status", "validatedAt");

-- CreateIndex
CREATE INDEX "Payment_customerId_createdAt_idx" ON "Payment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentApplication_paymentId_createdAt_idx" ON "PaymentApplication"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentApplication_orderId_createdAt_idx" ON "PaymentApplication"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_status_createdAt_idx" ON "Shipment"("status", "createdAt");
