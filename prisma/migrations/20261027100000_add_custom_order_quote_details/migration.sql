-- Add quote details and secure guest access fields to CustomOrder.
ALTER TABLE "CustomOrder"
ADD COLUMN "quoteReference" TEXT,
ADD COLUMN "deliveryFee" DECIMAL(10, 2),
ADD COLUMN "additionalCharges" DECIMAL(10, 2),
ADD COLUMN "estimatedCompletionAt" TIMESTAMP(3),
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "quoteAccessTokenHash" TEXT,
ADD COLUMN "quoteAccessTokenExpiresAt" TIMESTAMP(3);

-- Enforce uniqueness for readable quote references and token hashes.
CREATE UNIQUE INDEX "CustomOrder_quoteReference_key"
ON "CustomOrder"("quoteReference");

CREATE UNIQUE INDEX "CustomOrder_quoteAccessTokenHash_key"
ON "CustomOrder"("quoteAccessTokenHash");
