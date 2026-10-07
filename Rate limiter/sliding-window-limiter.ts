//Sliding window log rate limiter

// sliding windows log keeps a sorted list of req timestamps. it counts reqs within the last N seconds from the current time, eliminating the boundry of burst problem.

class SlidingWindowLogRateLimiter {
    private logs: Map<string, number[]> = new Map();

    constructor(
        private maxRequests: number,
        private windowMs: number
    ){}

    isAllowed(key: string): boolean {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        let timestamps = this.logs.get(key) || [];

        // remove expired entries

        timestamps = timestamps.filter(timestamp => timestamp > windowStart);

        if (timestamps.length < this.maxRequests) {
            timestamps.push(now);
            this.logs.set(key, timestamps);
            return true;
        }

        this.logs.set(key,timestamps);
        return false;
    }

    // return ms until the next allowed req

    retryAfter(key: string): number {
        const now = Date.now();
        let timestamps = this.logs.get(key) || [];

        timestamps = timestamps.filter(timestamp => timestamp > now - this.windowMs);
        this.logs.set(key, timestamps);

        if (timestamps.length < this.maxRequests) {
            return 0;
        }

        const oldest = timestamps[0];

        if (oldest === undefined) {
            return 0;
        }

        return Math.max(0, oldest + this.windowMs - now);
    }
}

// ❌ Memory problem: stores every timestamp
// 10,000 users × 100 requests/min = 1M timestamps in memory
// Not practical for high-traffic APIs

// ✅ Solution: sliding window log with pruning, which keeps only active timestamps

 // ---------- Demo ----------
// Small numbers so you can actually watch the behaviour happen.

const MAX = 5; // requests allowed per window
const WINDOW_MS = 2_000;
const limiter = new SlidingWindowLogRateLimiter(MAX, WINDOW_MS);

const state = () =>
  [...(limiter as unknown as { logs: Map<string, number[]> }).logs.entries()]
    .map(([k, v]) => ({ key: k, timestamps: [...v] }));

function attempt(n: number, key = "user-1") {
  const t0 = Date.now();
  const allowed = limiter.isAllowed(key);
  const active = [...(limiter as unknown as { logs: Map<string, number[]> }).logs.get(key) ?? []]
    .filter((timestamp) => timestamp > t0 - WINDOW_MS)
    .sort((a, b) => a - b);

  const count = active.length;
  const oldest = active[0];
  const resetsIn = oldest === undefined ? 0 : oldest + WINDOW_MS - t0;

  console.log(
    `[${String(t0 - start).padStart(5)}ms] req#${n} ${key} -> ${allowed ? "ALLOW" : "BLOCK"}  count=${count}/${MAX} resets_in=${resetsIn}ms`
  );
}

const start = Date.now();

console.log(`--- burst of ${MAX + 3} requests inside one window (${WINDOW_MS}ms) ---`);
for (let i = 1; i <= MAX + 3; i++) {
  attempt(i);
  await Bun.sleep(150);
}

console.log(`\n--- waiting for the oldest request to age out ---`);
const cur = state().find((w) => w.key === "user-1" && w.timestamps.length > 0);
if (!cur) {
  console.log("no active timestamps yet, skipping wait");
} else {
  const oldest = [...cur.timestamps].sort((a, b) => a - b)[0];
  if (oldest === undefined) {
    console.log("no timestamps found, skipping wait");
  } else {
    const waitMs = oldest + WINDOW_MS - Date.now() + 50;
    console.log(`sleeping ${waitMs}ms...`);
    await Bun.sleep(Math.max(waitMs, 0));
  }
}

console.log(`\n--- same user fires again in the new window ---`);
for (let i = 1; i <= 9; i++) {
  attempt(i);
  await Bun.sleep(100);
}

console.log(`\n--- a different key has its own counter ---`);
attempt(1, "user-2");

console.log("\n--- state map now ---");
console.table(state());
