-- CreateEnum
CREATE TYPE "PackageReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable: 整案交付包复核记录
CREATE TABLE "case_package_reviews" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "selectedSections" JSONB NOT NULL,
    "status" "PackageReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_package_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_package_reviews_caseId_idx" ON "case_package_reviews"("caseId");

-- CreateIndex
CREATE INDEX "case_package_reviews_reviewerId_idx" ON "case_package_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "case_package_reviews_caseId_createdAt_idx" ON "case_package_reviews"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "case_package_reviews" ADD CONSTRAINT "case_package_reviews_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_package_reviews" ADD CONSTRAINT "case_package_reviews_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
