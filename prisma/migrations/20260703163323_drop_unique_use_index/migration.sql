-- DropIndex
DROP INDEX "Match_store_eventName_round_player_opponent_key";

-- DropIndex
DROP INDEX "Standing_store_eventName_nickname_key";

-- CreateIndex
CREATE INDEX "Standing_store_eventName_idx" ON "Standing"("store", "eventName");
