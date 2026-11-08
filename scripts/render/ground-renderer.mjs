import { MODULE_ID } from "../constants.mjs";
import { WeatherController } from "../state/weather-controller.mjs";
import { GROUND_FRAGMENT, GROUND_VERTEX } from "./shaders/ground.mjs";

/** Above tiles, below drawings and tokens — used for overlay mode only. */
const OVERLAY_SORT_LAYER = 550;

/**
 * Ground cover: snow and wetness painted onto the map itself.
 *
 * For every ground texture of the scene (the background and, in v14, each
 * level texture) we place a twin mesh right above it in the primary canvas
 * group. The twin samples the same texture and re-renders it with weather
 * applied, so it is lit, occluded and sorted exactly like the map underneath.
 * Scenes without a ground image get a transparent overlay instead.
 */
export class GroundRenderer {
  /** @type {{source: PIXI.DisplayObject|null, mesh: PIXI.Mesh, texture: PIXI.Texture|null}[]} */
  #twins = [];
  #time = 0;

  /** @param {PIXI.Filter|null} occlusionFilter  Hides cover where weather is suppressed. */
  attach(occlusionFilter = null) {
    this.detach();
    const primary = canvas.primary;
    if (!primary) return;
    try {
      const sources = [primary.background, ...(primary.levelTextures ?? [])]
        .filter(s => s && !s.destroyed && s.texture?.valid && s.texture !== PIXI.Texture.EMPTY);
      if (sources.length) {
        for (const source of sources) this.#twins.push(this.#createTwin(source, occlusionFilter));
      } else {
        this.#twins.push(this.#createTwin(null, occlusionFilter));
      }
      for (const twin of this.#twins) primary.addChild(twin.mesh);
      primary.sortDirty = true;
      canvas.app.ticker.add(this.#tick, this);
    } catch (err) {
      console.warn(`${MODULE_ID} | Ground cover disabled for this scene.`, err);
      this.detach();
    }
  }

  detach() {
    canvas.app?.ticker?.remove(this.#tick, this);
    for (const { mesh } of this.#twins) {
      if (!mesh.destroyed) mesh.destroy({ children: true });
    }
    this.#twins = [];
  }

  #createTwin(source, occlusionFilter) {
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
      uLocal: new PIXI.Matrix().toArray(true)
    });
    const mesh = new PIXI.Mesh(new PIXI.Geometry(), shader);
    mesh.name = `${MODULE_ID}-ground`;
    mesh.eventMode = "none";
    mesh.visible = false;
    if (occlusionFilter) mesh.filters = [occlusionFilter];
    const twin = { source, mesh, texture: null };

    if (source) {
      mesh.elevation = source.elevation;
      mesh.sortLayer = source.sortLayer;
      mesh.sort = source.sort;
      mesh.zIndex = (source.zIndex ?? 0) + 1;
    } else {
      const { sceneRect } = canvas.dimensions;
      this.#setGeometry(mesh, sceneRect.width, sceneRect.height, 0, 0, null);
      mesh.position.set(sceneRect.x, sceneRect.y);
      mesh.elevation = 0;
      mesh.sortLayer = OVERLAY_SORT_LAYER;
      mesh.sort = 0;
    }
    return twin;
  }

  /** Build a quad of the given size, with UVs from the texture frame. */
  #setGeometry(mesh, width, height, anchorX, anchorY, texture) {
    const x0 = -anchorX * width;
    const y0 = -anchorY * height;
    const uv = texture?._uvs;
    const uvs = uv ? [uv.x0, uv.y0, uv.x1, uv.y1, uv.x2, uv.y2, uv.x3, uv.y3] : [0, 0, 1, 0, 1, 1, 0, 1];
    const geometry = new PIXI.Geometry()
      .addAttribute("aVertexPosition", [x0, y0, x0 + width, y0, x0 + width, y0 + height, x0, y0 + height], 2)
      .addAttribute("aUvs", uvs, 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
    mesh.geometry = geometry; // the setter releases the previous geometry
  }

  /** Keep a twin glued to its source: texture, transform, visibility. */
  #syncTwin(twin) {
    const { source, mesh } = twin;
    if (!source) return true;
    if (source.destroyed || !source.texture?.valid) return false;
    const tex = source.texture;
    if (twin.texture !== tex) {
      twin.texture = tex;
      this.#setGeometry(mesh, tex.width, tex.height, source.anchor?.x ?? 0, source.anchor?.y ?? 0, tex);
      mesh.shader.uniforms.uSampler = tex;
      mesh.shader.uniforms.uHasBase = 1;
    }
    mesh.transform.setFromMatrix(source.localTransform);
    const worldW = tex.width * Math.abs(source.scale.x) || 1;
    const worldH = tex.height * Math.abs(source.scale.y) || 1;
    const step = canvas.dimensions.size * 0.12;
    mesh.shader.uniforms.uEdgeStep[0] = step / worldW;
    mesh.shader.uniforms.uEdgeStep[1] = step / worldH;
    return source.visible && source.renderable !== false && source.worldAlpha > 0;
  }

  #tick() {
    if (!canvas.scene) return;
    this.#time += Math.min(canvas.app.ticker.deltaMS, 100) / 1000;
    const state = WeatherController.getCurrent(canvas.scene);
    const snow = state.ground.snow;
    const wet = state.ground.wetness * (1 - snow * 0.8);
    const active = snow > 0.002 || wet > 0.002;

    for (const twin of this.#twins) {
      const sourceVisible = this.#syncTwin(twin);
      const { mesh } = twin;
      mesh.visible = active && sourceVisible;
      if (!mesh.visible) continue;
      const u = mesh.shader.uniforms;
      u.uSnow = snow;
      u.uWet = wet;
      u.uRain = state.precipitation.rain;
      u.uTime = this.#time;
      u.uAlpha = twin.source ? twin.source.alpha ?? 1 : 1;
      u.uLocal = mesh.localTransform.toArray(true);
    }
  }
}
