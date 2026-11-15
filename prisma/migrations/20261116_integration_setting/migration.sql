-- Owner-managed integration secrets (AES-256-GCM ciphertext in "value").
CREATE TABLE "IntegrationSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "hint" TEXT NOT NULL DEFAULT '',
    "updatedByName" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("key")
);
