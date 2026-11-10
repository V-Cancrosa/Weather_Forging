import { MODULE_ID } from "../constants.mjs";
import { WeatherController } from "../state/weather-controller.mjs";
import { GROUND_FRAGMENT, GROUND_VERTEX } from "./shaders/ground.mjs";

/** Just above the scene background, below tiles: used for overlay mode. */
const OVERLAY_SORT_LAYER = 1;
/** How often (seconds) to look for added or removed tiles. */
const RESCAN_INTERVAL = 0.5;

/**
 * Ground cover: snow and wetness painted onto the map itself.
 *
 * Every ground texture of the scene (background, v14 level textures and tiles)
 * gets a twin mesh sorted right above it in the primary canvas group. The twin
 * samples the same texture and re-renders it with weather applied, so it is
 * lit, sorted and transformed exactly like what lies underneath. Roof tiles get
 * snowy too, and their snow fades away together with the roof.
 * Without a background image, a transparent overlay covers the bare scene.
 */
export class GroundRenderer {
  /** @type {Map<object, {source: object|null, mesh: PIXI.Mesh, texture: PIXI.Texture|null}>} */
  #twins = new Map();
  #overlay = null;
  #occlusionFilter = null;
  #time = 0;
  #rescan = 0;

  /** @param {import("./weather-mask.mjs").WeatherMask} mask */
  constructor(mask) {
    this.mask = mask;
  }

