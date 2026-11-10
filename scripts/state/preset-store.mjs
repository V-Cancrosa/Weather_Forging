import { MODULE_ID } from "../constants.mjs";
import { PRESETS } from "./presets.mjs";
import { normalizeState } from "./weather-state.mjs";

export const CUSTOM_ICON = "fa-solid fa-sliders";
const CUSTOM_PREFIX = "custom-";

/** Custom presets saved by the GM: { id: { label, icon, state } }. */
export function getCustomPresets() {
  return game.settings.get(MODULE_ID, "customPresets") ?? {};
}

/** Built-in and custom presets, with display labels. */
export function getAllPresets() {
  const all = {};
  for (const [id, preset] of Object.entries(PRESETS)) {
    all[id] = { ...preset, builtin: true, label: game.i18n.localize(`WEATHERFORGING.Presets.${id}`) };
  }
  for (const [id, preset] of Object.entries(getCustomPresets())) {
    all[id] = { icon: preset.icon || CUSTOM_ICON, state: preset.state, label: preset.label, builtin: false };
  }
  return all;
}

export function getPreset(id) {
  return id ? getAllPresets()[id] ?? null : null;
}

function slugify(text) {
  const slug = String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || foundry.utils.randomID(8);
}

/**
 * Save a custom preset (overwrites one with the same name). GM only.
 * @returns {Promise<string>} The preset id.
 */
export async function saveCustomPreset(label, state) {
  const name = String(label).trim();
  if (!name) throw new Error(game.i18n.localize("WEATHERFORGING.Editor.NameRequired"));
  const id = CUSTOM_PREFIX + slugify(name);
  const presets = foundry.utils.deepClone(getCustomPresets());
  presets[id] = { label: name, icon: CUSTOM_ICON, state: normalizeState(state) };
  await game.settings.set(MODULE_ID, "customPresets", presets);
  return id;
}

export async function deleteCustomPreset(id) {
  const presets = foundry.utils.deepClone(getCustomPresets());
  delete presets[id];
  await game.settings.set(MODULE_ID, "customPresets", presets);
}
