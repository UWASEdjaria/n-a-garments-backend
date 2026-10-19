-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'NEW_USER',
  'ORDER_RECEIVED',
  'CUSTOM_ORDER_RECEIVED',
  'CONTACT_MESSAGE_RECEIVED',
  'CART_ACTIVITY',
  'SYSTEM'
);

-- CreateTable
CREATE TABLE "AdminNotification" (
  "id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "actorName" TEXT,
  "actorEmail" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);