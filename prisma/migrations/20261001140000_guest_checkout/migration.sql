ALTER TABLE "Order"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "guestName" TEXT,
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "guestPhone" TEXT;