-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'FAILED';
ALTER TYPE "OrderStatus" ADD VALUE 'REVIEW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'UNKNOWN';
ALTER TYPE "PaymentStatus" ADD VALUE 'REVERSAL_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REVERSED';

-- DropIndex
DROP INDEX "Order_idempotencyKey_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cartId" UUID,
ADD COLUMN     "cartVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestHash" VARCHAR(64) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "operation" VARCHAR(24),
ADD COLUMN     "operationAt" TIMESTAMPTZ(3),
ADD COLUMN     "providerState" VARCHAR(40),
ADD COLUMN     "redirectUrl" VARCHAR(240),
ADD COLUMN     "reversalResult" VARCHAR(40),
ADD COLUMN     "sessionId" VARCHAR(61),
ADD COLUMN     "simulatedOutcome" VARCHAR(40),
ADD COLUMN     "tokenCipher" TEXT,
ADD COLUMN     "tokenHash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_tokenHash_key" ON "PaymentAttempt"("tokenHash");

CREATE INDEX "Order_cartId_status_idx" ON "Order"("cartId", "status");
