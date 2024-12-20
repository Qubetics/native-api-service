/*
  Warnings:

  - A unique constraint covering the columns `[address]` on the table `ValidatedBlocksCount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ValidatedBlocksCount" ALTER COLUMN "address" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "ValidatedBlocksCount_address_key" ON "ValidatedBlocksCount"("address");
