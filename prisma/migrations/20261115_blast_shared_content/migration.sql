-- A blast is a SourceBrief with one shared content for all its media targets.
ALTER TABLE "SourceBrief" ADD COLUMN "contentMode" TEXT;
ALTER TABLE "SourceBrief" ADD COLUMN "styleSkillSlug" TEXT;
ALTER TABLE "SourceBrief" ADD COLUMN "featuredAssetId" TEXT;
ALTER TABLE "SourceBrief" ADD COLUMN "galleryAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Article" ADD COLUMN "galleryAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ArticleVersion" ADD COLUMN "galleryAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AiGenerationRun" ADD COLUMN "styleSkillSlug" TEXT;
