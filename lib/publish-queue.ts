import IORedis from "ioredis";
import { Queue } from "bullmq";

let queue: Queue | null = null;

/** The BullMQ publishing queue, or null when REDIS_URL is not set (publishing then runs inline). */
export function publishingQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!queue) queue = new Queue("news-publishing", { connection: new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true }) });
  return queue;
}
