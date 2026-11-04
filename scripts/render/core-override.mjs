import { MODULE_ID } from "../constants.mjs";
import { getSetting } from "../settings.mjs";

/**
 * Silence Foundry's built-in weather so Weather Forging is the only renderer.
 * The core layer itself stays alive (we draw inside it), only its effects are
 * suppressed. Scenes that had core weather set are adopted by the controller.
 */
export function patchCoreWeather() {
  if (!getSetting("replaceCoreWeather")) return;
  const WeatherEffects = foundry.canvas.layers.WeatherEffects;
  const original = WeatherEffects.prototype.initializeEffects;
  WeatherEffects.prototype.initializeEffects = function (_config) {
    return original.call(this, null);
  };
  console.log(`${MODULE_ID} | Core weather effects replaced.`);
}
