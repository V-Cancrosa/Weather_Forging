import { MODULE_ID } from "../constants.mjs";
import { getSetting, QUALITY_FACTORS } from "../settings.mjs";
import { WeatherController } from "../state/weather-controller.mjs";

/**
 * Per precipitation type: how its particles look and move.
 * Speeds are in grid squares per second; the "fall" axis is canvas +y, which
 * reads as perspective on a top-down map.
 */
const PARTICLE_TYPES = {
  rain: { texture: "streak", max: 1400, fall: [9, 14], scale: [0.6, 1.1], alpha: [0.25, 0.55], sway: 0, align: true, windFactor: 1 },
  snow: { texture: "flake", max: 1000, fall: [0.6, 1.4], scale: [0.25, 0.8], alpha: [0.55, 0.95], sway: 0.6, align: false, windFactor: 0.8 },
  hail: { texture: "flake", max: 600, fall: [10, 15], scale: [0.2, 0.35], alpha: [0.7, 0.95], sway: 0, align: false, windFactor: 0.4 },
  ash: { texture: "ash", max: 700, fall: [0.3, 0.8], scale: [0.2, 0.6], alpha: [0.35, 0.75], sway: 0.9, align: false, windFactor: 1 }
};

const rand = ([min, max]) => min + Math.random() * (max - min);
const wrap = (v, min, size) => min + ((((v - min) % size) + size) % size);

/**
 * Stage-1 renderer: proves the state → visuals pipeline end to end.
 * Precipitation particles, fog veil, cloud gloom and lightning flashes, all
 * driven by WeatherController.getCurrent() every frame.
 */
export class WeatherRenderer {
  /** @type {PIXI.Container|null} */
  container = null;
  #textures = {};
  #layers = {};
  #fog = null;
  #gloom = null;
  #flash = null;
  #flashLevel = 0;
  #pendingFlash = 0;
  #time = 0;

