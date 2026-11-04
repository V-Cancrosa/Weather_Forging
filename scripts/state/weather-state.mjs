/**
 * Pure weather state model. No Foundry globals here, so it can be unit-tested in Node.
 *
 * Precipitation is a *mix* of intensities rather than a single type, which lets
 * transitions cross-fade naturally (rain → sleet → snow) and allows mixed weather.
 *
 * Wind direction is the direction the wind blows TOWARD, in degrees clockwise
 * from canvas east (+x). 90° = toward canvas south (+y).
 */

import { GROUND_LAG } from "../constants.mjs";

export const PRECIPITATION_TYPES = Object.freeze(["rain", "snow", "hail", "ash"]);

const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));
const finite = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const normAngle = deg => ((finite(deg, 0) % 360) + 360) % 360;
const lerp = (a, b, t) => a + (b - a) * t;

function lerpAngle(a, b, t) {
  const delta = ((b - a + 540) % 360) - 180;
  return normAngle(a + delta * t);
}

/** Smoothstep easing for transitions. */
export const ease = t => t * t * (3 - 2 * t);

/**
 * Build a complete, clamped weather state from partial data.
 * @param {object} [data]
 * @returns {WeatherState}
 */
export function normalizeState(data = {}) {
  const p = data.precipitation ?? {};
  return {
    precipitation: Object.fromEntries(PRECIPITATION_TYPES.map(t => [t, clamp01(p[t])])),
    wind: {
      speed: Math.max(0, finite(data.wind?.speed, 0)),
      direction: normAngle(data.wind?.direction ?? 20),
      gusts: clamp01(data.wind?.gusts)
    },
    temperature: finite(data.temperature, 15),
    cloudCover: clamp01(data.cloudCover),
    fog: clamp01(data.fog),
    lightning: clamp01(data.lightning),
    ground: {
      snow: clamp01(data.ground?.snow),
      wetness: clamp01(data.ground?.wetness)
    },
    extensions: structuredClone(data.extensions ?? {})
  };
}

/**
 * Interpolate between two normalized states.
 * @param {WeatherState} from
 * @param {WeatherState} to
 * @param {number} t        Sky progress, 0–1.
 * @param {number} [groundT] Ground cover progress, 0–1 (defaults to t).
 * @returns {WeatherState}
 */
export function interpolateState(from, to, t, groundT = t) {
  return {
    precipitation: Object.fromEntries(PRECIPITATION_TYPES.map(k => [
      k, lerp(from.precipitation[k], to.precipitation[k], t)
    ])),
    wind: {
      speed: lerp(from.wind.speed, to.wind.speed, t),
      direction: lerpAngle(from.wind.direction, to.wind.direction, t),
      gusts: lerp(from.wind.gusts, to.wind.gusts, t)
    },
    temperature: lerp(from.temperature, to.temperature, t),
    cloudCover: lerp(from.cloudCover, to.cloudCover, t),
    fog: lerp(from.fog, to.fog, t),
    lightning: lerp(from.lightning, to.lightning, t),
    ground: {
      snow: lerp(from.ground.snow, to.ground.snow, groundT),
      wetness: lerp(from.ground.wetness, to.ground.wetness, groundT)
    },
    extensions: structuredClone(t < 1 ? from.extensions : to.extensions)
  };
}

/**
 * Create a transition record (what gets stored in the scene flag).
 * @param {WeatherState} from
 * @param {object} to         Partial target state.
 * @param {object} options
 * @param {number} options.start     Server timestamp (ms).
 * @param {number} options.duration  Seconds.
 * @param {string|null} [options.preset]
 */
export function createTransition(from, to, { start, duration, preset = null }) {
  return {
    from: normalizeState(from),
    to: normalizeState(to),
    start,
    duration: Math.max(0, finite(duration, 0)),
    preset
  };
}

/**
 * Resolve the weather state at a given moment of a transition.
 * @param {object|null|undefined} transition
 * @param {number} now  Server timestamp (ms).
 * @returns {WeatherState}
 */
export function resolveTransition(transition, now) {
  if (!transition?.to) return normalizeState({});
  const from = normalizeState(transition.from);
  const to = normalizeState(transition.to);
  const ms = (transition.duration ?? 0) * 1000;
  if (ms <= 0) return to;
  const elapsed = Math.max(0, now - (transition.start ?? 0));
  const t = ease(Math.min(1, elapsed / ms));
  const groundT = ease(Math.min(1, elapsed / (ms * GROUND_LAG)));
  return interpolateState(from, to, t, groundT);
}

/**
 * @typedef {object} WeatherState
 * @property {Record<string, number>} precipitation  Intensity 0–1 per type.
 * @property {{speed: number, direction: number, gusts: number}} wind  km/h, degrees, 0–1.
 * @property {number} temperature  °C
 * @property {number} cloudCover   0–1
 * @property {number} fog          0–1
 * @property {number} lightning    0–1, strike frequency
 * @property {{snow: number, wetness: number}} ground  Accumulated cover, 0–1.
 * @property {object} extensions   Free-form data owned by systems/modules.
 */
