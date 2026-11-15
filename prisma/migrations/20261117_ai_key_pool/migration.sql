-- Several AI keys with automatic failover. Each key is its own row: key = 'ai.key.<id>'.
ALTER TABLE "IntegrationSetting" ADD COLUMN "label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IntegrationSetting" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IntegrationSetting" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE "IntegrationSetting" ADD COLUMN "cooldownUntil" TIMESTAMPTZ(3);
ALTER TABLE "IntegrationSetting" ADD COLUMN "lastError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IntegrationSetting" ADD COLUMN "lastUsedAt" TIMESTAMPTZ(3);
-- The single-key rows of the previous version are replaced by the pool.
DELETE FROM "IntegrationSetting" WHERE "key" = 'ai.openrouter.apiKey';
