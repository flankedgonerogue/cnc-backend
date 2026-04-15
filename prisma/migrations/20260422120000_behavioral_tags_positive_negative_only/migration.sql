-- Merge legacy neutral counts into negative; normalize behavioral tag strings to Positive | Negative only.

-- BehavioralAnalytics: fold neutralChoices into negativeChoices, then drop column
UPDATE "BehavioralAnalytics"
SET "negativeChoices" = "negativeChoices" + "neutralChoices";

ALTER TABLE "BehavioralAnalytics" DROP COLUMN "neutralChoices";

-- Normalize stored choice tags
UPDATE "Choice"
SET "behavioralTag" = 'Negative'
WHERE "behavioralTag" IN ('Neutral', 'Neutral/Negative');

-- Normalize interaction patterns (copied from choice at interaction time)
UPDATE "Interaction"
SET "behavioralPattern" = 'Negative'
WHERE "behavioralPattern" IN ('Neutral', 'Neutral/Negative');
