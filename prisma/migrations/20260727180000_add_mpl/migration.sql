-- CreateTable
CREATE TABLE "MplStage" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'open',
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "meleeId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'individual',
    "countsForRanking" BOOLEAN NOT NULL DEFAULT true,
    "playerCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MplStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MplResult" (
    "id" SERIAL NOT NULL,
    "stageId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "record" TEXT,
    "points" INTEGER NOT NULL,
    "omw" DOUBLE PRECISION,
    "tgw" DOUBLE PRECISION,
    "ogw" DOUBLE PRECISION,

    CONSTRAINT "MplResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MplSpot" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "meleeUsername" TEXT,
    "source" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "store" TEXT,
    "date" TIMESTAMP(3),
    "standingsRef" TEXT,
    "mural" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MplSpot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MplStage_season_kind_ordinal_key" ON "MplStage"("season", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "MplStage_season_idx" ON "MplStage"("season");

-- CreateIndex
CREATE INDEX "MplResult_stageId_idx" ON "MplResult"("stageId");

-- CreateIndex
CREATE INDEX "MplResult_username_idx" ON "MplResult"("username");

-- CreateIndex
CREATE INDEX "MplSpot_season_idx" ON "MplSpot"("season");

-- CreateIndex
CREATE INDEX "MplSpot_meleeUsername_idx" ON "MplSpot"("meleeUsername");

-- AddForeignKey
ALTER TABLE "MplResult" ADD CONSTRAINT "MplResult_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "MplStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
