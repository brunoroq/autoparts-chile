CREATE TABLE "CartMergeReceipt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartMergeReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CartMergeReceipt_userId_idx" ON "CartMergeReceipt"("userId");

ALTER TABLE "CartMergeReceipt" ADD CONSTRAINT "CartMergeReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
