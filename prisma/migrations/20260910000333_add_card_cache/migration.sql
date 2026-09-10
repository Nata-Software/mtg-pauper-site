-- CreateTable
CREATE TABLE "Card" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scryfallId" TEXT,
    "oracleId" TEXT,
    "typeLine" TEXT,
    "manaCost" TEXT,
    "cmc" DOUBLE PRECISION,
    "colors" TEXT,
    "rarity" TEXT,
    "setCode" TEXT,
    "oracleText" TEXT,
    "power" TEXT,
    "toughness" TEXT,
    "imageSmall" TEXT,
    "imageNormal" TEXT,
    "imageArtCrop" TEXT,
    "scryfallUri" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");
