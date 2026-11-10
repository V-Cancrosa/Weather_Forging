import { MODULE_ID } from "../constants.mjs";

/** Region behavior type that turns a region into a no-weather zone. */
const SUPPRESS_BEHAVIOR = "suppressWeather";
/** Upper bound for mask resolution on each axis. */
const MAX_CELLS = 512;

/**
 * A low-resolution raster of the places where weather is switched off,
 * built from Regions that have an enabled "Suppress Weather" behavior.
 *
 * Particles query it on the CPU (isSuppressed) and the ground shader samples
 * it as a texture, so both agree exactly. Rebuilt lazily when regions change.
 */
export class WeatherMask {
  /** @type {PIXI.Texture|null} */
  texture = null;
  /** Mask rectangle in scene coordinates: x, y, width, height. */
  rect = new Float32Array([0, 0, 1, 1]);
  /** True when no region suppresses weather (fast path). */
  empty = true;

  #dirty = true;
  #data = null;
  #cols = 0;
  #rows = 0;
  #cell = 1;

  invalidate() {
    this.#dirty = true;
  }

  /** Rebuild if regions changed. Call once per frame before use. */
  update() {
    if (!this.#dirty || !canvas.scene) return;
    this.#dirty = false;
    try {
      this.#build();
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not build the weather mask from regions.`, err);
      this.empty = true;
    }
  }

  /** Is weather switched off at this scene point? */
  isSuppressed(x, y) {
    if (this.empty) return false;
    const c = Math.floor((x - this.rect[0]) / this.#cell);
    const r = Math.floor((y - this.rect[1]) / this.#cell);
    if (c < 0 || r < 0 || c >= this.#cols || r >= this.#rows) return false;
    return this.#data[(r * this.#cols + c) * 4] > 127;
  }

  destroy() {
    this.texture?.destroy(true);
    this.texture = null;
    this.#data = null;
    this.empty = true;
    this.#dirty = true;
  }

  static suppresses(region) {
    return region.behaviors?.some(b => b.type === SUPPRESS_BEHAVIOR && !b.disabled) ?? false;
  }

  #build() {
    const regions = canvas.scene.regions.filter(r => WeatherMask.suppresses(r));
    this.empty = regions.length === 0;
    if (this.empty) return;

    const { width, height } = canvas.dimensions;
    const cell = Math.max(8, canvas.dimensions.size / 4, width / MAX_CELLS, height / MAX_CELLS);
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const data = new Uint8Array(cols * rows * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;

    for (const region of regions) {
      const b = region.bounds;
      const elevation = region.clampElevation?.(0) ?? 0;
      const c0 = Math.max(0, Math.floor(b.x / cell));
      const c1 = Math.min(cols - 1, Math.floor((b.x + b.width) / cell));
      const r0 = Math.max(0, Math.floor(b.y / cell));
      const r1 = Math.min(rows - 1, Math.floor((b.y + b.height) / cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = (r * cols + c) * 4;
          if (data[i]) continue;
          const point = { x: (c + 0.5) * cell, y: (r + 0.5) * cell, elevation };
          if (region.testPoint(point)) data[i] = 255;
        }
      }
    }

    this.#data = data;
    this.#cols = cols;
    this.#rows = rows;
    this.#cell = cell;
    this.rect.set([0, 0, cols * cell, rows * cell]);
    this.texture?.destroy(true);
    this.texture = PIXI.Texture.fromBuffer(data, cols, rows);
  }
}
