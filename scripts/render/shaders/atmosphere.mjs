/**
 * Atmosphere shader: drifting fog wisps and moving cloud shadows in a single
 * full-view pass. Both drift with the accumulated wind offset.
 */

export const ATMOSPHERE_VERTEX = `
precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform vec4 uRect;
varying vec2 vScene;

void main() {
  vScene = uRect.xy + aVertexPosition * uRect.zw;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(vScene, 1.0)).xy, 0.0, 1.0);
}
`;

export const ATMOSPHERE_FRAGMENT = `
precision highp float;
varying vec2 vScene;

uniform float uGrid;
uniform float uTime;
uniform vec2 uDrift;
uniform float uFog;
uniform float uShadow;
uniform vec3 uFogColor;

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

void main() {
  vec2 g = vScene / uGrid;

  // Cloud shadows: big soft blobs sailing with the wind.
  float shadow = 0.0;
  if (uShadow > 0.001) {
    float c = fbm((g - uDrift) * 0.075 + vec2(37.2, 91.7));
    shadow = smoothstep(0.47, 0.6, c) * uShadow * 0.38;
  }

  // Fog: two layers of wisps moving at different speeds.
  float fogA = 0.0;
  if (uFog > 0.001) {
    vec2 fp = (g - uDrift * 0.6) * 0.12 + vec2(53.1, 17.9);
    float f1 = fbm(fp + vec2(0.0, uTime * 0.01));
    float f2 = fbm(fp * 2.1 - uDrift * 0.05 + 3.7);
    float wisps = smoothstep(0.3, 0.8, f1 * 0.6 + f2 * 0.4);
    fogA = uFog * (0.15 + 0.85 * wisps) * 0.8;
  }

  // Premultiplied: fog over shadow.
  vec4 col = vec4(0.0, 0.0, 0.0, shadow);
  col = vec4(uFogColor * fogA, fogA) + col * (1.0 - fogA);
  gl_FragColor = col;
}
`;
