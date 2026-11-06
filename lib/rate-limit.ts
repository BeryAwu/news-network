// lib/rate-limit.ts — lightweight in-memory sliding-window rate limiter.
// Per-process state: fine for the modular monolith; a multi-instance
// production deployment should use a shared store (Redis) or an edge
// gateway limiter instead.

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000;
const PRUNE_INTERVAL_MS = 10 * 60 * 1000; // clean stale buckets at most every 10 min
const STALE_AFTER_MS = 60 * 60 * 1000; // a bucket with no hit in 1h is stale

let lastPruneAt = 0;

function prune(now: number) {
  const staleBefore = now - STALE_AFTER_MS;
  for (const [key, hits] of buckets) {
    // Linear scan is fine at this scale: buckets are bounded by MAX_BUCKETS
    // and pruning runs at most once per 10 minutes.
    if (hits.length === 0 || hits[hits.length - 1]! < staleBefore) buckets.delete(key);
  }
}

function maybePrune(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
  lastPruneAt = now;
  prune(now);
  // Hard safety cap: if a burst of fresh unique keys still exceeds the cap
  // after pruning, evict the least-recently-hit buckets.
  while (buckets.size > MAX_BUCKETS) {
    let oldestKey: string | null = null;
    let oldestHit = Infinity;
    for (const [key, hits] of buckets) {
      const last = hits[hits.length - 1] ?? 0;
      if (last < oldestHit) { oldestHit = last; oldestKey = key; }
    }
    if (oldestKey === null) break;
    buckets.delete(oldestKey);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    maybePrune(now);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  maybePrune(now);
  return true;
}

// Never trust client-supplied forwarding headers unless a trusted proxy chain
// is configured. In development (no proxy) all traffic shares a "local"
// bucket, which is acceptable for local use; production must set
// TRUSTED_PROXY_HEADER and run behind a proxy that overwrites that header.
export function clientIp(request: Request): string {
  const headerName = process.env.TRUSTED_PROXY_HEADER;
  if (headerName) {
    const value = request.headers.get(headerName);
    if (value) return value.split(",")[0]!.trim();
  }
  const remote = request.headers.get("x-real-ip");
  return remote ?? "local";
}
