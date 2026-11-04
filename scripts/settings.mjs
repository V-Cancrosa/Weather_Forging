import { MODULE_ID } from "./constants.mjs";

/** Particle budget multiplier per quality level. */
export const QUALITY_FACTORS = Object.freeze({ low: 0.25, medium: 0.5, high: 0.8, ultra: 1 });

export function registerSettings() {
  game.settings.register(MODULE_ID, "replaceCoreWeather", {
    name: "WEATHERFORGING.Settings.ReplaceCore.Name",
    hint: "WEATHERFORGING.Settings.ReplaceCore.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "quality", {
    name: "WEATHERFORGING.Settings.Quality.Name",
    hint: "WEATHERFORGING.Settings.Quality.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      low: "WEATHERFORGING.Settings.Quality.Low",
      medium: "WEATHERFORGING.Settings.Quality.Medium",
      high: "WEATHERFORGING.Settings.Quality.High",
      ultra: "WEATHERFORGING.Settings.Quality.Ultra"
    },
    default: "high"
  });

  game.settings.register(MODULE_ID, "uiEffects", {
    name: "WEATHERFORGING.Settings.UIEffects.Name",
    hint: "WEATHERFORGING.Settings.UIEffects.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "reduceMotion", {
    name: "WEATHERFORGING.Settings.ReduceMotion.Name",
    hint: "WEATHERFORGING.Settings.ReduceMotion.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

export const getSetting = key => game.settings.get(MODULE_ID, key);