  attach() {
    this.detach();
    const host = canvas.weather;
    if (!host) return;

    this.#createTextures();
    this.container = new PIXI.Container();
    this.container.name = MODULE_ID;
    this.container.eventMode = "none";
    this.container.zIndex = 1000;

    this.#gloom = this.#createVeil(0x0a1020);
    for (const [type, cfg] of Object.entries(PARTICLE_TYPES)) {
      const layer = new PIXI.Container();
      layer.particles = Array.from({ length: cfg.max }, () => this.#spawn(layer, cfg));
      this.#layers[type] = layer;
      this.container.addChild(layer);
    }
    this.#fog = this.#createVeil(0xc9ced6);
    this.#flash = this.#createVeil(0xf2f6ff);
    this.#flash.blendMode = PIXI.BLEND_MODES.ADD;

    host.addChild(this.container);
    canvas.app.ticker.add(this.#tick, this);
  }

  detach() {
    canvas.app?.ticker?.remove(this.#tick, this);
    if (this.container && !this.container.destroyed) this.container.destroy({ children: true });
    for (const tex of Object.values(this.#textures)) tex.destroy(true);
    this.container = null;
    this.#textures = {};
    this.#layers = {};
  }

  #createTextures() {
    const renderer = canvas.app.renderer;
    const make = draw => {
      const g = new PIXI.Graphics();
      draw(g);
      const tex = renderer.generateTexture(g);
      g.destroy();
      return tex;
    };
    this.#textures.streak = make(g => {
      for (let i = 0; i < 8; i++) g.beginFill(0xdfe9f5, 0.12 + i * 0.1).drawRect(0, i * 4, 2, 4).endFill();
    });
    this.#textures.flake = make(g => {
      g.beginFill(0xffffff, 0.25).drawCircle(6, 6, 6).endFill();
      g.beginFill(0xffffff, 0.5).drawCircle(6, 6, 4).endFill();
      g.beginFill(0xffffff, 1).drawCircle(6, 6, 2.2).endFill();
    });
    this.#textures.ash = make(g => {
      g.beginFill(0x8a8580, 0.6).drawCircle(5, 5, 5).endFill();
      g.beginFill(0x5f5a55, 0.9).drawCircle(5, 5, 2.5).endFill();
    });
  }

  #createVeil(tint) {
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.tint = tint;
    sprite.alpha = 0;
    this.container.addChild(sprite);
    return sprite;
  }

  #spawn(layer, cfg) {
    const s = new PIXI.Sprite(this.#textures[cfg.texture]);
    s.anchor.set(0.5);
    s.scale.set(rand(cfg.scale));
    s.baseAlpha = rand(cfg.alpha);
    s.fall = rand(cfg.fall);
    s.phase = Math.random() * Math.PI * 2;
    s.x = Math.random();
    s.y = Math.random();
    s.seeded = false;
    s.visible = false;
    layer.addChild(s);
    return s;
  }

  /** The visible area of the canvas in world coordinates, with padding. */
  #viewRect() {
    const scale = canvas.stage.scale.x;
    const { width, height } = canvas.app.renderer.screen;
    const w = (width / scale) * 1.2;
    const h = (height / scale) * 1.2;
    return { x: canvas.stage.pivot.x - w / 2, y: canvas.stage.pivot.y - h / 2, w, h };
  }

  #tick() {
    if (!this.container || !canvas.scene) return;
    const dt = Math.min(canvas.app.ticker.deltaMS, 100) / 1000;
    this.#time += dt;

    const state = WeatherController.getCurrent(canvas.scene);
    const quality = QUALITY_FACTORS[getSetting("quality")] ?? 0.8;
    const reduceMotion = getSetting("reduceMotion");
    const view = this.#viewRect();
    const grid = canvas.dimensions.size;

    // Wind: km/h → grid squares/s (heuristic: 1 square ≈ 1.5 m), with gusts.
    const gust = 1 + state.wind.gusts * 0.6 * Math.sin(this.#time * 0.9) * Math.sin(this.#time * 0.37 + 1);
    const windSpeed = (state.wind.speed / 3.6 / 1.5) * gust;
    const rad = (state.wind.direction * Math.PI) / 180;
    const windX = Math.cos(rad) * windSpeed;
    const windY = Math.sin(rad) * windSpeed;

    for (const [type, cfg] of Object.entries(PARTICLE_TYPES)) {
      const layer = this.#layers[type];
      const active = Math.round(cfg.max * quality * state.precipitation[type]);
      layer.particles.forEach((p, i) => {
        p.visible = i < active;
        if (!p.visible) return;
        if (!p.seeded) {
          p.x = view.x + p.x * view.w;
          p.y = view.y + p.y * view.h;
          p.seeded = true;
        }
        const sway = cfg.sway * Math.sin(this.#time * 1.5 + p.phase);
        const vx = (windX * cfg.windFactor + sway) * grid;
        const vy = (p.fall + windY * cfg.windFactor * 0.5) * grid;
        p.x = wrap(p.x + vx * dt, view.x, view.w);
        p.y = wrap(p.y + vy * dt, view.y, view.h);
        p.alpha = p.baseAlpha;
        if (cfg.align) p.rotation = Math.atan2(vy, vx) - Math.PI / 2;
      });
    }

    for (const veil of [this.#gloom, this.#fog, this.#flash]) {
      veil.position.set(view.x, view.y);
      veil.width = view.w;
      veil.height = view.h;
    }
    this.#gloom.alpha = state.cloudCover * 0.18 + state.lightning * 0.1;
    this.#fog.alpha = state.fog * 0.6;

    // Lightning: random strikes, often with a quick second flicker.
    if (state.lightning > 0 && Math.random() < state.lightning * 0.25 * dt) {
      this.#flashLevel = 1;
      if (!reduceMotion && Math.random() < 0.6) this.#pendingFlash = 0.12 + Math.random() * 0.1;
    }
    if (this.#pendingFlash > 0) {
      this.#pendingFlash -= dt;
      if (this.#pendingFlash <= 0) this.#flashLevel = Math.max(this.#flashLevel, 0.8);
    }
    this.#flashLevel = Math.max(0, this.#flashLevel - dt * 4);
    this.#flash.alpha = this.#flashLevel * (reduceMotion ? 0.12 : 0.55);
    this.flashLevel = this.#flash.alpha;
  }
}
