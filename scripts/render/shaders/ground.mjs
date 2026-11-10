/**
 * Ground cover shader: wet surfaces with puddles and rain ripples, and
 * accumulating snow that drifts against high-contrast edges (walls, cliffs).
 *
 * Two modes:
 *  - base mode (uHasBase = 1): re-renders a ground texture (scene background or
 *    level texture) with weather applied, so the map itself turns white or wet;
 *  - overlay mode (uHasBase = 0): no texture to sample, so only snow and wet
 *    tint are painted as a transparent layer.
 */

export const GROUND_VERTEX = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uLocal;
varying vec2 vUvs;
varying vec2 vScene;

void main() {
  vUvs = aUvs;
  vScene = (uLocal * vec3(aVertexPosition, 1.0)).xy;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const GROUND_FRAGMENT = `
precision highp float;
varying vec2 vUvs;
varying vec2 vScene;

uniform sampler2D uSampler;
uniform float uHasBase;
uniform float uSnow;
uniform float uWet;
uniform float uRain;
uniform float uTime;
uniform float uGrid;
uniform vec2 uEdgeStep;
uniform float uAlpha;
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform float uHasMask;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 sampleBase(vec2 uv) {
  vec4 t = texture2D(uSampler, uv);
  return t.a > 0.0 ? t.rgb / t.a : vec3(0.0);
}

void main() {
  vec2 p = vScene / uGrid;                       // grid-square space
  bool hasBase = uHasBase > 0.5;
  vec4 tex = hasBase ? texture2D(uSampler, vUvs) : vec4(0.0);
  float a = hasBase ? tex.a : 1.0;
  vec3 col = (hasBase && a > 0.0) ? tex.rgb / a : vec3(0.0);
  float lum = luma(col);

  // ---------------- Wet ground ----------------
  float puddle = 0.0;
  vec3 wetCol = col;
  vec3 sky = vec3(0.36, 0.39, 0.44);
  if (uWet > 0.001) {
    vec3 dark = col * (1.0 - 0.32 * uWet);
    dark = mix(vec3(luma(dark)), dark, 1.0 + 0.3 * uWet);   // wet = more saturated

    float pn = fbm(p * 0.35 + 31.7);
    float lvl = 0.76 - 0.14 * uWet;
    puddle = smoothstep(lvl, lvl + 0.04, pn) * smoothstep(0.2, 0.7, uWet);

    // Rain ripples: one random ring per half grid square, staggered in time.
    vec2 cp = p * 2.0;
    vec2 cell = floor(cp);
    vec2 f = fract(cp) - 0.5 + (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
    float t = fract(uTime * 0.8 + hash(cell));
    float ring = smoothstep(0.05, 0.0, abs(length(f) - t * 0.45)) * (1.0 - t) * uRain;

    vec3 pud = mix(dark * 0.55, sky, 0.4) + ring * 0.25;
    float sheen = smoothstep(0.7, 1.0, fbm(p * 1.7 + vec2(uTime * 0.02, 0.0))) * 0.12 * uWet;
    wetCol = mix(dark, pud, puddle) + sheen;
  }

  // ---------------- Snow ----------------
  float snowA = 0.0;
  vec3 snowCol = vec3(0.92, 0.95, 1.0);
  if (uSnow > 0.001) {
    float n = fbm(p * 0.7);
    float detail = fbm(p * 4.3 + 7.0);
    float grain = noise(vScene * 0.2);

    // Drifts pile up against strong contrast edges (walls, cliffs, furniture).
    float edge = 0.0;
    if (hasBase) {
      float lx = luma(sampleBase(vUvs + vec2(uEdgeStep.x, 0.0))) - luma(sampleBase(vUvs - vec2(uEdgeStep.x, 0.0)));
      float ly = luma(sampleBase(vUvs + vec2(0.0, uEdgeStep.y))) - luma(sampleBase(vUvs - vec2(0.0, uEdgeStep.y)));
      edge = clamp(length(vec2(lx, ly)) * 2.5, 0.0, 1.0);
    }

    // Crisp-edged patches that grow and merge as snow accumulates, eroded by
    // fine detail so borders look like real snow rather than soft clouds.
    float cover = n * 0.5 + detail * 0.25 + grain * 0.08 + lum * 0.12 + edge * 0.4;
    float th = 0.98 - uSnow * 1.15;
    snowA = smoothstep(th, th + 0.08, cover);
    float dust = sqrt(uSnow) * (0.3 + 0.25 * detail);     // rime / thin layer between patches
    snowA = min(max(snowA * 0.95, dust), 0.85);   // never a full whiteout: the map must stay readable

    snowCol *= 0.88 + 0.12 * detail;
    snowCol = mix(snowCol, snowCol * vec3(0.84, 0.9, 1.0), (1.0 - detail) * 0.45);  // blue shadows
    vec2 gc = floor(vScene / 3.0);
    float glint = step(0.985, hash(gc)) * (0.5 + 0.5 * sin(uTime * 3.0 + hash(gc + 1.0) * 6.283));
    snowCol += glint * 0.45 * uSnow;
    if (hasBase) snowCol *= 0.68 + 0.42 * lum;   // map structure shows through the snow
  }

  // No-weather zones (Suppress Weather regions): fade back to the untouched map.
  float m = 0.0;
  if (uHasMask > 0.5) m = texture2D(uMask, (vScene - uMaskRect.xy) / uMaskRect.zw).r;

  if (hasBase) {
    vec3 cold = mix(vec3(luma(wetCol)), wetCol, 1.0 - 0.45 * uSnow) * vec3(0.93, 0.97, 1.04);
    vec3 outCol = mix(cold, snowCol, snowA);
    gl_FragColor = mix(vec4(outCol * a, a), tex, m) * uAlpha;
  } else {
    vec4 wetL = vec4(mix(vec3(0.05, 0.06, 0.08), sky, puddle), 0.18 * uWet + 0.25 * puddle);
    float sa = snowA * 0.9;
    float oa = sa + wetL.a * (1.0 - sa);
    vec3 orgb = snowCol * sa + wetL.rgb * wetL.a * (1.0 - sa);
    gl_FragColor = vec4(orgb, oa) * (1.0 - m) * uAlpha;
  }
}
`;
