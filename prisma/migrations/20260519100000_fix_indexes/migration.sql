-- prisma-execute-without-transaction

-- Drop old single-column indexes on Transactions that are now replaced by composites
DROP INDEX CONCURRENTLY IF EXISTS "Transactions_createdAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Transactions_type_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Transactions_fromAddress_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Transactions_toAddress_idx";

-- Drop old Validator index (replaced by status+votingPower composite)
DROP INDEX CONCURRENTLY IF EXISTS "Validator_selfStake_createdAt_updatedAt_validatorAddress_idx";

-- Transactions: composite indexes for common filter+sort patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Transactions_type_createdAt_idx" ON "Transactions" ("type", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Transactions_createdAt_desc_idx" ON "Transactions" ("createdAt" DESC);

-- Validator: status+votingPower for getAllValidators (filter by status, order by votingPower desc)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Validator_status_votingPower_idx" ON "Validator" ("status", "votingPower" DESC);

-- ContractLogs: contractAddress+createdAt for contract log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ContractLogs_contractAddress_createdAt_idx" ON "ContractLogs" ("contractAddress", "createdAt" DESC);

-- Holders: contractAddress for token holder lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Holders_contractAddress_idx" ON "Holders" ("contractAddress");
