CREATE TYPE "PaymentProvider" AS ENUM ('PAYPACK', 'KPAY');

ALTER TABLE "Payment"
ADD COLUMN "provider" "PaymentProvider";

ALTER TABLE "Payment"
ADD COLUMN "providerTransactionRef" TEXT;

CREATE UNIQUE INDEX "Payment_providerTransactionRef_key"
ON "Payment"("providerTransactionRef");