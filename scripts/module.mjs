import { FLAG_KEY, MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { patchCoreWeather } from "./render/core-override.mjs";
import { WeatherRenderer } from "./render/weather-renderer.mjs";
import { GroundRenderer } from "./render/ground-renderer.mjs";
import { UITheme } from "./ui/ui-theme.mjs";
import { WeatherPanel } from "./apps/weather-panel.mjs";
import { WeatherController } from "./state/weather-controller.mjs";
import { PRESETS } from "./state/presets.mjs";

const renderer = new WeatherRenderer();
const ground = new GroundRenderer();
const uiTheme = new UITheme(renderer);

Hooks.once("init", () => {
  registerSettings();
  patchCoreWeather();

  // Early, unstable API — will be formalized in a later stage.
  game.modules.get(MODULE_ID).api = {
    getWeather: scene => WeatherController.getCurrent(scene),
    getTarget: scene => WeatherController.getTarget(scene),
    setWeather: (scene, target, options) => WeatherController.setWeather(scene, target, options),
    presets: PRESETS,
    openPanel: () => WeatherPanel.open()
  };
});

Hooks.once("ready", () => uiTheme.start());

Hooks.on("canvasReady", () => {
  renderer.attach();
  ground.attach(renderer.occlusionFilter);
  WeatherPanel.refresh();
});
Hooks.on("canvasTearDown", () => {
  ground.detach();
  renderer.detach();
});

Hooks.on("updateScene", (scene, changes) => {
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.${FLAG_KEY}`)) return;
  const transition = WeatherController.getTransition(scene);
  /**
   * Fired on every client when a scene's weather changes.
   * @param {Scene} scene
   * @param {object} target      The weather being transitioned to.
   * @param {object} transition  The full transition record.
   */
  Hooks.callAll(`${MODULE_ID}.changed`, scene, WeatherController.getTarget(scene), transition);
  if (scene === canvas?.scene) WeatherPanel.refresh();
});

Hooks.on("getSceneControlButtons", controls => {
  const lighting = controls.lighting;
  if (!lighting?.tools || !game.user.isGM) return;
  lighting.tools.weatherForging = {
    name: "weatherForging",
    title: "WEATHERFORGING.Controls.Panel",
    icon: "fa-solid fa-cloud-sun-rain",
    order: Object.keys(lighting.tools).length,
    button: true,
    visible: true,
    onChange: () => WeatherPanel.open()
  };
});
