import { test } from "node:test";
import assert from "node:assert/strict";
import { hash01, lightningLevel } from "../scripts/state/lightning.mjs";

test("hash01 is deterministic and in [0, 1)", () => {
  for (let i = -1000; i < 1000; i++) {
    const h = hash01(i * 7919);
    assert.ok(h >= 0 && h < 1);
    assert.equal(h, hash01(i * 7919));
  }
});

test("no lightning means no flashes", () => {
  for (let t = 0; t < 60_000; t += 50) assert.equal(lightningLevel(t, 0), 0);
});

test("strike rate roughly matches the frequency", () => {
  // Count rising edges over 20 minutes of simulated time at full frequency.
  const start = 1_762_000_000_000;
  let strikes = 0;
  let prev = 0;
  for (let t = start; t < start + 1_200_000; t += 25) {
    const level = lightningLevel(t, 1, { flicker: false });
    if (level > 0.9 && prev <= 0.9) strikes++;
    prev = level;
  }
  // Expected 0.25 strikes/s → ~300 in 20 min.
  assert.ok(strikes > 200 && strikes < 400, `got ${strikes}`);
});

test("two clients at the same moment see the same flash", () => {
  const t = 1_762_000_123_456;
  assert.equal(lightningLevel(t, 0.6), lightningLevel(t, 0.6));
  for (let dt = 0; dt < 10_000; dt += 37) {
    const level = lightningLevel(t + dt, 0.6);
    assert.ok(level >= 0 && level <= 1);
  }
});
