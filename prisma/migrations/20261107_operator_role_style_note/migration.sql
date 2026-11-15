-- OPERATOR: one person may write, approve and publish on the media they are assigned to.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPERATOR';

-- Optional one-off style instruction supplied with a draft request.
ALTER TABLE "AiGenerationRun" ADD COLUMN "styleNote" TEXT;
