-- AlterTable
ALTER TABLE "game" ALTER COLUMN "initial_pool" SET DATA TYPE BIGINT,
ALTER COLUMN "min_bet" SET DATA TYPE BIGINT,
ALTER COLUMN "ticket_price" SET DATA TYPE BIGINT,
ALTER COLUMN "current_pool" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "player" ALTER COLUMN "max_zap" SET DATA TYPE BIGINT,
ALTER COLUMN "power" SET DATA TYPE BIGINT,
ALTER COLUMN "total_zapped" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "round_player" ALTER COLUMN "max_zap" SET DATA TYPE BIGINT,
ALTER COLUMN "zapped" SET DATA TYPE BIGINT;