-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'PROPOSED', 'ACCEPTED', 'DECLINED');
CREATE TYPE "ProductionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable: add quote fields to CustomOrder
ALTER TABLE "CustomOrder"
ADD COLUMN "quoteStatus" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "quoteTotal" DECIMAL(10, 2),
ADD COLUMN "advanceAmount" DECIMAL(10, 2),
ADD COLUMN "advancePaidAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "balanceAmount" DECIMAL(10, 2),
ADD COLUMN "quoteProposedAt" TIMESTAMP(3),
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "declinedAt" TIMESTAMP(3),
ADD COLUMN "productionStatus" "ProductionStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable: make orderId nullable and add customOrderId to Payment
ALTER TABLE "Payment"
ADD COLUMN "customOrderId" TEXT,
ADD COLUMN "providerEventId" TEXT;

-- Make orderId nullable
ALTER TABLE "Payment" ALTER COLUMN "orderId" DROP NOT NULL;

-- Add unique constraint on providerEventId
CREATE UNIQUE INDEX "Payment_providerEventId_key" ON "Payment"("providerEventId");

-- Add foreign key for customOrderId
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_customOrderId_fkey"
FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for faster lookups
CREATE INDEX "Payment_customOrderId_idx" ON "Payment"("customOrderId");