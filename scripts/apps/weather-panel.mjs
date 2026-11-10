import { DEFAULT_TRANSITION, MODULE_ID } from "../constants.mjs";
import { getAllPresets } from "../state/preset-store.mjs";
import { PresetEditor } from "./preset-editor.mjs";
import { WeatherController } from "../state/weather-controller.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM control panel: pick a preset and how long the transition should take. */
export class WeatherPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-panel`,
    classes: [MODULE_ID],
    window: {
      title: "WEATHERFORGING.Panel.Title",
      icon: "fa-solid fa-cloud-sun-rain"
    },
    position: { width: 380, height: "auto" },
    actions: {
      applyPreset: WeatherPanel.#onApplyPreset,
      openEditor: () => PresetEditor.open()
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/weather-panel.hbs` }
  };

  /** @type {WeatherPanel|null} */
  static #instance = null;

  static open() {
    this.#instance ??= new WeatherPanel();
    return this.#instance.render({ force: true });
  }

  static refresh() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  duration = DEFAULT_TRANSITION;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const active = WeatherController.getPresetId(canvas?.scene);
    return Object.assign(context, {
      sceneName: canvas?.scene?.name ?? "—",
      duration: this.duration,
      presets: Object.entries(getAllPresets()).map(([id, preset]) => ({
        id,
        icon: preset.icon,
        label: preset.label,
        custom: !preset.builtin,
        active: id === active
      }))
    });
  }

  static async #onApplyPreset(_event, target) {
    const input = this.element.querySelector("input[name=duration]");
    this.duration = Math.max(0, Number(input?.value) || 0);
    try {
      await WeatherController.setWeather(canvas.scene, target.dataset.preset, { duration: this.duration });
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }
}
