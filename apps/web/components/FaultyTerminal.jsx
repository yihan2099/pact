import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import './FaultyTerminal.css';

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;
uniform float uSeed;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; 
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;
  
  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;
  
  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;
  
  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);
  
  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);
  
  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

// Bot variant 1: Classic robot face (5x5)
float botChar1(vec2 p) {
    float px = p.x * 5.0;
    float py = (1.0 - p.y) * 5.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    // 11111
    // 10101
    // 11111
    // 10001
    // 11111
    bool on = false;
    if (iy == 0) on = true;
    else if (iy == 1) on = (ix == 0 || ix == 2 || ix == 4);
    else if (iy == 2) on = true;
    else if (iy == 3) on = (ix == 0 || ix == 4);
    else if (iy == 4) on = true;

    return on ? 1.0 : 0.0;
}

// Bot variant 2: Rounded bot with antenna (5x6)
float botChar2(vec2 p) {
    float px = p.x * 5.0;
    float py = (1.0 - p.y) * 6.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    // ..X..  antenna
    // .XXX.  head top
    // X.X.X  eyes
    // XXXXX  face
    // X...X  mouth
    // .XXX.  chin
    bool on = false;
    if (iy == 0) on = (ix == 2);
    else if (iy == 1) on = (ix == 1 || ix == 2 || ix == 3);
    else if (iy == 2) on = (ix == 0 || ix == 2 || ix == 4);
    else if (iy == 3) on = true;
    else if (iy == 4) on = (ix == 0 || ix == 4);
    else if (iy == 5) on = (ix == 1 || ix == 2 || ix == 3);

    return on ? 1.0 : 0.0;
}

// Bot variant 3: Cute bot with big eyes (5x5)
float botChar3(vec2 p) {
    float px = p.x * 5.0;
    float py = (1.0 - p.y) * 5.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    // .XXX.
    // XX.XX  big eyes
    // X.X.X  pupils
    // XXXXX
    // ..X..  small mouth
    bool on = false;
    if (iy == 0) on = (ix == 1 || ix == 2 || ix == 3);
    else if (iy == 1) on = (ix == 0 || ix == 1 || ix == 3 || ix == 4);
    else if (iy == 2) on = (ix == 0 || ix == 2 || ix == 4);
    else if (iy == 3) on = true;
    else if (iy == 4) on = (ix == 2);

    return on ? 1.0 : 0.0;
}

// Bot variant 4: Worker bot (5x5)
float botChar4(vec2 p) {
    float px = p.x * 5.0;
    float py = (1.0 - p.y) * 5.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    // XXXXX  helmet
    // .X.X.  visor eyes
    // XXXXX
    // .XXX.  body
    // X.X.X  arms/legs
    bool on = false;
    if (iy == 0) on = true;
    else if (iy == 1) on = (ix == 1 || ix == 3);
    else if (iy == 2) on = true;
    else if (iy == 3) on = (ix == 1 || ix == 2 || ix == 3);
    else if (iy == 4) on = (ix == 0 || ix == 2 || ix == 4);

    return on ? 1.0 : 0.0;
}

// Bot variant 5: Crab/Lobster (7x5) - OpenClaw mascot
float botCharCrab(vec2 p) {
    float px = p.x * 7.0;
    float py = (1.0 - p.y) * 5.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    // X.....X  (claws raised)
    // XX...XX  (pincers)
    // .XXXXX.  (shell)
    // ..X.X..  (eyes)
    // .X.X.X.  (legs)
    bool on = false;
    if (iy == 0) on = (ix == 0 || ix == 6);
    else if (iy == 1) on = (ix == 0 || ix == 1 || ix == 5 || ix == 6);
    else if (iy == 2) on = (ix >= 1 && ix <= 5);
    else if (iy == 3) on = (ix == 2 || ix == 4);
    else if (iy == 4) on = (ix == 1 || ix == 3 || ix == 5);

    return on ? 1.0 : 0.0;
}

// Select bot variant based on hash
float botChar(vec2 p, float variant) {
    if (variant < 0.18) return botChar1(p);
    else if (variant < 0.36) return botChar2(p);
    else if (variant < 0.54) return botChar3(p);
    else if (variant < 0.70) return botChar4(p);
    else return botCharCrab(p);  // 30% chance for crab
}

