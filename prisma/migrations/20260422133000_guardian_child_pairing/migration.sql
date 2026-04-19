-- Allow one guardian to be linked to multiple children
DROP INDEX IF EXISTS "ChildProfile_guardianId_key";

-- Pairing requests for guardian-child linking by email confirmation
CREATE TYPE "GuardianChildPairingStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "GuardianChildPairingRequest" (
    "id" TEXT NOT NULL,
    "guardianProfileId" TEXT NOT NULL,
    "childUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "GuardianChildPairingStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianChildPairingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianChildPairingRequest_tokenHash_key" ON "GuardianChildPairingRequest"("tokenHash");
CREATE INDEX "GuardianChildPairingRequest_guardianProfileId_idx" ON "GuardianChildPairingRequest"("guardianProfileId");
CREATE INDEX "GuardianChildPairingRequest_childUserId_idx" ON "GuardianChildPairingRequest"("childUserId");
CREATE INDEX "GuardianChildPairingRequest_status_expiresAt_idx" ON "GuardianChildPairingRequest"("status", "expiresAt");

ALTER TABLE "GuardianChildPairingRequest"
ADD CONSTRAINT "GuardianChildPairingRequest_guardianProfileId_fkey"
FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuardianChildPairingRequest"
ADD CONSTRAINT "GuardianChildPairingRequest_childUserId_fkey"
FOREIGN KEY ("childUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
