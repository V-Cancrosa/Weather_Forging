import { FLAG_KEY, MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { patchCoreWeather } from "./render/core-override.mjs";
import { WeatherRenderer } from "./render/weather-renderer.mjs";
import { GroundRenderer } from "./render/ground-renderer.mjs";
import { WeatherMask } from "./render/weather-mask.mjs";
import { SceneLighting } from "./render/scene-lighting.mjs";
import { UITheme } from "./ui/ui-theme.mjs";
import { WeatherPanel } from "./apps/weather-panel.mjs";
import { PresetEditor } from "./apps/preset-editor.mjs";
import { WelcomeWindow } from "./apps/welcome.mjs";
import { WeatherWidget } from "./ui/weather-widget.mjs";
import { WeatherController } from "./state/weather-controller.mjs";
import { getAllPresets } from "./state/preset-store.mjs";

const mask = new WeatherMask();
const lighting = new SceneLighting();
const renderer = new WeatherRenderer(mask, lighting);
const ground = new GroundRenderer(mask);
const uiTheme = new UITheme(renderer);
const widget = new WeatherWidget(() => WeatherPanel.open());

Hooks.once("init", () => {
  registerSettings();
  game.settings.registerMenu(MODULE_ID, "welcome", {
    name: "WEATHERFORGING.Welcome.Title",
    label: "WEATHERFORGING.Welcome.MenuLabel",
    icon: "fa-solid fa-cloud-sun-rain",
    type: WelcomeWindow,
    restricted: false
  });
  patchCoreWeather();

  // Early, unstable API — will be formalized in a later stage.
  game.modules.get(MODULE_ID).api = {
    getWeather: scene => WeatherController.getCurrent(scene),
    getTarget: scene => WeatherController.getTarget(scene),
    setWeather: (scene, target, options) => WeatherController.setWeather(scene, target, options),
    get presets() { return getAllPresets(); },
    openPanel: () => WeatherPanel.open(),
    openEditor: () => PresetEditor.open(),
    openWelcome: () => new WelcomeWindow().render({ force: true }),
    diagnose
  };
});

Hooks.once("ready", () => {
  uiTheme.start();
  widget.start();
  WelcomeWindow.showIfNew();
});

// Refresh the panel when custom presets change (on every GM client).
Hooks.on("updateSetting", setting => {
  if (setting.key === `${MODULE_ID}.customPresets`) WeatherPanel.refresh();
});
Hooks.on("createSetting", setting => {
  if (setting.key === `${MODULE_ID}.customPresets`) WeatherPanel.refresh();
});

/** Print what Weather Forging sees on this client — handy when reporting problems. */
function diagnose() {
  const report = {
    foundry: game.version,
    module: game.modules.get(MODULE_ID).version,
    scene: canvas?.scene?.name ?? null,
    preset: WeatherController.getPresetId(canvas?.scene),
    weatherLayer: !!canvas?.weather,
    particlesAttached: !!renderer.container,
    indoorMasking: !!renderer.occlusionFilter,
    groundCover: ground.stats,
    noWeatherRegions: canvas?.scene?.regions.filter(r => WeatherMask.suppresses(r)).length ?? 0,
    darknessLinked: game.settings.get(MODULE_ID, "affectDarkness"),
    darknessLevel: canvas?.environment?.darknessLevel,
    state: WeatherController.getCurrent(canvas?.scene)
  };
  console.log(`${MODULE_ID} | Diagnostics`, report);
  return report;
}

Hooks.on("canvasReady", () => {
  mask.invalidate();
  renderer.attach();
  ground.attach(renderer.occlusionFilter);
  WeatherPanel.refresh();
});
Hooks.on("canvasTearDown", () => {
  ground.detach();
  renderer.detach();
  mask.destroy();
});

// Rebuild the no-weather mask whenever regions or their behaviors change.
for (const hook of ["createRegion", "updateRegion", "deleteRegion",
  "createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
  Hooks.on(hook, () => mask.invalidate());
}

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
