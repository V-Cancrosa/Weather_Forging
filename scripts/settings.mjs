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

  game.settings.register(MODULE_ID, "indoorMasking", {
    name: "WEATHERFORGING.Settings.IndoorMasking.Name",
    hint: "WEATHERFORGING.Settings.IndoorMasking.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "affectDarkness", {
    name: "WEATHERFORGING.Settings.AffectDarkness.Name",
    hint: "WEATHERFORGING.Settings.AffectDarkness.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "customPresets", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
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

  game.settings.register(MODULE_ID, "showWidget", {
    name: "WEATHERFORGING.Settings.ShowWidget.Name",
    hint: "WEATHERFORGING.Settings.ShowWidget.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "temperatureUnit", {
    name: "WEATHERFORGING.Settings.TemperatureUnit.Name",
    scope: "client",
    config: true,
    type: String,
    choices: { C: "°C", F: "°F" },
    default: "C"
  });

  game.settings.register(MODULE_ID, "widgetPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, "lastWelcome", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
}

export const getSetting = key => game.settings.get(MODULE_ID, key);
