-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "clientSignature" TEXT,
ADD COLUMN     "clientSignedAt" TIMESTAMP(3),
ADD COLUMN     "clientSignedIp" TEXT,
ADD COLUMN     "lawyerSignature" TEXT,
ADD COLUMN     "lawyerSignedAt" TIMESTAMP(3),
ADD COLUMN     "lawyerSignedIp" TEXT,
ADD COLUMN     "signatureDevice" TEXT;
