/*
  Warnings:

  - A unique constraint covering the columns `[zapReceiptId]` on the table `ticket` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ZapReceipt" ADD COLUMN     "isAnswered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "zapReceiptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ticket_zapReceiptId_key" ON "ticket"("zapReceiptId");

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_zapReceiptId_fkey" FOREIGN KEY ("zapReceiptId") REFERENCES "ZapReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
