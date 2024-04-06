/*
  Warnings:

  - You are about to drop the column `zap_requests` on the `round_player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "round_player" DROP COLUMN "zap_requests";

-- CreateTable
CREATE TABLE "ZapReceipt" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "roundId" UUID NOT NULL,
    "playerId" UUID NOT NULL,

    CONSTRAINT "ZapReceipt_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ZapReceipt" ADD CONSTRAINT "ZapReceipt_roundId_playerId_fkey" FOREIGN KEY ("roundId", "playerId") REFERENCES "round_player"("round_id", "player_id") ON DELETE RESTRICT ON UPDATE CASCADE;
