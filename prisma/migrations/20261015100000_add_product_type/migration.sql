-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('READY_TO_WEAR', 'MADE_TO_ORDER');

-- AlterTable: add productType to Product, defaulting all existing rows to MADE_TO_ORDER
ALTER TABLE "Product"
ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'MADE_TO_ORDER';

-- AlterTable: add optional productId to CustomOrder
ALTER TABLE "CustomOrder"
ADD COLUMN "productId" TEXT;

-- AddForeignKey
ALTER TABLE "CustomOrder"
ADD CONSTRAINT "CustomOrder_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
