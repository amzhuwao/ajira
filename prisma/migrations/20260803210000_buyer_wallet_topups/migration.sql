-- AlterEnum
ALTER TYPE "WalletTxnType" ADD VALUE 'TOP_UP';

-- CreateEnum
CREATE TYPE "EscrowFundingSource" AS ENUM ('PAYNOW', 'WALLET');

-- AlterTable
ALTER TABLE "Escrow" ADD COLUMN "fundingSource" "EscrowFundingSource";

-- CreateTable
CREATE TABLE "WalletTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantReference" TEXT NOT NULL,
    "paynowReference" TEXT,
    "pollUrl" TEXT,
    "redirectUrl" TEXT,
    "channel" "PaymentChannel" NOT NULL,
    "phone" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "instructions" TEXT,
    "rawStatus" TEXT,
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTopUp_merchantReference_key" ON "WalletTopUp"("merchantReference");
CREATE INDEX "WalletTopUp_userId_idx" ON "WalletTopUp"("userId");
CREATE INDEX "WalletTopUp_status_idx" ON "WalletTopUp"("status");

ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
