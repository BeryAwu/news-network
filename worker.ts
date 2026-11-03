import IORedis from "ioredis";
import { Worker } from "bullmq";
import { db } from "./lib/db";
import { publishTarget } from "./lib/publishing";
const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL is required to run the background worker.");
const connection = new IORedis(url, { maxRetriesPerRequest: null });
const worker = new Worker("news-publishing", async (job) => {
  const targetId = job.data.targetId;
  if (typeof targetId !== "string") throw new Error("Invalid publishing job payload.");
  await publishTarget(targetId);
}, { connection, concurrency: 8 });
worker.on("failed", (job, error) => console.error("Publishing job failed", { jobId: job?.id, targetId: job?.data.targetId, error: error.message }));
console.log("News publishing worker is running.");
async function shutdown() { await worker.close(); await connection.quit(); await db.$disconnect(); }
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
