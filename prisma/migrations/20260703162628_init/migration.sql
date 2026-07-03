-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "store" TEXT NOT NULL DEFAULT 'default',
    "eventName" TEXT NOT NULL,
    "date" DATETIME,
    "round" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "deck" TEXT NOT NULL,
    "playerScore" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "opponentDeck" TEXT NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Standing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "store" TEXT NOT NULL DEFAULT 'default',
    "eventName" TEXT NOT NULL,
    "date" DATETIME,
    "nickname" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "deck" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Match_store_deck_opponentDeck_idx" ON "Match"("store", "deck", "opponentDeck");

-- CreateIndex
CREATE INDEX "Match_store_date_idx" ON "Match"("store", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Match_store_eventName_round_player_opponent_key" ON "Match"("store", "eventName", "round", "player", "opponent");

-- CreateIndex
CREATE INDEX "Standing_store_date_idx" ON "Standing"("store", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Standing_store_eventName_nickname_key" ON "Standing"("store", "eventName", "nickname");
