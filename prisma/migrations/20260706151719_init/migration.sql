-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "store" TEXT NOT NULL DEFAULT 'default',
    "eventName" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "round" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "deck" TEXT NOT NULL,
    "playerScore" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "opponentDeck" TEXT NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standing" (
    "id" SERIAL NOT NULL,
    "store" TEXT NOT NULL DEFAULT 'default',
    "eventName" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "nickname" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "deck" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Standing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_store_deck_opponentDeck_idx" ON "Match"("store", "deck", "opponentDeck");

-- CreateIndex
CREATE INDEX "Match_store_date_idx" ON "Match"("store", "date");

-- CreateIndex
CREATE INDEX "Standing_store_eventName_idx" ON "Standing"("store", "eventName");

-- CreateIndex
CREATE INDEX "Standing_store_date_idx" ON "Standing"("store", "date");
