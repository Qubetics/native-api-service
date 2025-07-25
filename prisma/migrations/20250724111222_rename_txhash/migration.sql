/*
  Warnings:

  - You are about to drop the column `txHash` on the `DvpnTransaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[txhash]` on the table `DvpnTransaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `txhash` to the `DvpnTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DvpnTransaction_txHash_key";

-- AlterTable
ALTER TABLE "DvpnTransaction" DROP COLUMN "txHash",
ADD COLUMN     "txhash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DvpnTransaction_txhash_key" ON "DvpnTransaction"("txhash");