  /** Counts for diagnostics. */
  get stats() {
    const sources = [...this.#twins.keys()];
    return {
      background: sources.includes(canvas.primary?.background),
      tiles: sources.filter(s => canvas.primary?.tiles && [...canvas.primary.tiles.values()].includes(s)).length,
      total: this.#twins.size,
      overlay: !!this.#overlay
    };
  }

  /** @param {PIXI.Filter|null} occlusionFilter  Hides cover under faded roofs. */
  attach(occlusionFilter = null) {
    this.detach();
    if (!canvas.primary) return;
    this.#occlusionFilter = occlusionFilter;
    try {
      this.#syncSources();
      canvas.app.ticker.add(this.#tick, this);
    } catch (err) {
      console.warn(`${MODULE_ID} | Ground cover disabled for this scene.`, err);
      this.detach();
    }
  }

  detach() {
    canvas.app?.ticker?.remove(this.#tick, this);
    for (const twin of this.#twins.values()) this.#destroyTwin(twin);
    if (this.#overlay) this.#destroyTwin(this.#overlay);
    this.#twins.clear();
    this.#overlay = null;
  }

  /** Ground textures currently in the scene. */
  #currentSources() {
    const primary = canvas.primary;
    const sources = [primary.background, ...(primary.levelTextures ?? []), ...(primary.tiles?.values() ?? [])];
    return sources.filter(s => s && !s.destroyed && s.texture?.valid && s.texture !== PIXI.Texture.EMPTY);
  }

  /** Create twins for new sources, drop twins whose source is gone. */
  #syncSources() {
    const sources = new Set(this.#currentSources());
    let changed = false;
    for (const [source, twin] of this.#twins) {
      if (sources.has(source)) continue;
      this.#destroyTwin(twin);
      this.#twins.delete(source);
    }
    for (const source of sources) {
      if (this.#twins.has(source)) continue;
      const twin = this.#createTwin(source);
      this.#twins.set(source, twin);
      canvas.primary.addChild(twin.mesh);
      changed = true;
    }
    const hasBackground = sources.has(canvas.primary.background);
    if (!hasBackground && !this.#overlay) {
      this.#overlay = this.#createTwin(null);
      canvas.primary.addChild(this.#overlay.mesh);
      changed = true;
    } else if (hasBackground && this.#overlay) {
      this.#destroyTwin(this.#overlay);
      this.#overlay = null;
    }
    if (changed) canvas.primary.sortDirty = true;
  }

  #createTwin(source) {
    const shader = PIXI.Shader.from(GROUND_VERTEX, GROUND_FRAGMENT, {
      uSampler: PIXI.Texture.WHITE,
      uHasBase: 0,
      uSnow: 0,
      uWet: 0,
      uRain: 0,
      uTime: 0,
      uGrid: canvas.dimensions.size,
      uEdgeStep: new Float32Array([0.001, 0.001]),
      uAlpha: 1,
      uLocal: new PIXI.Matrix().toArray(true),
      uMask: PIXI.Texture.WHITE,
      uMaskRect: new Float32Array([0, 0, 1, 1]),
      uHasMask: 0
    });
    const mesh = new PIXI.Mesh(new PIXI.Geometry(), shader);
    mesh.name = `${MODULE_ID}-ground`;
    mesh.eventMode = "none";
    mesh.visible = false;
    if (this.#occlusionFilter) mesh.filters = [this.#occlusionFilter];
    const twin = { source, mesh, texture: null };

    if (!source) {
      const { sceneRect } = canvas.dimensions;
      this.#setGeometry(mesh, sceneRect.width, sceneRect.height, 0, 0, null);
      mesh.position.set(sceneRect.x, sceneRect.y);
      mesh.elevation = canvas.primary.background?.elevation ?? 0;
      mesh.sortLayer = OVERLAY_SORT_LAYER;
      mesh.sort = 0;
    }
    return twin;
  }

  #destroyTwin({ mesh }) {
    if (!mesh.destroyed) mesh.destroy();
  }

  /** Build a quad of the given size, with UVs from the texture frame. */
  #setGeometry(mesh, width, height, anchorX, anchorY, texture) {
    const x0 = -anchorX * width;
    const y0 = -anchorY * height;
    const uv = texture?._uvs;
    const uvs = uv ? [uv.x0, uv.y0, uv.x1, uv.y1, uv.x2, uv.y2, uv.x3, uv.y3] : [0, 0, 1, 0, 1, 1, 0, 1];
    mesh.geometry = new PIXI.Geometry() // the setter releases the previous geometry
      .addAttribute("aVertexPosition", [x0, y0, x0 + width, y0, x0 + width, y0 + height, x0, y0 + height], 2)
      .addAttribute("aUvs", uvs, 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
  }

  /**
   * Keep a twin glued to its source: texture, transform, sorting, visibility.
   * @returns {number} Opacity the twin should render at (0 = hidden).
   */
  #syncTwin(twin) {
    const { source, mesh } = twin;
    if (!source) return 1;
    if (source.destroyed || !source.texture?.valid) return 0;
    const tex = source.texture;
    if (twin.texture !== tex) {
      twin.texture = tex;
      this.#setGeometry(mesh, tex.width, tex.height, source.anchor?.x ?? 0, source.anchor?.y ?? 0, tex);
      mesh.shader.uniforms.uSampler = tex;
      mesh.shader.uniforms.uHasBase = 1;
    }
    mesh.transform.setFromMatrix(source.localTransform);

    // Sort right above the source and below whatever is above it.
    const sort = (source.sort ?? 0) + 0.5;
    if (mesh.elevation !== source.elevation || mesh.sortLayer !== source.sortLayer || mesh.sort !== sort) {
      mesh.elevation = source.elevation;
      mesh.sortLayer = source.sortLayer;
      mesh.sort = sort;
      mesh.zIndex = source.zIndex ?? 0;
      canvas.primary.sortDirty = true;
    }

    const worldW = tex.width * Math.abs(source.scale.x) || 1;
    const worldH = tex.height * Math.abs(source.scale.y) || 1;
    const step = canvas.dimensions.size * 0.12;
    mesh.shader.uniforms.uEdgeStep[0] = step / worldW;
    mesh.shader.uniforms.uEdgeStep[1] = step / worldH;

    if (!source.visible || source.renderable === false || !(source.worldAlpha > 0)) return 0;
    // Occludable tiles (roofs) fade out when a token is underneath: fade the snow with them.
    const occlusion = source.occluded ? (source.occludedAlpha ?? 0) : (source.unoccludedAlpha ?? 1);
    return (source.alpha ?? 1) * occlusion;
  }

  #tick() {
    if (!canvas.scene) return;
    const dt = Math.min(canvas.app.ticker.deltaMS, 100) / 1000;
    this.#time += dt;
    this.#rescan -= dt;
    if (this.#rescan <= 0) {
      this.#rescan = RESCAN_INTERVAL;
      this.#syncSources();
    }

    const state = WeatherController.getCurrent(canvas.scene);
    const snow = state.ground.snow;
    const wet = state.ground.wetness * (1 - snow * 0.8);
    const active = snow > 0.002 || wet > 0.002;
    this.mask.update();
    const hasMask = !this.mask.empty && !!this.mask.texture;

    const twins = [...this.#twins.values()];
    if (this.#overlay) twins.push(this.#overlay);
    for (const twin of twins) {
      const alpha = active ? this.#syncTwin(twin) : 0;
      const { mesh } = twin;
      mesh.visible = alpha > 0.001;
      if (!mesh.visible) continue;
      const u = mesh.shader.uniforms;
      u.uSnow = snow;
      u.uWet = wet;
      u.uRain = state.precipitation.rain;
      u.uTime = this.#time;
      u.uAlpha = alpha;
      u.uLocal = mesh.localTransform.toArray(true);
      u.uHasMask = hasMask ? 1 : 0;
      if (hasMask) {
        u.uMask = this.mask.texture;
        u.uMaskRect = this.mask.rect;
      }
    }
  }
}
