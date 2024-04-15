/*
  Warnings:

  - Added the required column `pool_pub_key` to the `game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "game" ADD COLUMN     "pool_pub_key" TEXT NOT NULL DEFAULT '';
