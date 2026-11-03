import "dotenv/config";
import { defineConfig } from "prisma/config";
const datasourceUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/news_network?schema=public";
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = datasourceUrl;
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: datasourceUrl
  }
});
