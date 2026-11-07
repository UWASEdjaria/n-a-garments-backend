-- Rename KPAY to PAYPAL in PaymentProvider enum

-- Update any existing rows that use KPAY before altering the enum
UPDATE "Payment" SET "provider" = 'PAYPAL' WHERE "provider" = 'KPAY';

-- Rename the enum value
ALTER TYPE "PaymentProvider" RENAME VALUE 'KPAY' TO 'PAYPAL';
