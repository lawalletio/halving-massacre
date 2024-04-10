-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "transaction_output" (
    "tx_id" TEXT NOT NULL,
    "output_index" INTEGER NOT NULL,
    "round_id" UUID,
    "player_id" UUID,
    "is_answered" BOOLEAN NOT NULL DEFAULT false,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING'
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_output_tx_id_output_index_key" ON "transaction_output"("tx_id", "output_index");

-- AddForeignKey
ALTER TABLE "transaction_output" ADD CONSTRAINT "transaction_output_round_id_player_id_fkey" FOREIGN KEY ("round_id", "player_id") REFERENCES "round_player"("round_id", "player_id") ON DELETE SET NULL ON UPDATE CASCADE;
