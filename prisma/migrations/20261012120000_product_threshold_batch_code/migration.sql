ALTER TABLE "Product"
ADD COLUMN "maximumStockLevel" INTEGER NOT NULL DEFAULT 100;

UPDATE "Product"
SET "maximumStockLevel" = "minimumStockLevel"
WHERE "maximumStockLevel" < "minimumStockLevel";

ALTER TABLE "StockEntry"
ADD COLUMN "batchCode" TEXT;

UPDATE "StockEntry"
SET "batchCode" = 'LEGACY-' || "id"
WHERE "batchCode" IS NULL;

ALTER TABLE "StockEntry"
ALTER COLUMN "batchCode" SET NOT NULL;

CREATE UNIQUE INDEX "StockEntry_batchCode_key" ON "StockEntry"("batchCode");