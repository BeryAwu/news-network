-- CreateTable
CREATE TABLE "WritingSkill" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "promptGuidance" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WritingSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaWritingSkill" (
    "mediaSiteId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaWritingSkill_pkey" PRIMARY KEY ("mediaSiteId","skillId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WritingSkill_slug_key" ON "WritingSkill"("slug");

-- CreateIndex
CREATE INDEX "WritingSkill_isActive_idx" ON "WritingSkill"("isActive");

-- AddForeignKey
ALTER TABLE "MediaWritingSkill" ADD CONSTRAINT "MediaWritingSkill_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaWritingSkill" ADD CONSTRAINT "MediaWritingSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "WritingSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
