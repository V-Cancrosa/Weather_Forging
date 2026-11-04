import { MODULE_ID } from "../constants.mjs";
import { getSetting } from "../settings.mjs";
import { WeatherController } from "../state/weather-controller.mjs";

const UPDATE_INTERVAL = 100;
const clamp01 = v => Math.min(1, Math.max(0, v));

/**
 * Weather-reactive interface. Derives a handful of "mood" values from the
 * weather and exposes them as CSS custom properties on <html>; the stylesheet
 * turns those into overlays. We never restyle other modules' windows directly.
 */
export class UITheme {
  #overlay = null;
  #timer = null;
  #last = {};

  /** @param {import("../render/weather-renderer.mjs").WeatherRenderer} renderer */
  constructor(renderer) {
    this.renderer = renderer;
  }

  start() {
    this.#overlay = document.createElement("div");
    this.#overlay.id = `${MODULE_ID}-ui-overlay`;
    this.#overlay.setAttribute("aria-hidden", "true");
    document.body.append(this.#overlay);
    this.#timer = setInterval(() => this.update(), UPDATE_INTERVAL);
    this.update();
  }

  stop() {
    clearInterval(this.#timer);
    this.#overlay?.remove();
  }

  /** Map weather state to interface mood values (all 0–1). */
  static moodFor(state) {
    const cold = clamp01(-state.temperature / 15);
    return {
      frost: clamp01(state.ground.snow * 0.6 + cold * 0.5 + state.precipitation.snow * 0.3),
      wet: clamp01(state.precipitation.rain * 0.8 + state.ground.wetness * 0.2),
      gloom: clamp01(state.cloudCover * 0.6 + state.lightning * 0.4),
      fog: state.fog,
      ash: state.precipitation.ash
    };
  }

  update() {
    const enabled = getSetting("uiEffects") && !!canvas?.scene;
    document.documentElement.classList.toggle(`${MODULE_ID}-active`, enabled);
    if (!enabled) return;

    const mood = UITheme.moodFor(WeatherController.getCurrent(canvas.scene));
    mood.flash = this.renderer?.flashLevel ?? 0;
    const style = document.documentElement.style;
    for (const [key, value] of Object.entries(mood)) {
      if (Math.abs((this.#last[key] ?? -1) - value) < 0.005) continue;
      this.#last[key] = value;
      style.setProperty(`--wf-${key}`, value.toFixed(3));
    }
  }
}
