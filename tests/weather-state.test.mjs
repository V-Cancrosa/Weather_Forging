import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTransition, interpolateState, normalizeState, resolveTransition
} from "../scripts/state/weather-state.mjs";
import { GROUND_LAG } from "../scripts/constants.mjs";
import { PRESETS } from "../scripts/state/presets.mjs";

test("normalizeState fills defaults and clamps values", () => {
  const s = normalizeState({ precipitation: { rain: 2, snow: -1 }, fog: 5, wind: { direction: -90 } });
  assert.equal(s.precipitation.rain, 1);
  assert.equal(s.precipitation.snow, 0);
  assert.equal(s.precipitation.hail, 0);
  assert.equal(s.fog, 1);
  assert.equal(s.wind.direction, 270);
  assert.equal(s.temperature, 15);
});

test("every preset normalizes cleanly", () => {
  for (const [id, preset] of Object.entries(PRESETS)) {
    const s = normalizeState(preset.state);
    assert.ok(Number.isFinite(s.temperature), id);
  }
});

test("interpolation cross-fades precipitation types", () => {
  const rain = normalizeState(PRESETS.rain.state);
  const snow = normalizeState(PRESETS.snow.state);
  const mid = interpolateState(rain, snow, 0.5);
  assert.ok(mid.precipitation.rain > 0 && mid.precipitation.rain < rain.precipitation.rain);
  assert.ok(mid.precipitation.snow > 0 && mid.precipitation.snow < snow.precipitation.snow);
});

test("wind direction takes the shortest way around", () => {
  const a = normalizeState({ wind: { direction: 350 } });
  const b = normalizeState({ wind: { direction: 10 } });
  assert.equal(interpolateState(a, b, 0.5).wind.direction, 0);
});

test("ground cover lags behind the sky", () => {
  const tr = createTransition(PRESETS.clear.state, PRESETS.blizzard.state, { start: 0, duration: 10 });
  const atEnd = resolveTransition(tr, 10_000);
  assert.equal(atEnd.precipitation.snow, 1);
  assert.ok(atEnd.ground.snow < 0.2);
  const settled = resolveTransition(tr, 10_000 * GROUND_LAG);
  assert.equal(settled.ground.snow, 1);
});

test("missing or instant transitions resolve safely", () => {
  assert.equal(resolveTransition(null, 0).precipitation.rain, 0);
  const tr = createTransition({}, PRESETS.storm.state, { start: 0, duration: 0 });
  assert.equal(resolveTransition(tr, 0).lightning, 0.6);
});
