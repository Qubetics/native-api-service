-- CreateTable
CREATE TABLE "DvpnTransaction" (
    "id" SERIAL NOT NULL,
    "txHash" TEXT NOT NULL,
    "planId" TEXT,
    "sessionId" TEXT,
    "subscriptionId" TEXT,
    "type" TEXT NOT NULL,
    "accAddress" TEXT,
    "nodeAddress" TEXT,
    "downloadBytes" TEXT,
    "uploadBytes" TEXT,
    "maxBytes" TEXT,
    "duration" TEXT,
    "maxDuration" TEXT,
    "status" TEXT,
    "startAt" TEXT,
    "statusAt" TEXT,
    "inactiveAt" TEXT,
    "price" JSONB,
    "logs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DvpnTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DvpnTransaction_txHash_key" ON "DvpnTransaction"("txHash");
