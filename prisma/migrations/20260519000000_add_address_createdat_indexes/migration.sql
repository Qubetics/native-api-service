-- prisma-execute-without-transaction

CREATE INDEX CONCURRENTLY "Transactions_fromAddress_createdAt_idx" ON "Transactions" ("fromAddress", "createdAt" DESC);
CREATE INDEX CONCURRENTLY "Transactions_toAddress_createdAt_idx" ON "Transactions" ("toAddress", "createdAt" DESC);