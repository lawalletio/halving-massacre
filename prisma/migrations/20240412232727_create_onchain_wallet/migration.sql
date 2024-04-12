/*
  Warnings:

  - You are about to drop the column `output_index` on the `transaction_output` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tx_id,player_id]` on the table `transaction_output` will be added. If there are existing duplicate values, this will fail.
  - Made the column `player_id` on table `transaction_output` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transaction_output" DROP CONSTRAINT "transaction_output_round_id_player_id_fkey";

-- DropIndex
DROP INDEX "transaction_output_tx_id_output_index_key";

-- AlterTable
ALTER TABLE "transaction_output" DROP COLUMN "output_index",
ALTER COLUMN "player_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "onchain_wallet" (
    "x_pub_key" TEXT NOT NULL,
    "lastIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "onchain_wallet_pkey" PRIMARY KEY ("x_pub_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_output_tx_id_player_id_key" ON "transaction_output"("tx_id", "player_id");

-- AddForeignKey
ALTER TABLE "transaction_output" ADD CONSTRAINT "transaction_output_round_id_player_id_fkey" FOREIGN KEY ("round_id", "player_id") REFERENCES "round_player"("round_id", "player_id") ON DELETE RESTRICT ON UPDATE CASCADE;
