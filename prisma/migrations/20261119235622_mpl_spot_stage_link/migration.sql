-- AlterTable
ALTER TABLE "MplSpot" ADD COLUMN     "stageId" INTEGER;

-- CreateIndex
CREATE INDEX "MplSpot_stageId_idx" ON "MplSpot"("stageId");

-- AddForeignKey
ALTER TABLE "MplSpot" ADD CONSTRAINT "MplSpot_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "MplStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
