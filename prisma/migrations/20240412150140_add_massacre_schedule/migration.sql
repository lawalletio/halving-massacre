/*
  Warnings:

  - You are about to drop the column `freeze_duration` on the `game` table. All the data in the column will be lost.
  - You are about to drop the column `next_freeze` on the `game` table. All the data in the column will be lost.
  - You are about to drop the column `next_massacre` on the `game` table. All the data in the column will be lost.
  - You are about to drop the column `round_length` on the `game` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[next_round_id]` on the table `round` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "game" DROP COLUMN "freeze_duration",
DROP COLUMN "next_freeze",
DROP COLUMN "next_massacre",
DROP COLUMN "round_length";

-- AlterTable
ALTER TABLE "round" ADD COLUMN     "freeze_height" INTEGER,
ADD COLUMN     "massacre_height" INTEGER,
ADD COLUMN     "next_round_id" UUID,
ADD COLUMN     "survivors" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "round_next_round_id_key" ON "round"("next_round_id");

-- AddForeignKey
ALTER TABLE "round" ADD CONSTRAINT "round_next_round_id_fkey" FOREIGN KEY ("next_round_id") REFERENCES "round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
