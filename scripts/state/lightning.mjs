/**
 * Deterministic lightning schedule. Every client derives strikes from the
 * shared server clock, so all players see the same flash at the same moment
 * without any network traffic. Pure: no Foundry globals.
 */

const SLOT_MS = 250;
/** Strikes per second at lightning frequency 1. */
const STRIKES_PER_SECOND = 0.25;
const FLASH_DECAY = 4;          // flash fades over 1/4 s
const LOOKBACK_SLOTS = 3;

/** Integer hash → [0, 1). Same result in every JS engine. */
export function hash01(n) {
  let x = (Math.floor(n) | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Flash intensity at a moment in time.
 * @param {number} now        Server timestamp in ms.
 * @param {number} frequency  Lightning frequency 0–1 from the weather state.
 * @param {object} [options]
 * @param {boolean} [options.flicker=true]  Allow the quick second flicker.
 * @returns {number} 0–1
 */
export function lightningLevel(now, frequency, { flicker = true } = {}) {
  if (!(frequency > 0)) return 0;
  const chance = frequency * STRIKES_PER_SECOND * (SLOT_MS / 1000);
  const slot = Math.floor(now / SLOT_MS);
  let level = 0;
  for (let s = slot - LOOKBACK_SLOTS; s <= slot; s++) {
    if (hash01(s * 3) >= chance) continue;
    const t = (now - s * SLOT_MS) / 1000;
    level = Math.max(level, 1 - t * FLASH_DECAY);
    if (flicker && hash01(s * 3 + 1) < 0.6) {
      const delay = 0.12 + hash01(s * 3 + 2) * 0.1;
      if (t >= delay) level = Math.max(level, 0.8 - (t - delay) * FLASH_DECAY);
    }
  }
  return Math.max(0, Math.min(1, level));
}
