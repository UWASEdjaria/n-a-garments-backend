ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "providerEventId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerEventId_key"
ON "Payment"("providerEventId");

CREATE TABLE IF NOT EXISTS "PaypackWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaypackWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaypackWebhookEvent_eventId_key"
ON "PaypackWebhookEvent"("eventId");

CREATE INDEX IF NOT EXISTS "PaypackWebhookEvent_transactionRef_processedAt_idx"
ON "PaypackWebhookEvent"("transactionRef", "processedAt");