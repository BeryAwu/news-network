-- A deleted media keeps its articles, versions and audit trail; it is only hidden and taken offline.
ALTER TABLE "MediaSite" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
