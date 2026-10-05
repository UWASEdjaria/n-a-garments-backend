DROP INDEX "Payment_orderId_key";

CREATE UNIQUE INDEX "Payment_one_pending_per_order_key"
ON "Payment"("orderId")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "Payment_one_paid_per_order_key"
ON "Payment"("orderId")
WHERE "status" = 'PAID';
