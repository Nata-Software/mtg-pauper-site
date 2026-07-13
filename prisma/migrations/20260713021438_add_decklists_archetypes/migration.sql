-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "archetype" TEXT,
ADD COLUMN     "decklistId" TEXT,
ADD COLUMN     "opponentArchetype" TEXT,
ADD COLUMN     "opponentDecklistId" TEXT;

-- CreateTable
CREATE TABLE "Decklist" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "player" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Decklist_tournamentId_idx" ON "Decklist"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_store_archetype_opponentArchetype_idx" ON "Match"("store", "archetype", "opponentArchetype");
