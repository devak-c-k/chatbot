import { kv } from "@vercel/kv";

const TOTAL_KEYS = 10;              // Number of GOOGLE_API_KEY{n}
const WINDOW_SECONDS = 30;          // Rate window
const PER_KEY_LIMIT = 4;            // Max uses per key per window

export interface SelectedKey {
  apiKey: string;
  index: number;        // 1-based
  usage: number;        // usage AFTER increment
  remaining: number;    // remaining in window
  windowSeconds: number;
}

async function pickNextIndex(): Promise<number> {
  // Atomic increment; wrap via modulo
  const counter = await kv.incr("google_key_pointer");
  const idx = ((counter - 1) % TOTAL_KEYS) + 1; // 1..TOTAL_KEYS
  console.log(`[Round-Robin] Counter=${counter}, Picked Key Index=${idx}`);
  return idx;
}

async function tryKey(index: number): Promise<SelectedKey | null> {
  const usageKey = `google_key_${index}_usage`;
  // Read current usage for logging
  const currentUsage = (await kv.get<number>(usageKey)) || 0;
  console.log(`[TryKey] Key${index} current usage=${currentUsage}`);

  // Increment usage atomically
  const usage = await kv.incr(usageKey);
  console.log(`[TryKey] Key${index} usage AFTER increment=${usage}`);

  if (usage === 1) {
    // First hit in window: set expiry
    await kv.expire(usageKey, WINDOW_SECONDS);
    console.log(`[TryKey] Key${index} first use in window, expiry set to ${WINDOW_SECONDS}s`);
  }

  if (usage > PER_KEY_LIMIT) {
    // Over limit: not usable
    console.log(`[TryKey] Key${index} exceeded limit (${PER_KEY_LIMIT}), skipping`);
    return null;
  }

  const apiKey = process.env[`GOOGLE_API_KEY${index}`];
  if (!apiKey) {
    console.log(`[TryKey] Key${index} missing in environment variables`);
    return null;
  }

  const remaining = Math.max(PER_KEY_LIMIT - usage, 0);
  console.log(`[TryKey] Key${index} remaining uses in this window=${remaining}`);

  return {
    apiKey,
    index,
    usage,
    remaining,
    windowSeconds: WINDOW_SECONDS,
  };
}

/**
 * Get an available API key using round-robin + per-key windowed limit.
 * Throws if all keys are currently exhausted.
 */
export async function getAvailableApiKey(): Promise<SelectedKey> {
  const tried: number[] = [];
  for (let attempt = 0; attempt < TOTAL_KEYS; attempt++) {
    const idx = await pickNextIndex();
    tried.push(idx);
    const selected = await tryKey(idx);
    if (selected) {
      console.log(`[getAvailableApiKey] Selected Key${selected.index} for request`);
      return selected;
    }
  }
  console.log(`[getAvailableApiKey] All keys exhausted in current window. Tried: ${tried.join(", ")}`);
  throw new Error(
    `All ${TOTAL_KEYS} keys exhausted in current ${WINDOW_SECONDS}s window (tried in order: ${tried.join(", ")})`
  );
}

/**
 * For debugging: returns snapshot of usage counts (best-effort).
 */
export async function getKeyStatus(): Promise<
  { index: number; usage: number; limit: number; remaining: number }[]
> {
  const statuses = [];
  for (let i = 1; i <= TOTAL_KEYS; i++) {
    const usage = (await kv.get<number>(`google_key_${i}_usage`)) || 0;
    statuses.push({
      index: i,
      usage,
      limit: PER_KEY_LIMIT,
      remaining: Math.max(PER_KEY_LIMIT - usage, 0),
    });
  }
  console.log(`[getKeyStatus] Current key status:`, statuses);
  return statuses;
}
