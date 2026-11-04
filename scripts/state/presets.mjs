/**
 * Built-in weather presets. Each `state` is a partial WeatherState; missing
 * fields fall back to defaults in normalizeState().
 */
export const PRESETS = Object.freeze({
  clear: {
    icon: "fa-solid fa-sun",
    state: { temperature: 18, cloudCover: 0.05, wind: { speed: 5 } }
  },
  overcast: {
    icon: "fa-solid fa-cloud",
    state: { temperature: 12, cloudCover: 0.8, wind: { speed: 12 } }
  },
  drizzle: {
    icon: "fa-solid fa-cloud-rain",
    state: {
      temperature: 11, cloudCover: 0.8, fog: 0.1, wind: { speed: 8 },
      precipitation: { rain: 0.25 }, ground: { wetness: 0.4 }
    }
  },
  rain: {
    icon: "fa-solid fa-cloud-showers-heavy",
    state: {
      temperature: 10, cloudCover: 0.9, fog: 0.1, wind: { speed: 18, gusts: 0.2 },
      precipitation: { rain: 0.6 }, ground: { wetness: 0.8 }
    }
  },
  storm: {
    icon: "fa-solid fa-cloud-bolt",
    state: {
      temperature: 9, cloudCover: 1, fog: 0.15, lightning: 0.6,
      wind: { speed: 55, gusts: 0.7 },
      precipitation: { rain: 1 }, ground: { wetness: 1 }
    }
  },
  sleet: {
    icon: "fa-solid fa-cloud-meatball",
    state: {
      temperature: 0, cloudCover: 0.9, wind: { speed: 20, gusts: 0.3 },
      precipitation: { rain: 0.4, snow: 0.35 }, ground: { wetness: 0.7, snow: 0.15 }
    }
  },
  snow: {
    icon: "fa-solid fa-snowflake",
    state: {
      temperature: -3, cloudCover: 0.85, wind: { speed: 10 },
      precipitation: { snow: 0.55 }, ground: { snow: 0.6 }
    }
  },
  blizzard: {
    icon: "fa-solid fa-icicles",
    state: {
      temperature: -15, cloudCover: 1, fog: 0.45, wind: { speed: 70, gusts: 0.8 },
      precipitation: { snow: 1 }, ground: { snow: 1 }
    }
  },
  frost: {
    icon: "fa-solid fa-temperature-low",
    state: { temperature: -8, cloudCover: 0.2, fog: 0.1, wind: { speed: 4 }, ground: { snow: 0.12 } }
  },
  fog: {
    icon: "fa-solid fa-smog",
    state: { temperature: 6, cloudCover: 0.6, fog: 0.8, wind: { speed: 2 }, ground: { wetness: 0.3 } }
  },
  ashfall: {
    icon: "fa-solid fa-volcano",
    state: {
      temperature: 20, cloudCover: 0.9, fog: 0.25, wind: { speed: 10 },
      precipitation: { ash: 0.6 }
    }
  }
});

/**
 * Core Foundry weather ids mapped to our presets, used to adopt the weather of
 * scenes configured before this module was enabled.
 */
export const CORE_WEATHER_MAP = Object.freeze({
  leaves: "clear",
  rain: "rain",
  rainStorm: "storm",
  fog: "fog",
  snow: "snow",
  blizzard: "blizzard"
});
