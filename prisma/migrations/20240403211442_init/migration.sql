-- CreateEnum
CREATE TYPE "Status" AS ENUM ('SETUP', 'INITIAL', 'NORMAL', 'FREEZE', 'FINAL');

-- CreateTable
CREATE TABLE "game" (
    "id" TEXT NOT NULL,
    "final_block" INTEGER NOT NULL,
    "first_block" INTEGER,
    "initial_pool" INTEGER NOT NULL,
    "min_bet" INTEGER NOT NULL,
    "ticket_price" INTEGER NOT NULL,
    "current_block" INTEGER NOT NULL,
    "current_pool" INTEGER NOT NULL,
    "current_round_number" INTEGER NOT NULL,
    "freeze_duration" INTEGER,
    "next_freeze" INTEGER,
    "next_massacre" INTEGER,
    "round_length" INTEGER,
    "status" "Status" NOT NULL,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,

    CONSTRAINT "round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" TEXT NOT NULL,
    "walias" TEXT NOT NULL,
    "death_round_id" UUID,
    "max_zap" INTEGER NOT NULL DEFAULT 0,
    "power" INTEGER NOT NULL DEFAULT 0,
    "ticket_id" UUID NOT NULL,
    "total_zapped" INTEGER NOT NULL DEFAULT 0,
    "zap_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_player" (
    "round_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "max_zap" INTEGER NOT NULL DEFAULT 0,
    "zapped" INTEGER NOT NULL DEFAULT 0,
    "zap_count" INTEGER NOT NULL DEFAULT 0,
    "zap_requests" TEXT[],

    CONSTRAINT "round_player_pkey" PRIMARY KEY ("player_id","round_id")
);

-- CreateTable
CREATE TABLE "ticket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" TEXT NOT NULL,
    "walias" TEXT NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "round_game_id_number_key" ON "round"("game_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "player_ticket_id_key" ON "player"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_game_id_walias_key" ON "player"("game_id", "walias");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_game_id_walias_key" ON "ticket"("game_id", "walias");

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_id_current_round_number_fkey" FOREIGN KEY ("id", "current_round_number") REFERENCES "round"("game_id", "number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round" ADD CONSTRAINT "round_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_death_round_id_fkey" FOREIGN KEY ("death_round_id") REFERENCES "round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_player" ADD CONSTRAINT "round_player_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_player" ADD CONSTRAINT "round_player_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
