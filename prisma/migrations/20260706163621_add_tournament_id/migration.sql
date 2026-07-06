-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "tournamentId" TEXT,
ADD COLUMN     "tournamentName" TEXT;

-- AlterTable
ALTER TABLE "Standing" ADD COLUMN     "tournamentId" TEXT,
ADD COLUMN     "tournamentName" TEXT;

-- CreateIndex
CREATE INDEX "Match_store_tournamentId_idx" ON "Match"("store", "tournamentId");

-- CreateIndex
CREATE INDEX "Standing_store_tournamentId_idx" ON "Standing"("store", "tournamentId");
