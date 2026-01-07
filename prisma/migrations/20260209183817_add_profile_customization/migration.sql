/*
  Warnings:

  - The `behavioralGoals` column on the `ChildProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ChildProfile" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "gamificationData" JSONB,
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "triggers" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "behavioralGoals",
ADD COLUMN     "behavioralGoals" JSONB;

-- AlterTable
ALTER TABLE "GuardianProfile" ADD COLUMN     "emergencyContactInfo" TEXT,
ADD COLUMN     "notificationPreferences" JSONB,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "relationship" TEXT;

-- AlterTable
ALTER TABLE "TherapistProfile" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "clinicName" TEXT,
ADD COLUMN     "interventionThreshold" DOUBLE PRECISION,
ADD COLUMN     "licenseNumber" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "timezone" TEXT;
