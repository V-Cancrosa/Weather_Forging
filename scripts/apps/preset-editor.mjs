import { DEFAULT_TRANSITION, MODULE_ID } from "../constants.mjs";
import { deleteCustomPreset, getAllPresets, getPreset, saveCustomPreset } from "../state/preset-store.mjs";
import { WeatherController } from "../state/weather-controller.mjs";
import { normalizeState } from "../state/weather-state.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Every editable weather parameter, grouped for the form. */
const GROUPS = [
  { id: "precipitation", fields: [
    { key: "precipitation.rain", min: 0, max: 1, step: 0.05 },
    { key: "precipitation.snow", min: 0, max: 1, step: 0.05 },
    { key: "precipitation.hail", min: 0, max: 1, step: 0.05 },
    { key: "precipitation.ash", min: 0, max: 1, step: 0.05 }
  ] },
  { id: "wind", fields: [
    { key: "wind.speed", min: 0, max: 120, step: 1, unit: "km/h" },
    { key: "wind.direction", min: 0, max: 355, step: 5, unit: "°" },
    { key: "wind.gusts", min: 0, max: 1, step: 0.05 }
  ] },
  { id: "sky", fields: [
    { key: "temperature", min: -40, max: 50, step: 1, unit: "°C" },
    { key: "cloudCover", min: 0, max: 1, step: 0.05 },
    { key: "fog", min: 0, max: 1, step: 0.05 },
    { key: "lightning", min: 0, max: 1, step: 0.05 }
  ] },
  { id: "ground", fields: [
    { key: "ground.snow", min: 0, max: 1, step: 0.05 },
    { key: "ground.wetness", min: 0, max: 1, step: 0.05 }
  ] }
];

const fieldLabel = key => `WEATHERFORGING.Fields.${key.replace(".", "_")}`;
const formatValue = (value, field) => (field.unit ? `${Math.round(value)} ${field.unit}` : `${Math.round(value * 100)}%`);

/** GM tool: tune every weather parameter, apply it live and save it as a preset. */
export class PresetEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-editor`,
    classes: [MODULE_ID, "wf-editor-app"],
    window: { title: "WEATHERFORGING.Editor.Title", icon: "fa-solid fa-sliders" },
    position: { width: 460, height: "auto" },
    actions: {
      apply: PresetEditor.#onApply,
      save: PresetEditor.#onSave,
      delete: PresetEditor.#onDelete
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/preset-editor.hbs` }
  };

  /** @type {PresetEditor|null} */
  static #instance = null;

  static open() {
    this.#instance ??= new PresetEditor();
    this.#instance.state = normalizeState(WeatherController.getTarget(canvas?.scene));
    this.#instance.presetId = WeatherController.getPresetId(canvas?.scene);
    return this.#instance.render({ force: true });
  }

  state = normalizeState({});
  presetId = null;
  duration = DEFAULT_TRANSITION;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const presets = getAllPresets();
    const current = getPreset(this.presetId);
    return Object.assign(context, {
      duration: this.duration,
      name: current && !current.builtin ? current.label : "",
      canDelete: !!current && !current.builtin,
      presets: Object.entries(presets).map(([id, p]) => ({ id, label: p.label, selected: id === this.presetId })),
      groups: GROUPS.map(group => ({
        label: `WEATHERFORGING.Editor.Groups.${group.id}`,
        fields: group.fields.map(field => {
          const value = foundry.utils.getProperty(this.state, field.key);
          return { ...field, label: fieldLabel(field.key), value, display: formatValue(value, field) };
        })
      }))
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const fields = GROUPS.flatMap(g => g.fields);
    for (const input of this.element.querySelectorAll("input[type=range]")) {
      const field = fields.find(f => f.key === input.name);
      input.addEventListener("input", () => {
        const value = Number(input.value);
        foundry.utils.setProperty(this.state, field.key, value);
        input.closest(".wf-field").querySelector("output").textContent = formatValue(value, field);
      });
    }
    this.element.querySelector("select[name=load]")?.addEventListener("change", event => {
      const id = event.target.value;
      const preset = getPreset(id);
      if (!preset) return;
      this.presetId = id;
      this.state = normalizeState(preset.state);
      this.render();
    });
  }

  #readDuration() {
    const input = this.element.querySelector("input[name=duration]");
    this.duration = Math.max(0, Number(input?.value) || 0);
    return this.duration;
  }

  static async #onApply() {
    try {
      await WeatherController.setWeather(canvas.scene, this.state, { duration: this.#readDuration() });
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static async #onSave() {
    const name = this.element.querySelector("input[name=name]")?.value ?? "";
    try {
      this.presetId = await saveCustomPreset(name, this.state);
      ui.notifications.info(game.i18n.format("WEATHERFORGING.Editor.Saved", { name }));
      this.render();
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static async #onDelete() {
    const preset = getPreset(this.presetId);
    if (!preset || preset.builtin) return;
    await deleteCustomPreset(this.presetId);
    ui.notifications.info(game.i18n.format("WEATHERFORGING.Editor.Deleted", { name: preset.label }));
    this.presetId = null;
    this.render();
  }
}
