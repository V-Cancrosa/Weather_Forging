import { MODULE_ID } from "../constants.mjs";
import { getSetting } from "../settings.mjs";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Ties the weather into Foundry's own lighting, client-side only (the scene
 * document is never changed): clouds, rain and fog darken the scene so light
 * sources matter, and lightning briefly lights it up for real.
 */
export class SceneLighting {
  #applied = 0;

  constructor() {
    Hooks.on("configureCanvasEnvironment", config => this.#configure(config));
  }

  #configure(config) {
    if (!this.#applied) return;
    config.environment ??= {};
    const base = config.environment.darknessLevel ?? canvas.scene?.environment?.darknessLevel ?? 0;
    config.environment.darknessLevel = clamp(base + this.#applied, 0, 1);
  }

  /** How much darker the weather makes the scene. */
  static gloomFor(state) {
    const precip = Math.max(...Object.values(state.precipitation));
    return Math.min(0.35, state.cloudCover * 0.15 + state.lightning * 0.08 + state.fog * 0.06 + precip * 0.08);
  }

  /**
   * @param {object} state   Current weather state.
   * @param {number} flash   Lightning level 0–1.
   */
  update(state, flash) {
    if (!canvas.environment || !getSetting("affectDarkness")) return this.reset();
    const strength = getSetting("reduceMotion") ? 0.3 : 1;
    // Quantized so a strike costs only a few lighting refreshes.
    const flashStep = flash >= 0.5 ? 0.7 : flash >= 0.15 ? 0.3 : 0;
    const target = SceneLighting.gloomFor(state) - flashStep * strength;
    if (Math.abs(target - this.#applied) < 0.02) return;
    this.#apply(target);
  }

  reset() {
    if (this.#applied) this.#apply(0);
  }

  #apply(value) {
    this.#applied = value;
    try {
      canvas.environment.initialize();
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not update scene lighting.`, err);
    }
  }
}
