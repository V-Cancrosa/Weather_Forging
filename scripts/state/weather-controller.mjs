import { DEFAULT_TRANSITION, FLAG_KEY, MODULE_ID } from "../constants.mjs";
import { CORE_WEATHER_MAP, PRESETS } from "./presets.mjs";
import { createTransition, normalizeState, resolveTransition } from "./weather-state.mjs";

/**
 * Owns the authoritative weather of each scene.
 *
 * The GM writes a transition record ({from, to, start, duration}) into a scene
 * flag. Every client resolves the current state from that record using the
 * shared server clock, so all clients see the same transition without any
 * socket traffic.
 */
export class WeatherController {
  /** Server-synchronized timestamp in ms. */
  static now() {
    return game.time?.serverTime ?? Date.now();
  }

  /**
   * The raw transition stored on a scene, or a synthesized one adopted from
   * the scene's core weather setting.
   * @param {Scene} scene
   */
  static getTransition(scene) {
    if (!scene) return null;
    const stored = scene.getFlag(MODULE_ID, FLAG_KEY);
    if (stored) return stored;
    const presetId = CORE_WEATHER_MAP[scene.weather];
    if (!presetId) return null;
    const state = PRESETS[presetId].state;
    return createTransition(state, state, { start: 0, duration: 0, preset: presetId });
  }

  /**
   * The weather as it is right now on a scene.
   * @param {Scene} [scene]
   * @returns {import("./weather-state.mjs").WeatherState}
   */
  static getCurrent(scene = canvas?.scene) {
    return resolveTransition(this.getTransition(scene), this.now());
  }

  /** The weather a scene is transitioning toward. */
  static getTarget(scene = canvas?.scene) {
    return normalizeState(this.getTransition(scene)?.to);
  }

  /** The preset id the scene is set to, if any. */
  static getPresetId(scene = canvas?.scene) {
    return this.getTransition(scene)?.preset ?? null;
  }

  /**
   * Change the weather of a scene. GM only.
   * @param {Scene} scene
   * @param {string|object} target  A preset id or a partial WeatherState.
   * @param {object} [options]
   * @param {number} [options.duration]  Transition length in seconds.
   */
  static async setWeather(scene, target, { duration = DEFAULT_TRANSITION } = {}) {
    if (!game.user.isGM) throw new Error(`${MODULE_ID} | Only a GM can change the weather.`);
    if (!scene) throw new Error(`${MODULE_ID} | No scene to apply weather to.`);

    let preset = null;
    let state = target;
    if (typeof target === "string") {
      if (!(target in PRESETS)) throw new Error(`${MODULE_ID} | Unknown weather preset "${target}".`);
      preset = target;
      state = PRESETS[target].state;
    }

    const transition = createTransition(this.getCurrent(scene), state, {
      start: this.now(),
      duration,
      preset
    });
    // A single update keeps all clients in sync. Every field of the transition is
    // always present, so merging into the old flag cannot leave stale values —
    // except removed `extensions` keys, which owners should null out explicitly.
    await scene.setFlag(MODULE_ID, FLAG_KEY, transition);
    return transition;
  }
}
