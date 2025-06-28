/*
  Warnings:

  - A unique constraint covering the columns `[userId,accountId]` on the table `budgets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountId` to the `budgets` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "budgets_userId_key";

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "accountId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "budgets_accountId_idx" ON "budgets"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_userId_accountId_key" ON "budgets"("userId", "accountId");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
