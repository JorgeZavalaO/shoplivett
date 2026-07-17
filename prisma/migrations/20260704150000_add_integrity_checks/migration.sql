DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variant_non_negative_chk') THEN
    ALTER TABLE "ProductVariant"
      ADD CONSTRAINT product_variant_non_negative_chk
      CHECK (
        "price" >= 0
        AND ("cost" IS NULL OR "cost" >= 0)
        AND "stock" >= 0
        AND "reservedStock" >= 0
        AND "soldStock" >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_financial_invariants_chk') THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT order_financial_invariants_chk
      CHECK (
        "subtotal" >= 0
        AND "discount" >= 0
        AND "shippingAmount" >= 0
        AND "total" >= 0
        AND "validatedPaid" >= 0
        AND "balance" >= 0
        AND "productCostPen" >= 0
        AND "paymentFeePen" >= 0
        AND "packagingCostPen" >= 0
        AND "deliveryBusinessCostPen" >= 0
        AND "validatedPaid" <= "total"
        AND "balance" <= "total"
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_item_non_negative_chk') THEN
    ALTER TABLE "OrderItem"
      ADD CONSTRAINT order_item_non_negative_chk
      CHECK (
        "quantity" > 0
        AND "unitPrice" >= 0
        AND "lineTotal" >= 0
        AND "unitCostPen" >= 0
        AND "totalCostPen" >= 0
        AND "netLineRevenuePen" >= 0
        AND "lineDiscountPen" >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_item_batch_allocation_non_negative_chk') THEN
    ALTER TABLE "OrderItemBatchAllocation"
      ADD CONSTRAINT order_item_batch_allocation_non_negative_chk
      CHECK (
        "quantity" > 0
        AND "unitCostPen" >= 0
        AND "subtotalCostPen" >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_amount_positive_chk') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT payment_amount_positive_chk
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_application_amount_positive_chk') THEN
    ALTER TABLE "PaymentApplication"
      ADD CONSTRAINT payment_application_amount_positive_chk
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_invariants_chk') THEN
    ALTER TABLE "CustomerCredit"
      ADD CONSTRAINT customer_credit_invariants_chk
      CHECK (
        "amount" >= 0
        AND "availableAmount" >= 0
        AND "availableAmount" <= "amount"
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_application_amount_positive_chk') THEN
    ALTER TABLE "CustomerCreditApplication"
      ADD CONSTRAINT customer_credit_application_amount_positive_chk
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipment_costs_non_negative_chk') THEN
    ALTER TABLE "Shipment"
      ADD CONSTRAINT shipment_costs_non_negative_chk
      CHECK (
        "shippingCost" >= 0
        AND "realCostPen" >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipment_order_allocated_shipping_non_negative_chk') THEN
    ALTER TABLE "ShipmentOrder"
      ADD CONSTRAINT shipment_order_allocated_shipping_non_negative_chk
      CHECK ("allocatedShippingCostPen" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batch_item_invariants_chk') THEN
    ALTER TABLE "ImportBatchItem"
      ADD CONSTRAINT import_batch_item_invariants_chk
      CHECK (
        "quantityPurchased" >= 0
        AND "quantityReceived" >= 0
        AND "quantityAvailable" >= 0
        AND "quantityReceived" <= "quantityPurchased"
        AND "quantityAvailable" <= "quantityReceived"
        AND "unitCostUsd" >= 0
        AND "unitCostPen" >= 0
        AND "weight" >= 0
        AND "subtotalUsd" >= 0
        AND "subtotalPen" >= 0
        AND "additionalCostPen" >= 0
        AND "additionalSubtotalPen" >= 0
        AND "landedUnitCostPen" >= 0
        AND "landedSubtotalPen" >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_amount_positive_chk') THEN
    ALTER TABLE "Expense"
      ADD CONSTRAINT expense_amount_positive_chk
      CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_invariants_chk') THEN
    ALTER TABLE "Incident"
      ADD CONSTRAINT incident_invariants_chk
      CHECK (
        "quantity" > 0
        AND "recoveredAmount" >= 0
        AND "lostAmount" >= 0
        AND "restockQuantity" >= 0
        AND "restockQuantity" <= "quantity"
      );
  END IF;
END $$;