// PORTERNETWORK logo text (spans 13 cells horizontally)
// Each letter is 3x5, with 1 pixel spacing = 4 pixels per letter
// Total width: 13 letters * 4 - 1 = 51 pixels, height: 5 pixels
float porternetworkLogo(vec2 p, int letterIndex) {
    float px = p.x * 3.0;
    float py = (1.0 - p.y) * 5.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    bool on = false;

    // P (3x5)
    if (letterIndex == 0) {
        if (iy == 0) on = (ix == 0 || ix == 1);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 1);
        else if (iy == 3) on = (ix == 0);
        else if (iy == 4) on = (ix == 0);
    }
    // O (3x5)
    else if (letterIndex == 1) {
        if (iy == 0) on = (ix == 1);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 2);
        else if (iy == 3) on = (ix == 0 || ix == 2);
        else if (iy == 4) on = (ix == 1);
    }
    // R (3x5)
    else if (letterIndex == 2) {
        if (iy == 0) on = (ix == 0 || ix == 1);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 1);
        else if (iy == 3) on = (ix == 0 || ix == 2);
        else if (iy == 4) on = (ix == 0 || ix == 2);
    }
    // T (3x5)
    else if (letterIndex == 3) {
        if (iy == 0) on = true;
        else if (iy == 1) on = (ix == 1);
        else if (iy == 2) on = (ix == 1);
        else if (iy == 3) on = (ix == 1);
        else if (iy == 4) on = (ix == 1);
    }
    // E (3x5)
    else if (letterIndex == 4) {
        if (iy == 0) on = true;
        else if (iy == 1) on = (ix == 0);
        else if (iy == 2) on = (ix == 0 || ix == 1);
        else if (iy == 3) on = (ix == 0);
        else if (iy == 4) on = true;
    }
    // R (3x5)
    else if (letterIndex == 5) {
        if (iy == 0) on = (ix == 0 || ix == 1);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 1);
        else if (iy == 3) on = (ix == 0 || ix == 2);
        else if (iy == 4) on = (ix == 0 || ix == 2);
    }
    // N (3x5)
    else if (letterIndex == 6) {
        if (iy == 0) on = (ix == 0 || ix == 2);
        else if (iy == 1) on = true;
        else if (iy == 2) on = (ix == 0 || ix == 2);
        else if (iy == 3) on = (ix == 0 || ix == 2);
        else if (iy == 4) on = (ix == 0 || ix == 2);
    }
    // E (3x5)
    else if (letterIndex == 7) {
        if (iy == 0) on = true;
        else if (iy == 1) on = (ix == 0);
        else if (iy == 2) on = (ix == 0 || ix == 1);
        else if (iy == 3) on = (ix == 0);
        else if (iy == 4) on = true;
    }
    // T (3x5)
    else if (letterIndex == 8) {
        if (iy == 0) on = true;
        else if (iy == 1) on = (ix == 1);
        else if (iy == 2) on = (ix == 1);
        else if (iy == 3) on = (ix == 1);
        else if (iy == 4) on = (ix == 1);
    }
    // W (3x5)
    else if (letterIndex == 9) {
        if (iy == 0) on = (ix == 0 || ix == 2);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 2);
        else if (iy == 3) on = true;
        else if (iy == 4) on = (ix == 0 || ix == 2);
    }
    // O (3x5)
    else if (letterIndex == 10) {
        if (iy == 0) on = (ix == 1);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 2);
        else if (iy == 3) on = (ix == 0 || ix == 2);
        else if (iy == 4) on = (ix == 1);
    }
    // R (3x5)
    else if (letterIndex == 11) {
        if (iy == 0) on = (ix == 0 || ix == 1);
        else if (iy == 1) on = (ix == 0 || ix == 2);
        else if (iy == 2) on = (ix == 0 || ix == 1);
        else if (iy == 3) on = (ix == 0 || ix == 2);
        else if (iy == 4) on = (ix == 0 || ix == 2);
    }
    // K (3x5)
    else if (letterIndex == 12) {
        if (iy == 0) on = (ix == 0 || ix == 2);
        else if (iy == 1) on = (ix == 0 || ix == 1);
        else if (iy == 2) on = (ix == 0);
        else if (iy == 3) on = (ix == 0 || ix == 1);
        else if (iy == 4) on = (ix == 0 || ix == 2);
    }

    return on ? 1.0 : 0.0;
}

