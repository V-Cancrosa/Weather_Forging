import { MODULE_ID } from "../constants.mjs";
import { getSetting } from "../settings.mjs";
import { getPreset } from "../state/preset-store.mjs";
import { WeatherController } from "../state/weather-controller.mjs";

const UPDATE_INTERVAL = 1000;
const DRAG_THRESHOLD = 4;

/** Pick an icon that matches the weather when no preset names it. */
export function iconFor(state) {
  const p = state.precipitation;
  if (state.lightning > 0.2) return "fa-solid fa-cloud-bolt";
  if (p.snow > 0.6 && state.wind.speed > 40) return "fa-solid fa-icicles";
  if (p.snow > 0.15) return "fa-solid fa-snowflake";
  if (p.ash > 0.15) return "fa-solid fa-volcano";
  if (p.rain > 0.45) return "fa-solid fa-cloud-showers-heavy";
  if (p.rain > 0.1) return "fa-solid fa-cloud-rain";
  if (state.fog > 0.4) return "fa-solid fa-smog";
  if (state.temperature < -2) return "fa-solid fa-temperature-low";
  if (state.cloudCover > 0.6) return "fa-solid fa-cloud";
  if (state.cloudCover > 0.25) return "fa-solid fa-cloud-sun";
  return "fa-solid fa-sun";
}

/** Small, draggable weather readout for every player. GMs click it to open the panel. */
export class WeatherWidget {
  #el = null;
  #timer = null;

  /** @param {() => void} onOpen  Called when a GM clicks the widget. */
  constructor(onOpen) {
    this.onOpen = onOpen;
  }

  start() {
    const el = document.createElement("aside");
    el.id = `${MODULE_ID}-widget`;
    el.innerHTML = `<i class="wf-icon"></i>
      <span class="wf-text"><strong class="wf-name"></strong><span class="wf-details"></span></span>`;
    document.body.append(el);
    this.#el = el;
    this.#restorePosition();
    this.#enableDrag();
    this.#timer = setInterval(() => this.update(), UPDATE_INTERVAL);
    this.update();
  }

  update() {
    const el = this.#el;
    if (!el) return;
    const visible = getSetting("showWidget") && !!canvas?.scene;
    el.hidden = !visible;
    if (!visible) return;

    const state = WeatherController.getCurrent(canvas.scene);
    const preset = getPreset(WeatherController.getPresetId(canvas.scene));
    const fahrenheit = getSetting("temperatureUnit") === "F";
    const temp = fahrenheit ? Math.round(state.temperature * 9 / 5 + 32) : Math.round(state.temperature);
    const wind = Math.round(state.wind.speed);

    el.querySelector(".wf-icon").className = `wf-icon ${preset?.icon ?? iconFor(state)}`;
    el.querySelector(".wf-name").textContent = preset?.label ?? game.i18n.localize("WEATHERFORGING.Widget.Custom");
    el.querySelector(".wf-details").innerHTML =
      `${temp}°${fahrenheit ? "F" : "C"} · <i class="fa-solid fa-location-arrow wf-wind" style="transform: rotate(${state.wind.direction - 45}deg)"></i> ${wind} km/h`;
    el.dataset.tooltip = game.user.isGM ? "WEATHERFORGING.Widget.OpenPanel" : "";
    el.classList.toggle("clickable", game.user.isGM);
  }

  #restorePosition() {
    const { left, top } = getSetting("widgetPosition") ?? {};
    if (Number.isFinite(left) && Number.isFinite(top)) {
      this.#el.style.left = `${Math.min(left, window.innerWidth - 60)}px`;
      this.#el.style.top = `${Math.min(top, window.innerHeight - 40)}px`;
    }
  }

  /** Drag anywhere; a click without movement opens the panel for GMs. */
  #enableDrag() {
    const el = this.#el;
    el.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const start = { x: event.clientX, y: event.clientY, left: el.offsetLeft, top: el.offsetTop };
      let dragging = false;
      const move = e => {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging = true;
        el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, start.left + dx))}px`;
        el.style.top = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, start.top + dy))}px`;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (dragging) game.settings.set(MODULE_ID, "widgetPosition", { left: el.offsetLeft, top: el.offsetTop });
        else if (game.user.isGM) this.onOpen();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }
}
