-- CreateTable
CREATE TABLE "guiding_cases" (
    "id" TEXT NOT NULL,
    "caseNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "batch" INTEGER NOT NULL,
    "publishDate" TEXT,
    "category" TEXT,
    "keywords" TEXT[],
    "holdingPoints" TEXT NOT NULL,
    "basicFacts" TEXT,
    "judgmentResult" TEXT,
    "judgmentReason" TEXT,
    "relevantLaws" TEXT,
    "url" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guiding_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GuidingCaseLawArticles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "guiding_cases_caseNo_key" ON "guiding_cases"("caseNo");

-- CreateIndex
CREATE INDEX "guiding_cases_caseNo_idx" ON "guiding_cases"("caseNo");

-- CreateIndex
CREATE INDEX "guiding_cases_batch_idx" ON "guiding_cases"("batch");

-- CreateIndex
CREATE UNIQUE INDEX "_GuidingCaseLawArticles_AB_unique" ON "_GuidingCaseLawArticles"("A", "B");

-- CreateIndex
CREATE INDEX "_GuidingCaseLawArticles_B_index" ON "_GuidingCaseLawArticles"("B");

-- AddForeignKey
ALTER TABLE "_GuidingCaseLawArticles" ADD CONSTRAINT "_GuidingCaseLawArticles_A_fkey" FOREIGN KEY ("A") REFERENCES "guiding_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuidingCaseLawArticles" ADD CONSTRAINT "_GuidingCaseLawArticles_B_fkey" FOREIGN KEY ("B") REFERENCES "law_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