// Dollar sign (5x7 grid) - clear $ shape
float dollarSmall(vec2 p) {
    float px = p.x * 5.0;
    float py = (1.0 - p.y) * 7.0;
    int ix = int(floor(px));
    int iy = int(floor(py));

    // Clear $ pattern (5x7):
    //   0 1 2 3 4
    // 0   . X .      - top of vertical line
    // 1 . X X X .    - top curve
    // 2 X . X . .    - left + line
    // 3 . X X X .    - middle curve
    // 4 . . X . X    - right + line
    // 5 . X X X .    - bottom curve
    // 6   . X .      - bottom of vertical line
    bool on = false;
    if (iy == 0) on = (ix == 2);
    else if (iy == 1) on = (ix == 1 || ix == 2 || ix == 3);
    else if (iy == 2) on = (ix == 0 || ix == 2);
    else if (iy == 3) on = (ix == 1 || ix == 2 || ix == 3);
    else if (iy == 4) on = (ix == 2 || ix == 4);
    else if (iy == 5) on = (ix == 1 || ix == 2 || ix == 3);
    else if (iy == 6) on = (ix == 2);

    return on ? 1.0 : 0.0;
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    vec2 cellId = floor(p * grid);
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;

        float ripple = sin(distToMouse * 20.0 - iTime * 2.0) * 0.05 * mouseInfluence;
        intensity += ripple;
    }

    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);

        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }

    p = fract(p);
    p *= uDigitSize;

    // Multiple hashes for varied randomness - using uSeed for per-session variation
    float cellHash = fract(sin(dot(cellId + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
    float cellHash2 = fract(sin(dot(cellId + uSeed * 2.0, vec2(93.989, 67.345))) * 23421.631);
    float cellHash3 = fract(sin(dot(cellId + uSeed * 3.0, vec2(27.632, 41.912))) * 65432.123);
    float cellHash4 = fract(sin(dot(cellId + uSeed * 4.0, vec2(73.156, 19.847))) * 98234.567);

    // PORTERNETWORK logo - random placement based on hash, checking 13 consecutive cells
    bool isLogo = false;
    int letterIndex = 0;
    for (int i = 0; i < 13; i++) {
        vec2 checkCell = cellId - vec2(float(i), 0.0);
        float checkHash = fract(sin(dot(checkCell + uSeed, vec2(55.123, 33.456))) * 77777.0);
        if (checkHash < 0.002) {
            isLogo = true;
            letterIndex = i;
            break;
        }
    }

    // Bots - more random distribution using combined hashes
    float botChance = cellHash * cellHash3; // Multiply hashes for more variation
    bool isBot = botChance < 0.012 && !isLogo; // ~1.2% but feels more random

    // Dollars - organic flow using multiple hashes
    float flowPhase = fract(iTime * 0.08 + cellHash2);
    float dollarChance = cellHash2 * cellHash4;
    bool isDollarFlow = dollarChance < 0.04 && cellHash > 0.3 && !isLogo && !isBot;

    float brightness = 0.0;

    if (isLogo) {
        // Render PORTERNETWORK letter
        float logoVal = porternetworkLogo(p, letterIndex);
        brightness = logoVal * 0.85;
    } else if (isBot && intensity > 0.1) {
        // Render bot character (brighter, more prominent) with random variant
        float botVariant = fract(sin(dot(cellId, vec2(45.23, 89.13))) * 12345.6);
        float botVal = botChar(p, botVariant);
        brightness = botVal * 1.0;
        // Mark crab variant for red coloring (variant >= 0.70)
        if (botVariant >= 0.70 && botVal > 0.0) {
            brightness = botVal * 2.0; // Flag for crab: brightness > 1.0
        }
    } else if (isDollarFlow && intensity > 0.1) {
        // Render flowing dollar (more visible, animated)
        float dollarVal = dollarSmall(p);
        float fadeFactor = 0.5 + 0.5 * sin(flowPhase * 6.28318); // Pulsing effect
        brightness = dollarVal * fadeFactor * 0.9;
    } else if (intensity > 0.2) {
        // Subtle background dots (very sparse)
        float px5 = p.x * 5.0;
        float py5 = (1.0 - p.y) * 5.0;
        float x = fract(px5);
        float y = fract(py5);

        float i = floor(py5) - 2.0;
        float j = floor(px5) - 2.0;
        float n = i * i + j * j;
        float f = n * 0.0625;

        float isOn = step(0.3, intensity - f);
        brightness = isOn * (0.1 + y * 0.3) * (0.5 + x * 0.2);
    }

    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){

    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;

    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);

    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

    // Check if this is a crab (brightness > 1.0 is our flag)
    bool isCrab = middle > 1.5;

    vec3 baseColor;
    if (isCrab) {
        // Lobster red color for crab icons: #E63B2E -> vec3(0.9, 0.23, 0.18)
        vec3 lobsterRed = vec3(0.9, 0.23, 0.18);
        float actualBrightness = middle * 0.5; // Convert back from flag
        baseColor = lobsterRed * actualBrightness + sum * 0.1 * lobsterRed * bar;
    } else {
        baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    }
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }
    
    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  const num = parseInt(h, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export default function FaultyTerminal({
  scale = 1,
  gridMul = [2, 1],
  digitSize = 1.5,
  timeScale = 0.3,
  pause = false,
  scanlineIntensity = 0.3,
  glitchAmount = 1,
  flickerAmount = 1,
  noiseAmp = 0,
  chromaticAberration = 0,
  dither = 0,
  curvature = 0.2,
  tint = '#ffffff',
  mouseReact = true,
  mouseStrength = 0.2,
  dpr = Math.min(window.devicePixelRatio || 1, 2),
  pageLoadAnimation = true,
  brightness = 1,
  className,
  style,
  ...rest
}) {
  const containerRef = useRef(null);
  const programRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const frozenTimeRef = useRef(0);
  const rafRef = useRef(0);
  const loadAnimationStartRef = useRef(0);
  const timeOffsetRef = useRef(0);

  // Store current props in refs so render loop always has latest values
  // without causing effect re-runs
  const propsRef = useRef({
    pause, timeScale, mouseReact, pageLoadAnimation
  });
  propsRef.current = { pause, timeScale, mouseReact, pageLoadAnimation };

  const tintVec = useMemo(() => hexToRgb(tint), [tint]);
  const ditherValue = useMemo(() => (typeof dither === 'boolean' ? (dither ? 1 : 0) : dither), [dither]);

  const handleMouseMove = useCallback(e => {
    const ctn = containerRef.current;
    if (!ctn) return;
    const rect = ctn.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    mouseRef.current = { x, y };
  }, []);

  // INITIALIZATION EFFECT - Only runs once on mount, cleanup on unmount
  // This prevents WebGL context loss during prop changes
  useEffect(() => {
    const ctn = containerRef.current;
    if (!ctn) return;

    // Initialize random offset on mount
    timeOffsetRef.current = Math.random() * 100;

    // preserveDrawingBuffer: true prevents black flash when iOS Safari throttles RAF during scroll
    // powerPreference: 'high-performance' helps maintain frame rate during scroll
    const renderer = new Renderer({
      dpr,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      antialias: false,
    });
    rendererRef.current = renderer;
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    const geometry = new Triangle(gl);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
        },
        uScale: { value: scale },
        uGridMul: { value: new Float32Array(gridMul) },
        uDigitSize: { value: digitSize },
        uScanlineIntensity: { value: scanlineIntensity },
        uGlitchAmount: { value: glitchAmount },
        uFlickerAmount: { value: flickerAmount },
        uNoiseAmp: { value: noiseAmp },
        uChromaticAberration: { value: chromaticAberration },
        uDither: { value: ditherValue },
        uCurvature: { value: curvature },
        uTint: { value: new Color(tintVec[0], tintVec[1], tintVec[2]) },
        uMouse: {
          value: new Float32Array([smoothMouseRef.current.x, smoothMouseRef.current.y])
        },
        uMouseStrength: { value: mouseStrength },
        uUseMouse: { value: mouseReact ? 1 : 0 },
        uPageLoadProgress: { value: pageLoadAnimation ? 0 : 1 },
        uUsePageLoadAnimation: { value: pageLoadAnimation ? 1 : 0 },
        uBrightness: { value: brightness },
        uSeed: { value: timeOffsetRef.current }
      }
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    // Debounced resize to prevent excessive updates during iOS address bar changes
    let resizeTimeout;
    function resize() {
      if (!ctn || !renderer) return;
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      program.uniforms.iResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / gl.canvas.height
      );
    }

    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    });
    resizeObserver.observe(ctn);
    resize();

    // Render loop - reads from propsRef for latest values
    const update = t => {
      rafRef.current = requestAnimationFrame(update);
      const props = propsRef.current;

      if (props.pageLoadAnimation && loadAnimationStartRef.current === 0) {
        loadAnimationStartRef.current = t;
      }

      if (!props.pause) {
        const elapsed = (t * 0.001 + timeOffsetRef.current) * props.timeScale;
        program.uniforms.iTime.value = elapsed;
        frozenTimeRef.current = elapsed;
      } else {
        program.uniforms.iTime.value = frozenTimeRef.current;
      }

      if (props.pageLoadAnimation && loadAnimationStartRef.current > 0) {
        const animationDuration = 2000;
        const animationElapsed = t - loadAnimationStartRef.current;
        const progress = Math.min(animationElapsed / animationDuration, 1);
        program.uniforms.uPageLoadProgress.value = progress;
      }

      if (props.mouseReact) {
        const dampingFactor = 0.08;
        const smoothMouse = smoothMouseRef.current;
        const mouse = mouseRef.current;
        smoothMouse.x += (mouse.x - smoothMouse.x) * dampingFactor;
        smoothMouse.y += (mouse.y - smoothMouse.y) * dampingFactor;

        const mouseUniform = program.uniforms.uMouse.value;
        mouseUniform[0] = smoothMouse.x;
        mouseUniform[1] = smoothMouse.y;
      }

      renderer.render({ scene: mesh });
    };
    rafRef.current = requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);

    // Mouse move listener
    ctn.addEventListener('mousemove', handleMouseMove);

    // Cleanup ONLY on unmount - never on prop changes
    return () => {
      clearTimeout(resizeTimeout);
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      ctn.removeEventListener('mousemove', handleMouseMove);
      if (gl.canvas.parentElement === ctn) ctn.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      programRef.current = null;
      rendererRef.current = null;
      meshRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpr]); // Only re-initialize if DPR changes (rare - device change)

  // UNIFORM UPDATE EFFECT - Updates shader uniforms when props change
  // WITHOUT destroying and recreating the WebGL context
  useEffect(() => {
    const program = programRef.current;
    if (!program) return;

    program.uniforms.uScale.value = scale;
    program.uniforms.uGridMul.value = new Float32Array(gridMul);
    program.uniforms.uDigitSize.value = digitSize;
    program.uniforms.uScanlineIntensity.value = scanlineIntensity;
    program.uniforms.uGlitchAmount.value = glitchAmount;
    program.uniforms.uFlickerAmount.value = flickerAmount;
    program.uniforms.uNoiseAmp.value = noiseAmp;
    program.uniforms.uChromaticAberration.value = chromaticAberration;
    program.uniforms.uDither.value = ditherValue;
    program.uniforms.uCurvature.value = curvature;
    program.uniforms.uTint.value = new Color(tintVec[0], tintVec[1], tintVec[2]);
    program.uniforms.uMouseStrength.value = mouseStrength;
    program.uniforms.uUseMouse.value = mouseReact ? 1 : 0;
    program.uniforms.uBrightness.value = brightness;
  }, [
    scale,
    gridMul,
    digitSize,
    scanlineIntensity,
    glitchAmount,
    flickerAmount,
    noiseAmp,
    chromaticAberration,
    ditherValue,
    curvature,
    tintVec,
    mouseReact,
    mouseStrength,
    brightness
  ]);

  return <div ref={containerRef} className={`faulty-terminal-container ${className}`} style={style} {...rest} />;
}
