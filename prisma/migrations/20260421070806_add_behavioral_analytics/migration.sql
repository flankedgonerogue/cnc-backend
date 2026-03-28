/*
  Warnings:

  - Added the required column `choiceSequenceNum` to the `Interaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turnNumber` to the `Interaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "behavioralPattern" TEXT,
ADD COLUMN     "choiceSequenceNum" INTEGER NOT NULL,
ADD COLUMN     "nodeApprovedByTherapist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nodeConfidenceScore" DOUBLE PRECISION,
ADD COLUMN     "nodeId" TEXT,
ADD COLUMN     "sessionDuration" INTEGER,
ADD COLUMN     "turnNumber" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "BehavioralAnalytics" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalChoices" INTEGER NOT NULL DEFAULT 0,
    "positiveChoices" INTEGER NOT NULL DEFAULT 0,
    "negativeChoices" INTEGER NOT NULL DEFAULT 0,
    "neutralChoices" INTEGER NOT NULL DEFAULT 0,
    "avgTimeTakenMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minTimeTakenMs" INTEGER,
    "maxTimeTakenMs" INTEGER,
    "decisionSpeedTrend" TEXT,
    "positiveChoicePattern" TEXT,
    "hasAbandonmentRisk" BOOLEAN NOT NULL DEFAULT false,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "avgNodeConfidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "therapistApprovedNodes" INTEGER NOT NULL DEFAULT 0,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "dominantBehaviorPattern" TEXT,
    "notesForTherapist" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehavioralAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BehavioralAnalytics_sessionId_key" ON "BehavioralAnalytics"("sessionId");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "StoryNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralAnalytics" ADD CONSTRAINT "BehavioralAnalytics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
