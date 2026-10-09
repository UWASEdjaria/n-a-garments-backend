ALTER TABLE "User"
ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User"
ADD COLUMN "emailVerificationToken" TEXT;

ALTER TABLE "User"
ADD COLUMN "emailVerificationTokenExpiry" TIMESTAMP(3);
