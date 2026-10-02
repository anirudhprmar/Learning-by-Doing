// Fixed Window Rate Limiter divides time into fixed intervals and counts req per interval.

class FixedWindowRateLimiter {
  // Map is a data structure that stores key-value pairs.
  private windows: Map<string, { count: number; exipresAt: number }> = new Map();
 
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) { }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;

    const windowKey = `${key}:${windowStart}`;
    const window = this.windows.get(windowKey);

    if (!window || now >= window.exipresAt) {
      this.windows.set(windowKey, { count: 1, exipresAt: windowStart + this.windowMs });
      return true;
    }

    if(window.count < this.maxRequests) {
      window.count++;
      return true;
    }

    return false;
  }
}

  // ---------- Demo ----------
// Small numbers so you can actually watch the behaviour happen.

const MAX = 5; // requests allowed per window
const WINDOW_MS = 2_000;
const limiter = new FixedWindowRateLimiter(MAX, WINDOW_MS);

// peek inside the private map so we can print the real state
const state = () =>
  [...(limiter as unknown as { windows: Map<string, { count: number; exipresAt: number }> }).windows.entries()]
    .map(([k, v]) => ({ key: k.split(":")[0]!, window: k.split(":")[1]!, count: v.count, resetsIn: v.exipresAt - Date.now() }));

function attempt(n: number, key = "user-1") {
  const t0 = Date.now();
  const windowStart = Math.floor(t0 / WINDOW_MS) * WINDOW_MS;
  const allowed = limiter.isAllowed(key);
  const s = state().find((w) => w.key === key && w.window === String(windowStart));
  console.log(
    `[${String(t0 - start).padStart(5)}ms] req#${n} ${key} -> ${allowed ? "ALLOW" : "BLOCK"}  count=${s?.count}/${MAX} resets_in=${s?.resetsIn}ms`
  );
}

// align to a window boundary so the burst can't straddle two windows
await Bun.sleep(Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / WINDOW_MS) * WINDOW_MS - Date.now() % WINDOW_MS);
const start = Date.now();

console.log(`--- burst of ${MAX + 3} requests inside one window (${WINDOW_MS}ms) ---`);
for (let i = 1; i <= MAX + 3; i++) {
  attempt(i);
  await Bun.sleep(150);
}

console.log(`\n--- waiting for the window to roll over ---`);
const cur = state().find((w) => w.key === "user-1" && w.resetsIn > 0);
if (!cur) {
  console.log("already rolled over, skipping wait");
} else {
  const waitMs = cur.resetsIn + 50;
  console.log(`sleeping ${waitMs}ms...`);
  await Bun.sleep(waitMs);
}

console.log(`\n--- same user fires again in the new window ---`);
for (let i = 1; i <= 3; i++) {
  attempt(i);
  await Bun.sleep(100);
}

console.log(`\n--- a different key has its own counter ---`);
attempt(1, "user-2");

console.log("\n--- state map now ---");
console.table(state());
