import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const PORTAL_ASPECT = 0.755;
const DAY_NIGHT_CYCLE_SECONDS = 12;
const MAX_FRAME_RATE = 60;
const HTML_PORTAL_FRAME_INTERVAL = 1000 / 60;
const PORTAL_IDLE_ORBIT = THREE.MathUtils.degToRad(0.35);
const PORTAL_IDLE_PITCH = THREE.MathUtils.degToRad(0.16);
const PORTAL_IDLE_SPEED = 0.28;
const FRAME_TRANSITION_DURATION = 1250;
const INTERACTION_HINT_DURATION = 5000;
const GALLERY_ORBIT_LIMIT = THREE.MathUtils.degToRad(52);
const GALLERY_PITCH_LIMIT = THREE.MathUtils.degToRad(30);
const GALLERY_ORBIT_SPEED = THREE.MathUtils.degToRad(34);
const GALLERY_RADIUS_START = 7.4;
const GALLERY_RADIUS_MIN = 4.8;
const GALLERY_RADIUS_MAX = 10.4;
const GALLERY_RADIAL_SPEED = 2.6;
const GALLERY_CAMERA_HEIGHT = 0.08;
const FRAME_HOME_Y = -0.04;
const GALLERY_BASE_PITCH = Math.atan2(
  GALLERY_CAMERA_HEIGHT - FRAME_HOME_Y,
  GALLERY_RADIUS_START,
);
const GALLERY_DRAG_RANGE = 0.32;
const GALLERY_WHEEL_RANGE = 720;
const GALLERY_PINCH_RANGE = 0.7;
const GALLERY_GESTURE_SENSITIVITY = 2;
const GALLERY_NAVIGATION_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);
const PORTAL_RENDER_HEIGHT = 2048;
const MAX_CANVAS_WIDTH = 2560;
const MAX_CANVAS_HEIGHT = 1440;

let sparkModulePromise;
let tideModulePromise;
let bloomModulePromise;

function loadSparkModule() {
  sparkModulePromise ??= import("@sparkjsdev/spark");
  return sparkModulePromise;
}

function loadTideModule() {
  tideModulePromise ??= Promise.all([
    import("three/addons/objects/Sky.js"),
    import("three/addons/objects/Water.js"),
  ]).then(([{ Sky }, { Water }]) => ({ Sky, Water }));
  return tideModulePromise;
}

function loadBloomModule() {
  bloomModulePromise ??= Promise.all([
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
  ]).then(([{ EffectComposer }, { RenderPass }, { UnrealBloomPass }]) => ({
    EffectComposer,
    RenderPass,
    UnrealBloomPass,
  }));
  return bloomModulePromise;
}

function portalRenderSize() {
  return [
    Math.round(PORTAL_RENDER_HEIGHT * PORTAL_ASPECT),
    PORTAL_RENDER_HEIGHT,
  ];
}

function rendererPixelRatio(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
  dpr = window.devicePixelRatio,
) {
  return Math.min(
    dpr,
    2,
    MAX_CANVAS_WIDTH / Math.max(viewportWidth, 1),
    MAX_CANVAS_HEIGHT / Math.max(viewportHeight, 1),
  );
}

if (import.meta.env.DEV) {
  console.assert(portalRenderSize()[1] === PORTAL_RENDER_HEIGHT);
}

const WORLDS = [
  {
    model: "/assets/worlds/01-sponza/scene.glb",
    background: 0x211b16,
    modelPosition: [0, 1.02, 0],
    modelScale: 1,
    camera: [-11.5, 3.2, 0.15],
    target: [9, 2.85, 0],
    lateral: 2.45,
    push: 1.35,
    arc: 0.25,
    vertical: -0.55,
    fov: 55,
    near: 0.05,
    far: 80,
    hemisphereIntensity: 0.28,
    sunIntensity: 2.8,
    fillIntensity: 0.08,
    sunPosition: [-2, 14, 10],
    sunTarget: [3, 1.2, 0],
    envMapIntensity: 0.12,
    normalIntensity: 1.35,
    lightPools: [
      {
        position: [-6.5, 7.5, -0.8],
        target: [-4.5, 0.6, 0],
        intensity: 72,
      },
      {
        position: [1.5, 7.5, 0.8],
        target: [3.5, 0.6, 0],
        intensity: 64,
      },
      {
        position: [9.5, 7.5, -0.8],
        target: [11.5, 0.6, 0],
        intensity: 56,
      },
    ],
    shadows: true,
  },
  {
    model: "/assets/worlds/02-littlest-tokyo/scene.glb",
    background: 0x9dc8e8,
    modelPosition: [1, 1, 0],
    modelScale: 0.01,
    camera: [5, 2, 8],
    target: [0, 0.7, 0],
    lateral: 2.4,
    push: 0.9,
    arc: 0.55,
    vertical: 0.22,
    fov: 48,
    near: 0.1,
    far: 100,
    animate: true,
  },
  {
    model: "/assets/worlds/03-orbit/iss.glb",
    background: 0x010207,
    modelPosition: [0.5, 0.6, -2],
    normalizeSize: 9.5,
    centerModel: true,
    camera: [7.2, 4.6, 12.5],
    target: [0, 0.2, -3.2],
    lateral: 4.1,
    push: 2.6,
    arc: 0.9,
    vertical: 0.9,
    idleLateral: 0.55,
    idlePush: 0.9,
    idleSpeed: 0.3,
    fov: 48,
    near: 0.05,
    far: 220,
    effect: "orbit",
    modernFrame: true,
    lightScale: 0.05,
    envMapIntensity: 0.14,
    bloom: { strength: 0.1, radius: 0.28, threshold: 0.92 },
  },
  {
    splat: "/assets/worlds/04-marble-ceramic/scene.spz",
    background: 0x171512,
    splatPosition: [0, 0, 0],
    splatScale: 0.5,
    camera: [0, 0.7, 3.2],
    target: [0, 0.72, -2.8],
    lateral: 1.65,
    push: 0.72,
    arc: 0.42,
    vertical: 0.72,
    idleLateral: 0.18,
    idlePush: 0.24,
    idleSpeed: 0.38,
    fov: 50,
  },
  {
    splat: "/assets/worlds/05-marble-ceramic-02/scene.spz",
    background: 0x151412,
    splatPosition: [0, 0, 0],
    splatScale: 0.5,
    camera: [0, 0.36, 3.35],
    target: [0, 0.4, -3.5],
    lateral: 0.82,
    push: 3.25,
    edgePush: 1.42,
    arc: 0.38,
    vertical: 0.68,
    centerTargetLift: 1.15,
    centerFov: 50,
    idleLateral: 0.08,
    idlePush: 0.08,
    idleSpeed: 0.34,
    fov: 44,
  },
  {
    model: "/assets/worlds/06-moon-cove/coastal-cliff/scene-2k.glb",
    extraAssets: [
      {
        model:
          "/assets/worlds/06-moon-cove/pine-sapling/scene-2k.glb",
      },
      {
        model: "/assets/worlds/06-moon-cove/moon/moon-2k.glb",
        normalizeSize: 7.8,
        centerModel: true,
      },
    ],
    background: 0x84b9cf,
    modelScale: 1,
    camera: [0, 4.6, 17.5],
    target: [0, 3.05, -25],
    lateral: 3.5,
    push: 2.1,
    arc: 0.52,
    vertical: 0.28,
    idleLateral: 0.18,
    idlePush: 0.26,
    idleSpeed: 0.22,
    fov: 52,
    near: 0.08,
    far: 240,
    effect: "tide",
    hemisphereIntensity: 1.25,
    sunIntensity: 4.8,
    fillIntensity: 0.5,
    sunPosition: [-18, 34, 12],
    sunTarget: [0, 0, -22],
    envMapIntensity: 0.18,
    normalIntensity: 1.18,
    shadows: true,
    shadowMapSize: 1024,
  },
  {
    htmlScene: "/assets/worlds/07-island-hike/index.html",
    animateWhileVisible: true,
    background: 0xfcebc8,
    camera: [0, 0, 2.355],
    target: [0, 0, 0],
    lateral: 0,
    push: 0,
    arc: 0,
    vertical: 0,
    fov: 46,
    near: 0.1,
    far: 10,
  },
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const stage = document.querySelector("#stage");
const loadProgress = document.querySelector("#load-progress");
const loadValue = document.querySelector("#load-value");
const interfaceElement = document.querySelector(".interface");
const activeWorldStatus = document.querySelector("#active-world-status");
const interactionHint = document.querySelector("#interaction-hint");
const nextButton = document.querySelector("#next");
const completion = document.querySelector("#completion");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(rendererPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.append(renderer.domElement);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/assets/runtime/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader();
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath("/assets/runtime/basis/")
  .detectSupport(renderer);
const frameWoodSources = [
  { path: "/assets/shared/frame-materials/dark-wood/dark_wood", rotation: 0 },
  { path: "/assets/shared/frame-materials/wood-floor/wood_floor", rotation: Math.PI / 2 },
  { path: "/assets/shared/frame-materials/wood-planks/wood_planks", rotation: 0 },
  {
    path: "/assets/shared/frame-materials/dark-wooden-planks/dark_wooden_planks",
    rotation: 0,
  },
];
const frameWoodStyles = [
  { source: 3, color: 0xb8aaa0, roughness: 0.94, clearcoat: 0.02, normal: 0.52, repeat: 0.72, offset: [0.03, 0.17] },
  { source: 1, color: 0xffd6a8, roughness: 0.48, clearcoat: 0.32, normal: 0.28, repeat: 0.62, offset: [0.19, 0.05] },
  { source: 2, color: 0xd8b88c, roughness: 0.82, clearcoat: 0.06, normal: 0.48, repeat: 0.7, offset: [0.31, 0.21] },
  { source: 3, color: 0x888581, roughness: 0.98, clearcoat: 0, normal: 0.58, repeat: 0.64, offset: [0.45, 0.11] },
  { source: 0, color: 0xffb29f, roughness: 0.42, clearcoat: 0.46, normal: 0.22, repeat: 0.68, offset: [0.12, 0.38] },
  { source: 2, color: 0xae806c, roughness: 0.72, clearcoat: 0.12, normal: 0.4, repeat: 0.66, offset: [0.38, 0.29] },
  { source: 1, color: 0xffefd1, colorBoost: 1.55, roughness: 0.76, clearcoat: 0.08, normal: 0.34, repeat: 0.7, offset: [0.27, 0.14] },
];
let frameWoodMaterials;
const modernFrameMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x30373d,
  roughness: 0.4,
  metalness: 0.52,
  clearcoat: 0.16,
  clearcoatRoughness: 0.3,
});
const frameWoodReady = Promise.all(
  frameWoodSources.flatMap(({ path }) =>
    ["diff", "nor_gl", "rough"].map((type) =>
      ktx2Loader.loadAsync(`${path}_${type}_2k.ktx2`),
    ),
  ),
).then((textures) => {
  const sources = frameWoodSources.map((_, index) =>
    textures.slice(index * 3, index * 3 + 3),
  );
  sources.forEach(([map, normalMap, roughnessMap]) => {
    map.colorSpace = THREE.SRGBColorSpace;
    [map, normalMap, roughnessMap].forEach((texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(
        renderer.capabilities.getMaxAnisotropy(),
        8,
      );
    });
  });
  frameWoodMaterials = frameWoodStyles.map((style) => {
    const makeMaps = (rotation) =>
      sources[style.source].map((texture) => {
        const variation = texture.clone();
        variation.center.set(0.5, 0.5);
        variation.rotation =
          frameWoodSources[style.source].rotation + rotation;
        variation.repeat.setScalar(style.repeat);
        variation.offset.fromArray(style.offset);
        variation.needsUpdate = true;
        return variation;
      });
    const makeWood = ([map, normalMap, roughnessMap]) =>
      new THREE.MeshPhysicalMaterial({
        map: style.painted ? null : map,
        normalMap,
        normalScale: new THREE.Vector2(style.normal, style.normal),
        roughnessMap,
        color: new THREE.Color(style.color).multiplyScalar(style.colorBoost ?? 1),
        roughness: style.roughness,
        metalness: 0.02,
        clearcoat: style.clearcoat,
        clearcoatRoughness: Math.min(style.roughness + 0.08, 1),
      });
    return {
      horizontal: makeWood(makeMaps(0)),
      vertical: makeWood(makeMaps(Math.PI / 2)),
    };
  });
}).finally(() => ktx2Loader.dispose());

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const portalEnvironment = pmremGenerator.fromScene(
  new RoomEnvironment(),
  0.04,
).texture;
pmremGenerator.dispose();
modernFrameMaterial.envMap = portalEnvironment;
modernFrameMaterial.envMapIntensity = 0.22;

const glowTexture = createGlowTexture();
const cloudTexture = createCloudTexture();
const waterNormalTexture = createWaterNormalTexture();
const sunTexture = createSunTexture();
const portalLoadingScreen = createPortalLoadingScreen();

const gallery = new THREE.Scene();
gallery.background = new THREE.Color(0x000000);

const galleryCamera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.1,
  50,
);
galleryCamera.position.set(0, GALLERY_CAMERA_HEIGHT, GALLERY_RADIUS_START);
galleryCamera.lookAt(0, 0, 0);

gallery.add(new THREE.HemisphereLight(0xc8c3b4, 0x16130f, 1.6));

const keyLight = new THREE.DirectionalLight(0xffefd0, 3.2);
keyLight.position.set(-3, 6, 6);
gallery.add(keyLight);

const rimLight = new THREE.PointLight(0xb68a52, 24, 12, 2);
rimLight.position.set(3.5, 1.5, 3.5);
gallery.add(rimLight);

let portals = [];
let activeIndex = 0;
let currentPortal = null;
let frameTransition = null;
let advancing = false;
const navigationKeys = new Set();
const touchPointers = new Map();
let pointerDrag = null;
let touchDrag = null;
let touchGesture = null;
let galleryOrbitAngle = 0;
let galleryOrbitTarget = 0;
let galleryPitchAngle = 0;
let galleryPitchTarget = 0;
let galleryRadius = GALLERY_RADIUS_START;
let galleryRadiusTarget = GALLERY_RADIUS_START;
let lastFrameTime = performance.now();
let elapsedTime = 0;
let animationFrameId = null;
let nextFrameAt = performance.now();
let interactionHintTimer = null;

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,.8)");
  gradient.addColorStop(0.5, "rgba(255,255,255,.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  [
    [118, 142, 82],
    [205, 105, 108],
    [286, 128, 98],
    [376, 145, 74],
  ].forEach(([x, y, radius], index) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,245,232,${0.86 - index * 0.07})`);
    gradient.addColorStop(0.48, "rgba(252,231,226,.5)");
    gradient.addColorStop(1, "rgba(255,225,220,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWaterNormalTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const data = image.data;
  const tau = Math.PI * 2;
  const step = tau / size;
  const waveHeight = (x, y) =>
    Math.sin(x * 5 + y * 2.2) * 0.42 +
    Math.sin(x * 11.2 - y * 7.3 + 1.4) * 0.21 +
    Math.sin(x * 19.1 + y * 15.7 + 0.6) * 0.09 +
    Math.sin(x * 31.3 - y * 23.5 + 2.1) * 0.045;

  for (let y = 0; y < size; y += 1) {
    const v = (y / size) * tau;
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * tau;
      const dx = waveHeight(u + step, v) - waveHeight(u - step, v);
      const dy = waveHeight(u, v + step) - waveHeight(u, v - step);
      let nx = -dx * 5.5;
      let ny = -dy * 5.5;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz);
      nx /= length;
      ny /= length;
      nz /= length;

      const offset = (y * size + x) * 4;
      data[offset] = Math.round((nx * 0.5 + 0.5) * 255);
      data[offset + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[offset + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(
    renderer.capabilities.getMaxAnisotropy(),
    8,
  );
  return texture;
}

function createSunTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const center = size / 2;
  const glow = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    size / 2,
  );
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.16, "rgba(255,252,220,1)");
  glow.addColorStop(0.25, "rgba(255,225,150,.98)");
  glow.addColorStop(0.48, "rgba(255,172,86,.28)");
  glow.addColorStop(1, "rgba(255,132,48,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPortalLoadingScreen() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 256;
  const context = canvas.getContext("2d", { alpha: false });
  const noise = context.createImageData(canvas.width, canvas.height);
  const pixels = new Uint32Array(noise.data.buffer);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  let lastUpdate = Number.NEGATIVE_INFINITY;

  const update = (now, active = true) => {
    if (!active || now - lastUpdate < 1000 / 14) return;
    lastUpdate = now;

    let seed = (now * 1000) >>> 0;
    for (let index = 0; index < pixels.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const grain = 24 + (seed >>> 24);
      pixels[index] =
        0xff000000 | (grain << 16) | (grain << 8) | grain;
    }
    context.putImageData(noise, 0, 0);

    context.fillStyle = "rgba(0,0,0,.14)";
    for (let y = 0; y < canvas.height; y += 4) {
      context.fillRect(0, y, canvas.width, 1);
    }
    const panelY = canvas.height / 2 - 22;
    context.fillStyle = "rgba(4,5,4,.82)";
    context.fillRect(26, panelY, canvas.width - 52, 44);
    context.strokeStyle = "rgba(255,255,255,.58)";
    context.lineWidth = 1;
    context.strokeRect(26.5, panelY + 0.5, canvas.width - 53, 43);
    context.fillStyle = "#f4f2ea";
    context.font = "bold 11px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const dots = ".".repeat(1 + Math.floor(now / 280) % 3);
    context.fillText(`LOADING${dots}`, canvas.width / 2, panelY + 22);
    texture.needsUpdate = true;
  };

  update(0);
  return { texture, update };
}

function createPortalLoadingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      loadingMap: { value: portalLoadingScreen.texture },
      transitionProgress: { value: 0 },
      transitionTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 loadingUv;

      void main() {
        loadingUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D loadingMap;
      uniform float transitionProgress;
      uniform float transitionTime;
      varying vec2 loadingUv;

      void main() {
        float progress = clamp(transitionProgress, 0.0, 1.0);
        float motion = sin(progress * 3.14159265);
        float center = 0.5 + sin(transitionTime * 31.0) * motion * 0.0025;
        float distanceFromCenter = abs(loadingUv.y - center);
        float squeeze = smoothstep(0.02, 0.58, progress);
        float halfBand = mix(0.62, 0.0, squeeze);
        float band = 1.0 - smoothstep(halfBand, halfBand + 0.018, distanceFromCenter);
        float edge = exp(-abs(distanceFromCenter - halfBand) * 95.0) * motion;
        float lockLine =
          exp(-distanceFromCenter * 135.0) *
          smoothstep(0.58, 0.84, progress) *
          (1.0 - smoothstep(0.9, 1.0, progress));

        vec2 sampleUv = vec2(loadingUv.x, 1.0 - loadingUv.y);
        float row = floor(sampleUv.y * 52.0);
        float jitter = sin(row * 12.9898 + transitionTime * 29.0) * motion * 0.012;
        sampleUv.x = fract(sampleUv.x + jitter);
        float split = motion * 0.007;
        vec3 staticColor = vec3(
          texture2D(loadingMap, sampleUv + vec2(split, 0.0)).r,
          texture2D(loadingMap, sampleUv).g,
          texture2D(loadingMap, sampleUv - vec2(split, 0.0)).b
        );
        vec3 signalColor =
          staticColor +
          edge * vec3(0.36, 0.64, 1.0) +
          lockLine * vec3(1.0, 0.95, 0.78) * 1.8;
        float alpha = max(band * (1.0 - progress * 0.16), edge * 0.72 + lockLine);

        if (alpha < 0.004) discard;
        gl_FragColor = vec4(signalColor, min(alpha, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function createIonEffect(scene, model) {
  const materials = new Set();
  model.traverse((child) => {
    if (!child.isMesh) return;
    const meshMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    meshMaterials.forEach((material) => materials.add(material));
  });

  materials.forEach((material) => {
    if (material.name === "constant1") {
      material.emissive?.set(0x587aff);
      material.emissiveIntensity = 0.7;
    }
    if (material.name === "constant2") {
      material.emissive?.set(0xffca24);
      material.emissiveIntensity = 1.4;
    }
    if (material.name === "HoloFillDark") {
      material.emissive?.set(0x1746ff);
      material.emissiveIntensity = 0.85;
      material.blending = THREE.AdditiveBlending;
      material.depthWrite = false;
      material.opacity = 0.72;
    }
  });

  const glowData = [
    [-1.3, 0.05, -0.8, 0x2b6cff],
    [0, 0, -0.95, 0xff345c],
    [1.3, -0.05, -0.8, 0xffd42a],
  ];
  const glows = glowData.map(([x, y, z, color]) => {
    const material = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(2.8);
    scene.add(sprite);
    return sprite;
  });

  const lights = glowData.map(([x, y, z, color]) => {
    const light = new THREE.PointLight(color, 2.4, 7, 2);
    light.position.set(x, y, z + 1.1);
    scene.add(light);
    return light;
  });

  const starPositions = new Float32Array(540 * 3);
  for (let i = 0; i < 540; i += 1) {
    starPositions[i * 3] = (Math.random() - 0.5) * 15;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    starPositions[i * 3 + 2] = -2 - Math.random() * 16;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xa8c8ff,
      size: 0.045,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(stars);

  return {
    update(delta, elapsed) {
      model.rotation.y = Math.sin(elapsed * 0.22) * 0.15;
      model.rotation.x = Math.sin(elapsed * 0.16) * 0.055;
      stars.rotation.z += delta * 0.012;
      stars.position.z = (elapsed * 0.14) % 2;
      glows.forEach((glow, index) => {
        const pulse = 0.78 + Math.sin(elapsed * 2.3 + index * 1.8) * 0.22;
        glow.material.opacity = 0.08 + pulse * 0.13;
        glow.scale.setScalar(2.3 + pulse * 0.52);
        lights[index].intensity = 1.4 + pulse * 2.2;
      });
    },
  };
}

function createFortEffect(scene, model) {
  const sources = new Map(model.children.map((child) => [child.name, child]));
  model.clear();

  const addPiece = (name, position, rotation = 0) => {
    const source = sources.get(name);
    if (!source) return null;
    const piece = source.clone();
    piece.position.set(0, 0, 0);
    piece.rotation.set(0, 0, 0);
    piece.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(piece);
    const center = bounds.getCenter(new THREE.Vector3());
    piece.position.set(-center.x, -bounds.min.y, -center.z);

    const pivot = new THREE.Group();
    pivot.position.fromArray(position);
    pivot.rotation.y = rotation;
    pivot.add(piece);
    model.add(pivot);
    return pivot;
  };

  const tower = "modular_fort_01_tower_round";
  const wall = "modular_fort_01_wall_thick_straight_01";
  const corner = "modular_fort_01_wall_thick_corner_02";
  addPiece("modular_fort_01_wall_thin_gate_01", [0, 0, 10], Math.PI / 2);
  addPiece(wall, [-11, 0, 10], Math.PI / 2);
  addPiece(wall, [11, 0, 10], Math.PI / 2);
  addPiece(tower, [-20.5, 0, 7.5]);
  addPiece(tower, [20.5, 0, 7.5]);
  addPiece(wall, [-18.2, 0, 2.7]);
  addPiece(wall, [-18.2, 0, -11.9]);
  addPiece(wall, [18.2, 0, 2.7]);
  addPiece(wall, [18.2, 0, -11.9]);
  addPiece(corner, [-18.2, 0, -19.2]);
  addPiece(corner, [18.2, 0, -19.2], Math.PI / 2);
  addPiece(wall, [-7.3, 0, -19.2], Math.PI / 2);
  addPiece(wall, [7.3, 0, -19.2], Math.PI / 2);
  addPiece("modular_fort_01_wall_stairs_straight_01", [-6, 0, -5.5]);
  addPiece(
    "modular_fort_01_wall_walkway_straight_01",
    [6, 0, -5.5],
    Math.PI,
  );

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 76),
    new THREE.MeshStandardMaterial({
      color: 0x17211c,
      roughness: 0.98,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, -3);
  scene.add(ground);

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deepColor: { value: new THREE.Color(0x06151c) },
      crestColor: { value: new THREE.Color(0x2b7180) },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        float waveA = sin(position.x * 0.34 + time * 1.45) * 0.16;
        float waveB = sin(position.y * 0.48 - time * 1.1) * 0.11;
        vWave = waveA + waveB;
        transformed.z += vWave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 deepColor;
      uniform vec3 crestColor;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float ripple = sin((vUv.x + vUv.y) * 88.0 + time * 2.4) * 0.5 + 0.5;
        float crest = smoothstep(0.12, 0.26, vWave + ripple * 0.045);
        vec3 color = mix(deepColor, crestColor, crest * 0.72 + ripple * 0.08);
        gl_FragColor = vec4(color, 0.94);
      }
    `,
    transparent: true,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 34, 96, 64),
    waterMaterial,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.08, 27);
  scene.add(water);

  const rainCount = 760;
  const rainPositions = new Float32Array(rainCount * 6);
  const rainSpeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i += 1) {
    const x = (Math.random() - 0.5) * 68;
    const y = 2 + Math.random() * 30;
    const z = -28 + Math.random() * 72;
    const offset = i * 6;
    rainPositions[offset] = x;
    rainPositions[offset + 1] = y;
    rainPositions[offset + 2] = z;
    rainPositions[offset + 3] = x + 0.08;
    rainPositions[offset + 4] = y - 0.7 - Math.random() * 0.9;
    rainPositions[offset + 5] = z + 0.18;
    rainSpeeds[i] = 15 + Math.random() * 14;
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3),
  );
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({
      color: 0xa5d7df,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  scene.add(rain);

  const torchPositions = [
    [-5.2, 4.2, 8.7],
    [5.2, 4.2, 8.7],
    [-12.8, 4.6, -5],
    [12.8, 4.6, -5],
    [-8.5, 4.2, -17.5],
    [8.5, 4.2, -17.5],
  ];
  const torches = torchPositions.map((position) => {
    const light = new THREE.PointLight(0xff8a32, 9, 13, 2);
    light.position.fromArray(position);
    scene.add(light);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xff7430,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    sprite.position.fromArray(position);
    sprite.scale.setScalar(1.65);
    scene.add(sprite);
    return { light, sprite };
  });

  const lightning = new THREE.PointLight(0x9fd4ff, 0, 110, 1.5);
  lightning.position.set(-6, 24, 14);
  scene.add(lightning);
  scene.fog = new THREE.FogExp2(0x071419, 0.017);

  return {
    update(delta, elapsed) {
      waterMaterial.uniforms.time.value = elapsed;
      const positions = rainGeometry.attributes.position.array;
      for (let i = 0; i < rainCount; i += 1) {
        const offset = i * 6;
        const travel = rainSpeeds[i] * delta;
        positions[offset + 1] -= travel;
        positions[offset + 4] -= travel;
        if (positions[offset + 4] < 0) {
          positions[offset + 1] += 31;
          positions[offset + 4] += 31;
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;

      torches.forEach(({ light, sprite }, index) => {
        const flicker =
          0.76 +
          Math.sin(elapsed * 8.7 + index * 2.1) * 0.14 +
          Math.sin(elapsed * 17.3 + index) * 0.1;
        light.intensity = 6.5 + flicker * 5;
        sprite.material.opacity = 0.23 + flicker * 0.22;
        sprite.scale.setScalar(1.25 + flicker * 0.55);
      });

      const flash = Math.pow(
        Math.max(0, Math.sin(elapsed * 0.71 - 1.25)),
        42,
      );
      lightning.intensity = flash * 74;
    },
  };
}

function createHallwayEffect(scene, model) {
  const materialSet = new Set();
  model.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => materialSet.add(material));
  });

  materialSet.forEach((material) => {
    const name = material.name.toLowerCase();
    if (name.includes("wall_black")) {
      material.color.set(0x05070b);
      material.metalness = 0.82;
      material.roughness = 0.28;
    } else if (name.includes("roof_white")) {
      material.color.set(0x242730);
      material.metalness = 0.64;
      material.roughness = 0.34;
    } else if (name.includes("wall_blue")) {
      material.color.set(0x09182b);
      material.metalness = 0.72;
    } else if (name.includes("floor")) {
      material.color.set(0x0b0c10);
      material.metalness = 0.86;
      material.roughness = 0.25;
    }

    if (name.includes("vent_light")) {
      material.color.set(0x4a0508);
      material.emissive?.set(0xff1018);
      material.emissiveIntensity = 5.5;
      material.toneMapped = false;
    }
  });

  const alarmStations = [-11.5, -6, -0.5, 5, 10.5].map((z, index) => {
    const color = index % 2 ? 0xff1a10 : 0xff0028;
    const light = new THREE.PointLight(color, 0, 11, 1.7);
    light.position.set(index % 2 ? -2.7 : 2.7, 2.35, z);
    scene.add(light);

    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, 1.5),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88,
        toneMapped: false,
      }),
    );
    beacon.position.set(index % 2 ? -3.75 : 3.75, 2.45, z);
    scene.add(beacon);
    return { light, beacon };
  });

  const scanMaterial = new THREE.MeshBasicMaterial({
    color: 0xff1028,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 5.7), scanMaterial);
  scan.position.set(0, 0, 10);
  scene.add(scan);

  const sparkCount = 180;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkSpeeds = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i += 1) {
    sparkPositions[i * 3] = (Math.random() - 0.5) * 7.2;
    sparkPositions[i * 3 + 1] = -2.5 + Math.random() * 5.4;
    sparkPositions[i * 3 + 2] = -14 + Math.random() * 28;
    sparkSpeeds[i] = 0.7 + Math.random() * 2.8;
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(sparkPositions, 3),
  );
  const sparks = new THREE.Points(
    sparkGeometry,
    new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xffa34a,
      size: 0.075,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  scene.add(sparks);
  scene.fog = new THREE.FogExp2(0x020306, 0.026);

  return {
    update(delta, elapsed) {
      const scanProgress = (elapsed * 0.34) % 1;
      scan.position.z = 11.5 - scanProgress * 27;
      scanMaterial.opacity =
        0.035 + Math.pow(Math.sin(scanProgress * Math.PI), 2) * 0.12;

      alarmStations.forEach(({ light, beacon }, index) => {
        const wave = elapsed * 2.4 - index * 0.72;
        const pulse = Math.pow(Math.max(0, Math.sin(wave)), 8);
        light.intensity = 2 + pulse * 34;
        beacon.material.opacity = 0.18 + pulse * 0.82;
        beacon.scale.x = 0.85 + pulse * 1.7;
      });

      const positions = sparkGeometry.attributes.position.array;
      for (let i = 0; i < sparkCount; i += 1) {
        const offset = i * 3;
        positions[offset + 1] -= sparkSpeeds[i] * delta;
        positions[offset] += Math.sin(elapsed * 5 + i) * delta * 0.08;
        if (positions[offset + 1] < -2.7) {
          positions[offset + 1] = 2.7;
          positions[offset + 2] = -14 + Math.random() * 28;
        }
      }
      sparkGeometry.attributes.position.needsUpdate = true;
    },
  };
}

function createPhoenixEffect(scene, model) {
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x160821) },
      horizonColor: { value: new THREE.Color(0xa63735) },
      lowColor: { value: new THREE.Color(0xf0a35f) },
    },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y * 0.5 + 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 lowColor;
      varying float vHeight;
      void main() {
        vec3 lower = mix(lowColor, horizonColor, smoothstep(0.08, 0.48, vHeight));
        vec3 color = mix(lower, topColor, smoothstep(0.42, 0.96, vHeight));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(88, 40, 24), skyMaterial));

  const gateMaterial = new THREE.MeshStandardMaterial({
    color: 0x251019,
    emissive: 0x7c1f18,
    emissiveIntensity: 0.8,
    roughness: 0.64,
    metalness: 0.24,
  });
  const gates = [
    [0, 0.4, -12, 6.1],
    [-4.5, -0.8, -27, 8.4],
    [6.5, 1.2, -45, 11],
  ].map(([x, y, z, radius], index) => {
    const gate = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.48 + index * 0.12, 14, 64),
      gateMaterial,
    );
    gate.position.set(x, y, z);
    gate.rotation.z = index * 0.46;
    scene.add(gate);
    return gate;
  });

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x261a24,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rocks = Array.from({ length: 18 }, (_, index) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.2 + (index % 4) * 0.42, 1),
      rockMaterial,
    );
    const side = index % 2 ? 1 : -1;
    rock.position.set(
      side * (5.8 + (index % 5) * 2.1),
      -3.8 + (index % 4) * 1.4,
      -8 - index * 2.8,
    );
    rock.scale.y = 0.55 + (index % 3) * 0.22;
    scene.add(rock);
    return rock;
  });

  const clouds = Array.from({ length: 20 }, (_, index) => {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        color: index % 3 === 0 ? 0xffb5a5 : 0xffe5d6,
        transparent: true,
        opacity: 0.2 + (index % 4) * 0.07,
        depthWrite: false,
      }),
    );
    cloud.position.set(
      -18 + (index * 7.3) % 38,
      -5 + (index % 6) * 2.35,
      -7 - (index % 8) * 7.5,
    );
    const scale = 7 + (index % 5) * 3;
    cloud.scale.set(scale * 1.8, scale, 1);
    scene.add(cloud);
    return cloud;
  });

  const trail = Array.from({ length: 26 }, (_, index) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: index % 3 === 0 ? 0xffe86a : 0xff4523,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sprite.scale.setScalar(0.7 + index * 0.035);
    scene.add(sprite);
    return sprite;
  });

  const sun = new THREE.PointLight(0xff7c36, 22, 45, 1.4);
  sun.position.set(-8, 8, 4);
  scene.add(sun);
  const basePosition = model.position.clone();
  const baseRotation = model.rotation.clone();
  scene.fog = new THREE.FogExp2(0x351124, 0.009);

  return {
    update(delta, elapsed) {
      model.position.copy(basePosition);
      model.position.y += Math.sin(elapsed * 0.82) * 0.42;
      model.position.x += Math.sin(elapsed * 0.37) * 0.36;
      model.rotation.copy(baseRotation);
      model.rotation.z += Math.sin(elapsed * 0.7) * 0.08;
      model.rotation.y += Math.sin(elapsed * 0.31) * 0.12;

      gates.forEach((gate, index) => {
        gate.rotation.z += delta * (index % 2 ? -0.045 : 0.035);
      });
      rocks.forEach((rock, index) => {
        rock.rotation.y += delta * (0.035 + (index % 5) * 0.006);
      });
      clouds.forEach((cloud, index) => {
        cloud.position.x += delta * (0.18 + (index % 5) * 0.035);
        if (cloud.position.x > 24) cloud.position.x = -24;
      });
      trail.forEach((sprite, index) => {
        const lag = index * 0.17;
        sprite.position.set(
          basePosition.x - 0.5 - index * 0.11,
          basePosition.y - 0.25 + Math.sin(elapsed * 3.1 - lag) * 0.34,
          basePosition.z - 0.6 - index * 0.42,
        );
        sprite.material.opacity =
          0.07 + (1 - index / trail.length) * 0.3;
      });
      sun.intensity = 18 + Math.sin(elapsed * 3.2) * 4;
    },
  };
}

function createHarborEffect(scene, model, extraModels) {
  const cliffSource = extraModels[0];
  const cliffs = [];
  if (cliffSource) {
    cliffSource.position.set(-17, -5.5, -18);
    cliffSource.rotation.y = 0.18;
    scene.add(cliffSource);
    cliffs.push(cliffSource);

    const oppositeCliff = cliffSource.clone();
    oppositeCliff.position.set(18, -6.2, -25);
    oppositeCliff.rotation.y = Math.PI - 0.3;
    oppositeCliff.scale.multiplyScalar(0.9);
    scene.add(oppositeCliff);
    cliffs.push(oppositeCliff);
  }

  const waterMaterial = new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      time: { value: 0 },
      deepColor: { value: new THREE.Color(0x031722) },
      crestColor: { value: new THREE.Color(0x3e96a0) },
      skyColor: { value: new THREE.Color(0x21414c) },
    },
    vertexShader: `
      uniform float time;
      varying float vWave;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        float a = sin(position.x * 0.28 + time * 1.7) * 0.28;
        float b = sin(position.y * 0.42 - time * 1.15) * 0.18;
        float c = sin((position.x + position.y) * 0.17 + time * 0.8) * 0.12;
        vWave = a + b + c;
        transformed.z += vWave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 deepColor;
      uniform vec3 crestColor;
      uniform vec3 skyColor;
      varying float vWave;
      varying vec2 vUv;
      void main() {
        float stripe = sin((vUv.x * 1.4 + vUv.y) * 180.0 + time * 1.4) * 0.5 + 0.5;
        float crest = smoothstep(0.22, 0.49, vWave + stripe * 0.075);
        float horizon = smoothstep(0.0, 1.0, vUv.y);
        vec3 base = mix(deepColor, skyColor, horizon * 0.34);
        gl_FragColor = vec4(mix(base, crestColor, crest * 0.82), 1.0);
      }
    `,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 110, 128, 128),
    waterMaterial,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -5.65, -12);
  scene.add(water);

  const foam = Array.from({ length: 34 }, (_, index) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xbdeff2,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.position.set(
      -9 + (index % 17) * 1.1,
      -5.25,
      -3.8 + Math.floor(index / 17) * 2.7,
    );
    sprite.scale.set(1.6 + (index % 4) * 0.3, 0.24, 1);
    scene.add(sprite);
    return sprite;
  });

  const sprayPositions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i += 1) {
    sprayPositions[i * 3] = -10 + Math.random() * 20;
    sprayPositions[i * 3 + 1] = -5.1 + Math.random() * 2;
    sprayPositions[i * 3 + 2] = -5 + Math.random() * 9;
  }
  const sprayGeometry = new THREE.BufferGeometry();
  sprayGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(sprayPositions, 3),
  );
  const spray = new THREE.Points(
    sprayGeometry,
    new THREE.PointsMaterial({
      color: 0xb7e9ed,
      size: 0.06,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  scene.add(spray);

  const warmSun = new THREE.DirectionalLight(0xffb77b, 3.8);
  warmSun.position.set(-18, 22, 16);
  scene.add(warmSun);
  const basePosition = model.position.clone();
  const baseRotation = model.rotation.clone();
  scene.fog = new THREE.FogExp2(0x07131b, 0.009);

  return {
    update(delta, elapsed) {
      waterMaterial.uniforms.time.value = elapsed;
      model.position.copy(basePosition);
      model.position.y += Math.sin(elapsed * 0.66) * 0.28;
      model.rotation.copy(baseRotation);
      model.rotation.z += Math.sin(elapsed * 0.58) * 0.035;
      model.rotation.x += Math.sin(elapsed * 0.41) * 0.018;

      foam.forEach((sprite, index) => {
        const flow = (elapsed * (0.28 + (index % 4) * 0.05) + index * 0.17) % 1;
        sprite.position.x += Math.sin(elapsed * 0.8 + index) * delta * 0.12;
        sprite.position.z = -5.2 + flow * 10;
        sprite.material.opacity =
          0.08 + Math.sin(flow * Math.PI) * (0.22 + (index % 3) * 0.04);
      });

      const positions = sprayGeometry.attributes.position.array;
      for (let i = 0; i < 240; i += 1) {
        const offset = i * 3;
        positions[offset + 1] += delta * (0.45 + (i % 7) * 0.1);
        if (positions[offset + 1] > -2.9) positions[offset + 1] = -5.15;
      }
      sprayGeometry.attributes.position.needsUpdate = true;
      warmSun.intensity = 3.3 + Math.sin(elapsed * 0.25) * 0.4;
    },
  };
}

function createForestEffect(scene, model, extraModels) {
  const treeSource = extraModels[0];
  const trees = [];
  if (treeSource) {
    scene.remove(treeSource);
    const placements = [
      [-7.8, -1.9, 3, 1.2],
      [7.2, -1.9, 1, 1.05],
      [-8.4, -1.6, -7, 1.35],
      [8.6, -1.7, -8, 1.22],
      [-6.9, -1.3, -17, 1.08],
      [7.4, -1.4, -19, 1.28],
      [-10.2, -1.2, -29, 1.55],
      [10.5, -1.2, -32, 1.48],
    ];
    placements.forEach(([x, y, z, scale], index) => {
      const tree = index === 0 ? treeSource : treeSource.clone();
      tree.position.set(x, y, z);
      tree.rotation.y = index * 1.17;
      tree.scale.multiplyScalar(scale);
      scene.add(tree);
      trees.push(tree);
    });
  }

  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      nearColor: { value: new THREE.Color(0x111b13) },
      farColor: { value: new THREE.Color(0x07100e) },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        transformed.z += sin(position.x * 0.34) * 0.18 + sin(position.y * 0.2) * 0.22;
        vHeight = transformed.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 nearColor;
      uniform vec3 farColor;
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        float path = smoothstep(0.28, 0.03, abs(vUv.x - 0.5));
        vec3 color = mix(farColor, nearColor, vUv.y);
        color += path * vec3(0.08, 0.07, 0.035);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 78, 48, 96),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -1.7, -18);
  scene.add(ground);

  const fireflyCount = 320;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i += 1) {
    fireflyPositions[i * 3] = (Math.random() - 0.5) * 22;
    fireflyPositions[i * 3 + 1] = -0.6 + Math.random() * 8;
    fireflyPositions[i * 3 + 2] = 4 - Math.random() * 52;
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(fireflyPositions, 3),
  );
  const fireflies = new THREE.Points(
    fireflyGeometry,
    new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xcaff72,
      size: 0.1,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  scene.add(fireflies);

  const moon = new THREE.DirectionalLight(0x8bc0c8, 2.4);
  moon.position.set(-8, 18, 6);
  scene.add(moon);
  const foxGlow = new THREE.PointLight(0xff8c42, 4.5, 8, 2);
  foxGlow.position.copy(model.position).add(new THREE.Vector3(0, 1.4, 1));
  scene.add(foxGlow);
  const basePosition = model.position.clone();
  const baseRotation = model.rotation.clone();
  scene.fog = new THREE.FogExp2(0x07100e, 0.025);

  return {
    update(delta, elapsed) {
      groundMaterial.uniforms.time.value = elapsed;
      model.position.copy(basePosition);
      model.position.x += Math.sin(elapsed * 0.62) * 1.35;
      model.position.z += Math.sin(elapsed * 0.38) * 0.48;
      model.position.y += Math.sin(elapsed * 2.1) * 0.05;
      model.rotation.copy(baseRotation);
      model.rotation.y += Math.sin(elapsed * 0.5) * 0.14;
      foxGlow.position.copy(model.position).add(new THREE.Vector3(0, 1.2, 0.8));
      foxGlow.intensity = 3.8 + Math.sin(elapsed * 3.6) * 0.8;

      trees.forEach((tree, index) => {
        tree.rotation.z = Math.sin(elapsed * 0.45 + index * 0.8) * 0.008;
      });
      const positions = fireflyGeometry.attributes.position.array;
      for (let i = 0; i < fireflyCount; i += 1) {
        const offset = i * 3;
        positions[offset] += Math.sin(elapsed * 0.8 + i * 1.7) * delta * 0.055;
        positions[offset + 1] += Math.cos(elapsed * 0.65 + i) * delta * 0.035;
      }
      fireflyGeometry.attributes.position.needsUpdate = true;
      fireflies.material.opacity = 0.55 + Math.sin(elapsed * 1.2) * 0.15;
    },
  };
}

async function createOrbitEffect(scene, model) {
  const [earthMap, earthNormal, earthSpecular, cloudMap] = await Promise.all([
    textureLoader.loadAsync("/assets/worlds/03-orbit/earth/earth_atmos_2048.jpg"),
    textureLoader.loadAsync("/assets/worlds/03-orbit/earth/earth_normal_2048.jpg"),
    textureLoader.loadAsync("/assets/worlds/03-orbit/earth/earth_specular_2048.jpg"),
    textureLoader.loadAsync("/assets/worlds/03-orbit/earth/earth_clouds_1024.png"),
  ]);
  earthMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  [earthMap, earthNormal, earthSpecular, cloudMap].forEach((texture) => {
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  });

  const earthGroup = new THREE.Group();
  earthGroup.position.set(-2.5, -11.5, -27);
  scene.add(earthGroup);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(16, 96, 64),
    new THREE.MeshPhongMaterial({
      map: earthMap,
      normalMap: earthNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      specularMap: earthSpecular,
      specular: 0x263d59,
      shininess: 7,
    }),
  );
  earth.rotation.z = -0.25;
  earthGroup.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(16.12, 96, 64),
    new THREE.MeshPhongMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  clouds.rotation.z = -0.25;
  earthGroup.add(clouds);

  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 45 + Math.random() * 110;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi);
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xd6e6ff,
      size: 0.16,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  scene.add(stars);

  const sun = new THREE.DirectionalLight(0xeaf2ff, 2.1);
  sun.position.set(-14, 10, 12);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x4d7fff, 0.65);
  rim.position.set(12, -4, -18);
  scene.add(rim);
  const basePosition = model.position.clone();
  const baseRotation = model.rotation.clone();

  return {
    update(delta, elapsed) {
      earth.rotation.y += delta * 0.018;
      clouds.rotation.y += delta * 0.026;
      stars.rotation.y += delta * 0.0025;
      model.position.copy(basePosition);
      model.position.y += Math.sin(elapsed * 0.37) * 0.35;
      model.position.x += Math.sin(elapsed * 0.21) * 0.42;
      model.rotation.copy(baseRotation);
      model.rotation.y += elapsed * 0.035;
      model.rotation.z += Math.sin(elapsed * 0.31) * 0.045;
    },
  };
}

async function createTideEffect(scene, model, extraModels, lighting) {
  const { Sky, Water } = await loadTideModule();
  const [saplingSource, moonModel] = extraModels;
  const { hemisphere, sun, fill } = lighting;

  scene.fog = new THREE.FogExp2(0xa5c5cb, 0.0045);

  const sky = new Sky();
  sky.scale.setScalar(190);
  sky.renderOrder = -100;
  scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 7.5;
  skyUniforms.rayleigh.value = 2.1;
  skyUniforms.mieCoefficient.value = 0.006;
  skyUniforms.mieDirectionalG.value = 0.82;
  skyUniforms.cloudCoverage.value = 0;
  skyUniforms.showSunDisc.value = 0;

  const sunDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTexture,
      color: 0xfff2c5,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sunDisc.scale.set(11, 11, 1);
  sunDisc.renderOrder = -60;
  scene.add(sunDisc);

  const water = new Water(new THREE.PlaneGeometry(150, 185), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: waterNormalTexture,
    sunDirection: new THREE.Vector3(0.4, 0.8, 0.2),
    sunColor: 0xfff1d2,
    waterColor: 0x0d5368,
    distortionScale: 1.65,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.08, -44);
  water.material.uniforms.size.value = 2.25;
  water.receiveShadow = true;
  scene.add(water);

  model.scale.set(0.42, 1.18, 0.52);
  model.position.set(-12.5, -0.85, -9.5);
  model.rotation.y = 1.34;

  const rightCliff = model.clone(true);
  rightCliff.position.set(12.8, -0.95, -11.5);
  rightCliff.rotation.y = -1.34;
  rightCliff.scale.x *= -1;
  scene.add(rightCliff);

  const farCliff = model.clone(true);
  farCliff.position.set(0, -1.15, -47);
  farCliff.rotation.y = 0;
  farCliff.scale.set(0.48, 1.08, 0.56);
  scene.add(farCliff);

  const farCliffLayer = model.clone(true);
  farCliffLayer.position.set(-19, -0.2, -65);
  farCliffLayer.rotation.y = 0.16;
  farCliffLayer.scale.set(0.58, 1.32, 0.62);
  scene.add(farCliffLayer);

  const treePlacements = [
    [-11.6, 6, -12, 3.4, 0.08],
    [11.2, 5.75, -15.5, 3.05, -0.18],
    [-7.5, 6.55, -31, 3.9, 0.16],
    [7.8, 6.3, -35, 3.45, -0.08],
    [-2.8, 6.8, -45, 3.85, 0.22],
  ];
  const trees = treePlacements.map(
    ([x, y, z, scale, rotation], index) => {
      const tree = index === 0 ? saplingSource : saplingSource.clone(true);
      tree.position.set(x, y, z);
      tree.scale.setScalar(scale);
      tree.rotation.y = rotation + index * 1.1;
      if (index > 0) scene.add(tree);
      return tree;
    },
  );
  const treeBaseRotations = trees.map((tree) => tree.rotation.clone());

  const coastMaterials = new Set();
  [
    model,
    rightCliff,
    farCliff,
    farCliffLayer,
    ...trees,
  ].forEach((asset) => {
    asset.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => coastMaterials.add(material));
    });
  });

  const moonLight = new THREE.DirectionalLight(0x8eafff, 0);
  moonLight.position.set(24, 34, 15);
  moonLight.target.position.set(0, 1.5, -24);
  scene.add(moonLight, moonLight.target);

  moonModel.scale.multiplyScalar(2.65);
  moonModel.rotation.set(0.08, -0.42, 0.02);
  moonModel.visible = false;
  const moonMaterials = new Set();
  moonModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const materials = sourceMaterials.map((material) => material.clone());
    child.material = Array.isArray(child.material) ? materials : materials[0];
    materials.forEach((material) => {
      if (material.color) material.color.set(0xffd29a);
      if ("roughness" in material) material.roughness = 0.98;
      if ("metalness" in material) material.metalness = 0;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.025;
      if (material.emissive) {
        material.emissive.set(0x2d1707);
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.1;
      }
      material.needsUpdate = true;
      moonMaterials.add(material);
    });
  });

  const moonSurfaceLight = new THREE.PointLight(
    0xffbd68,
    0,
    78,
    1.45,
  );
  moonSurfaceLight.castShadow = false;
  scene.add(moonSurfaceLight);
  const moonBounceLight = new THREE.HemisphereLight(
    0xffd09a,
    0x101722,
    0,
  );
  moonBounceLight.position.set(0, 1, 0);
  scene.add(moonBounceLight);

  const starCount = 1250;
  const starPositions = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    const seed = (Math.sin(index * 91.731) * 43758.5453) % 1;
    const theta = index * 2.399963 + seed;
    const elevation =
      0.1 + Math.pow((index * 0.61803398875) % 1, 0.72) * 1.35;
    const radius = 112 + ((index * 37) % 21);
    starPositions[index * 3] =
      Math.cos(theta) * Math.cos(elevation) * radius;
    starPositions[index * 3 + 1] = Math.sin(elevation) * radius;
    starPositions[index * 3 + 2] =
      Math.sin(theta) * Math.cos(elevation) * radius - 24;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xe7f0ff,
      size: 0.26,
      transparent: true,
      opacity: 0,
      alphaTest: 0.015,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  stars.renderOrder = -70;
  scene.add(stars);

  const daySun = new THREE.Color(0xffefd0);
  const duskSun = new THREE.Color(0xff8e52);
  const nightSun = new THREE.Color(0x6f8fc7);
  const dayFog = new THREE.Color(0x9fc9d2);
  const duskFog = new THREE.Color(0xd28f78);
  const nightFog = new THREE.Color(0x071425);
  const dayWater = new THREE.Color(0x0d5d74);
  const duskWater = new THREE.Color(0x244b5b);
  const nightWater = new THREE.Color(0x061b2a);
  const nightSkyLight = new THREE.Color(0x54729c);
  const daySkyLight = new THREE.Color(0xdcecff);
  const duskSkyLight = new THREE.Color(0xffc29d);
  const nightGroundLight = new THREE.Color(0x07101b);
  const dayGroundLight = new THREE.Color(0x34412f);
  const nightFill = new THREE.Color(0x486ca5);
  const dayFill = new THREE.Color(0x9ac7da);
  const lightColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const waterColor = new THREE.Color();
  const waterLightDirection = new THREE.Vector3();
  const sunPosition = new THREE.Vector3();
  const moonPosition = new THREE.Vector3();
  const moonSurfaceLightOffset = new THREE.Vector3(0, 4.2, 1.5);
  const cycleStartedAt = performance.now() / 1000;
  let cycleTime = 0;
  let shadowRefresh = 0;

  return {
    dispose() {
      water.dispose?.();
    },
    update(delta) {
      cycleTime = performance.now() / 1000 - cycleStartedAt;
      const cycle =
        (cycleTime / DAY_NIGHT_CYCLE_SECONDS + 0.08) % 1;
      const dayShare = 1 / 3;
      const solarAngle =
        cycle < dayShare
          ? (cycle / dayShare) * Math.PI
          : Math.PI +
            ((cycle - dayShare) / (1 - dayShare)) * Math.PI;
      const sunHeight = Math.sin(solarAngle);
      const daylight = THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.22);
      const night = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.22, 0.05);
      const twilight =
        1 - THREE.MathUtils.smoothstep(Math.abs(sunHeight), 0.02, 0.42);

      sunPosition.set(
        Math.cos(solarAngle) * 40,
        sunHeight * 56,
        -108,
      );
      skyUniforms.sunPosition.value.copy(sunPosition);
      skyUniforms.time.value = cycleTime;
      skyUniforms.turbidity.value = THREE.MathUtils.lerp(
        2.8,
        7.8,
        daylight,
      );
      skyUniforms.rayleigh.value =
        THREE.MathUtils.lerp(0.45, 2.35, daylight) + twilight * 0.65;
      skyUniforms.mieCoefficient.value =
        0.0045 + twilight * 0.006;

      lightColor.lerpColors(nightSun, daySun, daylight);
      lightColor.lerp(duskSun, twilight * 0.82);
      sun.color.copy(lightColor);
      sun.position.copy(sunPosition);
      sun.intensity =
        0.04 + daylight * 5.1 + twilight * 0.45;
      sunDisc.position.copy(sunPosition);
      sunDisc.material.color.copy(lightColor);
      sunDisc.material.opacity = Math.max(
        daylight * 0.94,
        twilight * 0.78,
      );

      hemisphere.color
        .copy(nightSkyLight)
        .lerp(daySkyLight, daylight)
        .lerp(duskSkyLight, twilight * 0.45);
      hemisphere.groundColor
        .copy(nightGroundLight)
        .lerp(dayGroundLight, daylight);
      hemisphere.intensity =
        0.16 + daylight * 1.15 + twilight * 0.18;

      fill.color.copy(nightFill).lerp(dayFill, daylight);
      fill.intensity = 0.16 + daylight * 0.52;

      moonPosition.set(
        -Math.cos(solarAngle) * 6.2,
        -13.4 - Math.sin(solarAngle) * 6.2,
        -38.5,
      );
      const moonReveal = THREE.MathUtils.smoothstep(
        moonPosition.y,
        -10.75,
        -9.25,
      );
      const moonGlow = night * moonReveal;
      moonModel.position.copy(moonPosition);
      moonModel.visible = moonPosition.y > -10.5;
      moonModel.rotation.y = -0.42 - cycleTime * 0.22;
      moonMaterials.forEach((material) => {
        if (material.emissive) {
          material.emissiveIntensity =
            0.025 + moonGlow * 0.095;
        }
      });

      moonSurfaceLight.position
        .copy(moonPosition)
        .add(moonSurfaceLightOffset);
      moonSurfaceLight.intensity = moonGlow * 820;
      moonBounceLight.intensity = moonGlow * 0.16;

      moonLight.position.set(moonPosition.x, 19, -10);
      moonLight.intensity = night * 0.68;

      stars.material.opacity = night;
      stars.rotation.y += delta * 0.0018;

      fogColor.lerpColors(nightFog, dayFog, daylight);
      fogColor.lerp(duskFog, twilight * 0.58);
      scene.fog.color.copy(fogColor);
      scene.fog.density = 0.0042 + night * 0.0024 + twilight * 0.0005;

      waterColor.lerpColors(nightWater, dayWater, daylight);
      waterColor.lerp(duskWater, twilight * 0.55);
      water.material.uniforms.waterColor.value.copy(waterColor);
      water.material.uniforms.sunColor.value.copy(lightColor);
      waterLightDirection
        .copy(night > 0.45 ? moonPosition : sunPosition)
        .normalize();
      water.material.uniforms.sunDirection.value.copy(waterLightDirection);
      water.material.uniforms.time.value += delta * 0.72;
      water.material.uniforms.distortionScale.value =
        1.35 + daylight * 0.4;

      coastMaterials.forEach((material) => {
        material.envMapIntensity = 0.055 + daylight * 0.17;
      });

      trees.forEach((tree, index) => {
        tree.rotation.copy(treeBaseRotations[index]);
        tree.rotation.z +=
          Math.sin(cycleTime * 0.58 + index * 1.37) * 0.0065;
      });

      shadowRefresh += delta;
      if (shadowRefresh > 0.45) {
        sun.shadow.needsUpdate = true;
        shadowRefresh = 0;
      }
    },
  };
}

function createChessEffect(scene, model) {
  const pieceSpecs = [
    [["Pawn_Body_W4", "Pawn_Top_W4"], [0, 0, -0.176]],
    [["Knight_B2"], [-0.176, 0, -0.176]],
    [["Pawn_Body_B5", "Pawn_Top_B5"], [0, 0, 0.176]],
    [["Bishop_W1"], [0.176, 0, -0.176]],
    [["Queen_B"], [-0.088, 0, 0.088]],
    [["Knight_W1"], [0.176, 0, -0.088]],
  ];
  const moves = pieceSpecs
    .map(([names, vector]) => {
      const nodes = names.map((name) => model.getObjectByName(name)).filter(Boolean);
      if (!nodes.length) return null;
      return {
        nodes,
        vector: new THREE.Vector3(...vector),
        bases: nodes.map((node) => node.position.clone()),
      };
    })
    .filter(Boolean);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x6f7cff,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const rings = [2.35, 3.25].map((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.028 + index * 0.012, 8, 96),
      ringMaterial.clone(),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(model.position);
    ring.position.y += 0.95 + index * 0.42;
    scene.add(ring);
    return ring;
  });

  const selector = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xa7b5ff,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  selector.scale.setScalar(1.45);
  scene.add(selector);

  const blueLight = new THREE.PointLight(0x6678ff, 11, 14, 2);
  blueLight.position.set(-3.5, 5, 3.5);
  scene.add(blueLight);
  const roseLight = new THREE.PointLight(0xff4e91, 9, 13, 2);
  roseLight.position.set(3.5, 3.8, -3);
  scene.add(roseLight);
  scene.fog = new THREE.FogExp2(0x070713, 0.018);

  const modelBaseRotation = model.rotation.clone();
  const selectedWorldPosition = new THREE.Vector3();

  return {
    update(delta, elapsed) {
      const moveDuration = 1.55;
      const holdDuration = 0.42;
      const segment = moveDuration + holdDuration;
      const activeMove = Math.floor(elapsed / segment) % Math.max(moves.length, 1);
      const localTime = elapsed % segment;
      const travel = THREE.MathUtils.smoothstep(
        Math.min(localTime / moveDuration, 1),
        0,
        1,
      );

      moves.forEach((move, moveIndex) => {
        move.nodes.forEach((node, nodeIndex) => {
          node.position.copy(move.bases[nodeIndex]);
          node.position.y +=
            Math.sin(elapsed * 1.35 + moveIndex * 0.9) * 0.0025;
          if (moveIndex === activeMove) {
            node.position.addScaledVector(move.vector, travel);
            node.position.y += Math.sin(travel * Math.PI) * 0.065;
          }
        });
      });

      const selected = moves[activeMove]?.nodes[0];
      if (selected) {
        selected.getWorldPosition(selectedWorldPosition);
        selector.position.copy(selectedWorldPosition);
        selector.position.y += 0.7;
      }
      selector.material.opacity = 0.25 + Math.sin(elapsed * 4) * 0.13;
      selector.scale.setScalar(1.1 + Math.sin(elapsed * 3.2) * 0.22);
      rings[0].rotation.z += delta * 0.22;
      rings[1].rotation.z -= delta * 0.14;
      rings.forEach((ring, index) => {
        ring.material.opacity =
          0.12 + Math.sin(elapsed * 1.8 + index * 1.2) * 0.06;
      });
      model.rotation.copy(modelBaseRotation);
      model.rotation.y += Math.sin(elapsed * 0.18) * 0.045;
      blueLight.intensity = 8 + Math.sin(elapsed * 1.7) * 3;
      roseLight.intensity = 7 + Math.cos(elapsed * 1.35) * 2;
    },
  };
}

async function createWorldEffect(
  type,
  scene,
  model,
  extraModels = [],
  lighting = {},
) {
  if (type === "ion") return createIonEffect(scene, model);
  if (type === "hallway") return createHallwayEffect(scene, model);
  if (type === "phoenix") return createPhoenixEffect(scene, model);
  if (type === "harbor") return createHarborEffect(scene, model, extraModels);
  if (type === "forest") return createForestEffect(scene, model, extraModels);
  if (type === "orbit") return createOrbitEffect(scene, model);
  if (type === "tide") {
    return createTideEffect(scene, model, extraModels, lighting);
  }
  if (type === "chess") return createChessEffect(scene, model);
  return null;
}

function createPortalSurfaceMaterial(texture, background) {
  const material = new THREE.MeshBasicMaterial({
    color: texture ? 0xffffff : background,
    map: texture,
    transparent: true,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.portalViewport = {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    };
    shader.uniforms.portalScreenCenter = {
      value: new THREE.Vector2(0.5, 0.5),
    };
    shader.uniforms.portalScreenSize = {
      value: new THREE.Vector2(1, 1),
    };
    shader.uniforms.portalFlipY = {
      value: material.map?.isCanvasTexture ? 1 : 0,
    };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>
uniform vec2 portalViewport;
uniform vec2 portalScreenCenter;
uniform vec2 portalScreenSize;
uniform float portalFlipY;`,
      )
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
  vec2 portalScreenUv = gl_FragCoord.xy / portalViewport;
  vec2 portalMapUv =
    (portalScreenUv - portalScreenCenter) /
      max(portalScreenSize, vec2(0.0001)) +
    0.5;
  portalMapUv.y = mix(
    portalMapUv.y,
    1.0 - portalMapUv.y,
    portalFlipY
  );
  vec2 portalMirrorUv =
    1.0 - abs(mod(portalMapUv, 2.0) - 1.0);
  vec2 portalSafeUv = clamp(
    portalMirrorUv,
    vec2(0.0015),
    vec2(0.9985)
  );
  vec4 sampledDiffuseColor = texture2D(map, portalSafeUv);
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif`,
      );
    material.userData.portalScreenShader = shader;
  };
  material.customProgramCacheKey = () => "portal-screen-window-v3";
  return material;
}

function createFrameDissolveMaterial(
  source,
  outerWidth,
  outerHeight,
) {
  const material = source.clone();
  const dissolve = { value: 0 };
  const halfSize = {
    value: new THREE.Vector2(outerWidth * 0.5, outerHeight * 0.5),
  };
  material.userData.frameDissolve = dissolve;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.frameDissolve = dissolve;
    shader.uniforms.frameDissolveHalfSize = halfSize;
    shader.uniforms.frameDissolveCenterY = { value: FRAME_HOME_Y };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 frameDissolveWorldPosition;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
frameDissolveWorldPosition =
  (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float frameDissolve;
uniform vec2 frameDissolveHalfSize;
uniform float frameDissolveCenterY;
varying vec3 frameDissolveWorldPosition;

float frameDissolveHash(vec2 point) {
  return fract(
    sin(dot(floor(point * 54.0), vec2(127.1, 311.7))) *
      43758.5453123
  );
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec2 framePoint = vec2(
  frameDissolveWorldPosition.x,
  frameDissolveWorldPosition.y - frameDissolveCenterY
);
float frameRadius = clamp(
  abs(framePoint.x) / frameDissolveHalfSize.x,
  0.0,
  1.0
);
float frameVertical = clamp(
  abs(framePoint.y) / frameDissolveHalfSize.y,
  0.0,
  1.0
);
float frameHorizontalBar = step(frameRadius, frameVertical);
float frameEdgeDepth = mix(
  1.0 - frameVertical,
  1.0 - frameRadius,
  frameHorizontalBar
);
float frameNoise =
  frameDissolveHash(framePoint) * 0.22 +
  frameDissolveHash(framePoint * 3.17 + 4.9) * 0.08;
float frameField = clamp(
  frameEdgeDepth * 0.78 + frameNoise,
  0.0,
  1.0
);
float frameScar = frameField - frameDissolve;
if (frameDissolve > 0.001 && frameScar < 0.0) discard;
float frameRim =
  (1.0 - smoothstep(0.0, 0.055, frameScar)) *
  step(0.0, frameScar) *
  step(0.001, frameDissolve);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  vec3(1.0),
  frameRim * 0.72
);`,
      );
  };
  material.customProgramCacheKey = () => "frame-surface-dissolve-v1";
  material.needsUpdate = true;
  return material;
}

function createFrameTransitionDust(
  outerWidth,
  outerHeight,
  apertureWidth,
  apertureHeight,
  index,
  modern,
) {
  const count = window.innerWidth < 700 ? 3200 : 7200;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);
  const topBar = (outerHeight - apertureHeight) * 0.5;
  const sideBar = (outerWidth - apertureWidth) * 0.5;
  const horizontalArea = outerWidth * topBar * 2;
  const verticalArea = sideBar * apertureHeight * 2;
  const horizontalChance =
    horizontalArea / (horizontalArea + verticalArea);
  const baseColor = modern
    ? new THREE.Color(0xcbd0d3)
    : new THREE.Color(frameWoodStyles[index % frameWoodStyles.length].color);

  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    let x;
    let y;
    if (Math.random() < horizontalChance) {
      x = (Math.random() - 0.5) * outerWidth;
      y =
        (Math.random() < 0.5 ? -1 : 1) *
        (apertureHeight * 0.5 + Math.random() * topBar);
    } else {
      x =
        (Math.random() < 0.5 ? -1 : 1) *
        (apertureWidth * 0.5 + Math.random() * sideBar);
      y = (Math.random() - 0.5) * apertureHeight;
    }
    const nx = x / (outerWidth * 0.5);
    const ny = y / (outerHeight * 0.5);
    const edgeDepth =
      Math.abs(ny) >= Math.abs(nx)
        ? 1 - Math.min(Math.abs(nx), 1)
        : 1 - Math.min(Math.abs(ny), 1);
    const speed = 0.8 + Math.random() * 1.45;
    const length = Math.max(Math.hypot(nx, ny), 0.08);

    positions.set([x, y, 0.09 + Math.random() * 0.14], offset);
    velocities.set(
      [
        (nx / length) * speed + (Math.random() - 0.5) * 0.48,
        (ny / length) * speed * 0.15 + 0.55 + Math.random() * 0.75,
        0.48 + Math.random() * 1.25,
      ],
      offset,
    );
    const color = baseColor
      .clone()
      .lerp(new THREE.Color(0xffffff), 0.28 + Math.random() * 0.58);
    colors.set(color.toArray(), offset);
    phases[i] = THREE.MathUtils.clamp(
      edgeDepth * 0.55 + Math.random() * 0.07,
      0,
      0.62,
    );
    sizes[i] = 0.052 + Math.random() * 0.058;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aVelocity", new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  if (import.meta.env.DEV) {
    console.assert(
      geometry.getAttribute("position").count ===
        geometry.getAttribute("aPhase").count,
      "Frame transition dust attributes must stay aligned",
    );
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
    },
    vertexShader: `
      uniform float uProgress;
      attribute vec3 aVelocity;
      attribute float aPhase;
      attribute float aSize;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float life = 0.38;
        float travel = uProgress - aPhase;
        float activeMask =
          step(0.0, travel) * step(travel, life);
        vec3 drift =
          aVelocity * travel * 2.45 +
          vec3(
            sin(travel * 23.0 + position.y * 4.2),
            travel * travel * 2.1,
            cos(travel * 19.0 + position.x * 3.8)
          ) * travel * 0.19;
        vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize =
          aSize *
          (500.0 / max(-mvPosition.z, 0.2)) *
          (1.0 + travel * 2.7);
        vColor = color;
        vAlpha =
          activeMask *
          smoothstep(0.0, 0.045, travel) *
          (1.0 - smoothstep(life * 0.74, life, travel));
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float radius = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.12, 1.0, radius)) * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor * (1.15 + alpha * 1.4), alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    toneMapped: false,
  });
  const dust = new THREE.Points(geometry, material);
  dust.visible = false;
  dust.frustumCulled = false;
  dust.renderOrder = 20;
  return dust;
}

function createFrame(texture, index, modern = false, background = 0x000000) {
  const group = new THREE.Group();
  const outerHeight = 3.6;
  const apertureHeight = modern ? 3.34 : 3.02;
  const apertureWidth = apertureHeight * PORTAL_ASPECT;
  const outerWidth = modern ? apertureWidth + 0.26 : 2.7;
  const sideBar = (outerWidth - apertureWidth) / 2;
  const topBar = (outerHeight - apertureHeight) / 2;

  const materials = frameWoodMaterials[index % frameWoodMaterials.length];
  const frameDissolveUniforms = [];
  const makeFrameMaterial = (source) => {
    const material = createFrameDissolveMaterial(
      source,
      outerWidth,
      outerHeight,
    );
    frameDissolveUniforms.push(material.userData.frameDissolve);
    return material;
  };

  const addBar = (width, height, x, y, depth, material, radius = 0) => {
    const bar = new THREE.Mesh(
      radius
        ? new RoundedBoxGeometry(width, height, depth, 3, radius)
        : new THREE.BoxGeometry(width, height, depth),
      makeFrameMaterial(material),
    );
    bar.position.set(x, y, depth * 0.25);
    group.add(bar);
  };

  if (modern) {
    const frameShape = new THREE.Shape();
    frameShape
      .moveTo(-outerWidth / 2, -outerHeight / 2)
      .lineTo(outerWidth / 2, -outerHeight / 2)
      .lineTo(outerWidth / 2, outerHeight / 2)
      .lineTo(-outerWidth / 2, outerHeight / 2)
      .closePath();
    const aperture = new THREE.Path();
    aperture
      .moveTo(-apertureWidth / 2, -apertureHeight / 2)
      .lineTo(-apertureWidth / 2, apertureHeight / 2)
      .lineTo(apertureWidth / 2, apertureHeight / 2)
      .lineTo(apertureWidth / 2, -apertureHeight / 2)
      .closePath();
    frameShape.holes.push(aperture);
    const frame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(frameShape, {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.018,
        bevelSegments: 3,
        curveSegments: 1,
      }),
      makeFrameMaterial(modernFrameMaterial),
    );
    frame.position.z = 0.025;
    group.add(frame);
  } else {
    addBar(
      outerWidth,
      topBar,
      0,
      (outerHeight - topBar) / 2,
      0.24,
      materials.horizontal,
      0.035,
    );
    addBar(
      outerWidth,
      topBar,
      0,
      -(outerHeight - topBar) / 2,
      0.24,
      materials.horizontal,
      0.035,
    );
    addBar(
      sideBar,
      apertureHeight,
      -(outerWidth - sideBar) / 2,
      0,
      0.24,
      materials.vertical,
      0.035,
    );
    addBar(
      sideBar,
      apertureHeight,
      (outerWidth - sideBar) / 2,
      0,
      0.24,
      materials.vertical,
      0.035,
    );
  }

  const portalSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(apertureWidth, apertureHeight),
    createPortalSurfaceMaterial(texture, background),
  );
  portalSurface.position.z = -0.015;
  group.add(portalSurface);

  const loadingSurface = new THREE.Mesh(
    portalSurface.geometry,
    createPortalLoadingMaterial(),
  );
  loadingSurface.position.z = -0.005;
  group.add(loadingSurface);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(apertureWidth, apertureHeight),
    new THREE.MeshBasicMaterial({
      color: 0xbfd6db,
      transparent: true,
      opacity: 0.018,
      depthWrite: false,
    }),
  );
  glass.position.z = 0.145;
  group.add(glass);

  const transitionDust = createFrameTransitionDust(
    outerWidth,
    outerHeight,
    apertureWidth,
    apertureHeight,
    index,
    modern,
  );
  group.add(transitionDust);

  group.userData = {
    glass,
    portalSurface,
    loadingSurface,
    transitionDust,
    frameDissolveUniforms,
    outerHeight,
    apertureWidth,
    apertureHeight,
    index,
  };
  return group;
}

function createPortalScene(config) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.background);
  return scene;
}

function createPortalShell(config, index) {
  const scene = createPortalScene(config);

  const camera = new THREE.PerspectiveCamera(
    config.fov,
    PORTAL_ASPECT,
    config.near ?? 0.01,
    config.far ?? 1000,
  );
  camera.position.fromArray(config.camera);
  const baseCamera = camera.position.clone();
  const target = new THREE.Vector3().fromArray(config.target);
  const viewDirection = target.clone().sub(baseCamera).normalize();
  const windowTarget = target.clone();
  windowTarget.y += config.centerTargetLift ?? 0;
  const windowCamera = baseCamera
    .clone()
    .addScaledVector(viewDirection, config.push ?? 0);
  const windowForward = windowTarget
    .clone()
    .sub(windowCamera)
    .normalize();
  const windowRight = windowForward
    .clone()
    .cross(camera.up)
    .normalize();
  const windowUp = windowRight
    .clone()
    .cross(windowForward)
    .normalize();
  const windowNormal = windowForward.clone().negate();
  const windowDistance = windowCamera.distanceTo(windowTarget);
  const windowLookPoint = new THREE.Vector3();
  camera.lookAt(target);

  const frame = createFrame(null, index, config.modernFrame, config.background);
  frame.visible = false;
  gallery.add(frame);

  return {
    config,
    scene,
    camera,
    baseCamera,
    viewDirection,
    target,
    windowTarget,
    windowCamera,
    windowForward,
    windowRight,
    windowUp,
    windowNormal,
    windowDistance,
    windowLookPoint,
    mixers: [],
    effect: null,
    composer: null,
    renderTarget: null,
    frame,
    index,
    offset: 0,
    loaded: false,
    loadedAt: 0,
    loadPromise: null,
    loadError: null,
    releasePromise: null,
    keepResident: false,
    resourceDisposers: [],
    lastRenderAt: Number.NEGATIVE_INFINITY,
    lastRenderedView: Number.NaN,
    lastRenderedPitch: Number.NaN,
    lastRenderedDepth: Number.NaN,
    lastUpdateAt: performance.now(),
    dynamic: false,
    forceRender: true,
    hasRendered: false,
    retired: false,
  };
}

function allocatePortalRenderTarget(portal) {
  if (portal.renderTarget) return portal.renderTarget;

  const [renderWidth, renderHeight] = portalRenderSize();
  const renderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
  renderTarget.texture.minFilter = THREE.LinearFilter;
  renderTarget.texture.magFilter = THREE.LinearFilter;
  renderTarget.texture.generateMipmaps = false;
  portal.renderTarget = renderTarget;
  portal.forceRender = true;
  return renderTarget;
}

async function loadPortalContent(portal, index) {
  const { config, scene, camera, mixers, frame } = portal;
  if (!config.htmlScene) allocatePortalRenderTarget(portal);
  const renderTarget = portal.renderTarget;
  let effect = null;

  if (config.htmlScene) {
    const iframe = document.createElement("iframe");
    iframe.src = config.htmlScene;
    iframe.title = "小岛远足实时场景";
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:0;top:0;width:1208px;height:1600px;" +
      "border:0;pointer-events:none;opacity:.001;transform:translateX(-110%);";
    const loaded = new Promise((resolve, reject) => {
      iframe.addEventListener("load", resolve, { once: true });
      iframe.addEventListener("error", reject, { once: true });
    });
    document.body.append(iframe);
    await loaded;

    const sourceCanvas = iframe.contentDocument.querySelector("#c");
    const copyCanvas = document.createElement("canvas");
    copyCanvas.width = sourceCanvas.width;
    copyCanvas.height = sourceCanvas.height;
    const copyContext = copyCanvas.getContext("2d");
    copyContext.imageSmoothingEnabled = false;
    const texture = new THREE.CanvasTexture(copyCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.repeat.y = -1;
    texture.offset.y = 1;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    const surfaceMaterial = frame.userData.portalSurface.material;
    surfaceMaterial.color.set(0xffffff);
    surfaceMaterial.map = texture;
    surfaceMaterial.needsUpdate = true;

    copyContext.drawImage(
      sourceCanvas,
      0,
      0,
      copyCanvas.width,
      copyCanvas.height,
    );
    texture.needsUpdate = true;
    portal.hasRendered = true;

    let active = false;
    iframe.contentWindow.postMessage(
      { type: "portal-active", value: false },
      location.origin,
    );
    effect = {
      update() {
        if (!active) return;
        copyContext.drawImage(
          sourceCanvas,
          0,
          0,
          copyCanvas.width,
          copyCanvas.height,
        );
        texture.needsUpdate = true;
      },
      setView(value, depth = 0, pitch = 0) {
        iframe.contentWindow.postMessage(
          { type: "portal-view", value, depth, pitch },
          location.origin,
        );
      },
      setActive(value) {
        if (active === value) return;
        active = value;
        iframe.contentWindow.postMessage(
          { type: "portal-active", value },
          location.origin,
        );
      },
      dispose() {
        active = false;
        iframe.contentWindow?.postMessage(
          { type: "portal-active", value: false },
          location.origin,
        );
        const sourceContext =
          sourceCanvas.getContext("webgl2") ?? sourceCanvas.getContext("webgl");
        sourceContext
          ?.getExtension("WEBGL_lose_context")
          ?.loseContext();
        texture.dispose();
        texture.source.data = null;
        copyCanvas.width = 1;
        copyCanvas.height = 1;
        iframe.remove();
      },
    };
  } else if (config.splat) {
    const { SparkRenderer, SplatMesh } = await loadSparkModule();
    const spark = new SparkRenderer({ renderer });
    scene.add(spark);

    const splat = new SplatMesh({ url: config.splat });
    splat.quaternion.set(1, 0, 0, 0);
    splat.position.fromArray(config.splatPosition);
    splat.scale.setScalar(config.splatScale);
    scene.add(splat);
    await splat.initialized;
    portal.resourceDisposers.push(async () => {
      spark.autoUpdate = false;
      spark.enableDriveLod = false;
      spark.enableLodFetching = false;
      spark.sortDirty = false;
      spark.lodDirty = false;
      spark.visible = false;
      splat.visible = false;
      if (spark.updateTimeoutId !== -1) {
        clearTimeout(spark.updateTimeoutId);
        spark.updateTimeoutId = -1;
      }
      if (spark.sortTimeoutId !== -1) {
        clearTimeout(spark.sortTimeoutId);
        spark.sortTimeoutId = -1;
      }
      const releaseDeadline = performance.now() + 1500;
      while (
        (spark.sorting || spark.numLodFetchers > 0) &&
        performance.now() < releaseDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      splat.dispose();
      spark.dispose();
    });
  } else {
    const loadAsset = async (spec) => {
      if (!portal.keepResident) {
        throw new DOMException("Portal no longer resident", "AbortError");
      }
      const gltf = await gltfLoader.loadAsync(spec.model);
      const model = gltf.scene;
      scene.add(model);
      if (!portal.keepResident) {
        throw new DOMException("Portal no longer resident", "AbortError");
      }
      model.scale.setScalar(spec.modelScale ?? 1);
      model.updateMatrixWorld(true);

      if (spec.normalizeSize) {
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension > 0) {
          model.scale.multiplyScalar(spec.normalizeSize / maxDimension);
          model.updateMatrixWorld(true);
        }
      }

      if (spec.centerModel) {
        const center = new THREE.Box3()
          .setFromObject(model)
          .getCenter(new THREE.Vector3());
        model.position.sub(center);
      }
      model.position.add(
        new THREE.Vector3().fromArray(spec.modelPosition ?? [0, 0, 0]),
      );

      if (spec.animate && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const animation =
          gltf.animations[
            Math.min(spec.animationIndex ?? 0, gltf.animations.length - 1)
          ];
        const action = mixer.clipAction(animation);
        action.timeScale = spec.animationSpeed ?? 1;
        action.play();
        mixers.push(mixer);
      }

      return model;
    };

    const model = await loadAsset(config);
    const extraModels = [];
    for (const spec of config.extraAssets ?? []) {
      extraModels.push(await loadAsset(spec));
    }
    const lightScale = config.lightScale ?? 1;

    const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    [model, ...extraModels].forEach((asset) => {
      asset.traverse((child) => {
        if (!child.isMesh) return;
        if (config.shadows) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => {
          material.envMapIntensity = config.envMapIntensity ?? 0.55;
          if (material.normalMap && config.normalIntensity) {
            material.normalScale.multiplyScalar(config.normalIntensity);
          }
          ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"].forEach(
            (key) => {
              if (material[key]) material[key].anisotropy = anisotropy;
            },
          );
        });
      });
    });

    scene.environment = portalEnvironment;
    const hemisphere = new THREE.HemisphereLight(
      0xfff4df,
      0x2b211b,
      (config.hemisphereIntensity ?? 1.8) * lightScale,
    );
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(
      0xffe7c4,
      (config.sunIntensity ?? 4.2) * lightScale,
    );
    sun.position.fromArray(config.sunPosition ?? [-8, 16, 7]);
    if (config.sunTarget) {
      sun.target.position.fromArray(config.sunTarget);
      scene.add(sun.target);
    }
    if (config.shadows) {
      sun.castShadow = true;
      const shadowMapSize = config.shadowMapSize ?? 2048;
      sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      sun.shadow.camera.left = -20;
      sun.shadow.camera.right = 20;
      sun.shadow.camera.top = 14;
      sun.shadow.camera.bottom = -14;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 50;
      sun.shadow.bias = -0.0002;
      sun.shadow.normalBias = 0.035;
      sun.shadow.radius = 2.5;
      sun.shadow.autoUpdate = false;
      sun.shadow.needsUpdate = true;
    }
    scene.add(sun);

    const fill = new THREE.DirectionalLight(
      0x9fb9d6,
      (config.fillIntensity ?? 1.2) * lightScale,
    );
    fill.position.set(8, 5, -10);
    scene.add(fill);

    (config.lightPools ?? []).forEach((poolConfig) => {
      const pool = new THREE.SpotLight(
        0xffe3b5,
        poolConfig.intensity * lightScale,
        14,
        0.55,
        0.82,
        2,
      );
      pool.position.fromArray(poolConfig.position);
      pool.target.position.fromArray(poolConfig.target);
      scene.add(pool, pool.target);
    });

    effect = await createWorldEffect(
      config.effect,
      scene,
      model,
      extraModels,
      { hemisphere, sun, fill },
    );
  }

  const renderWidth = renderTarget?.width ?? 0;
  const renderHeight = renderTarget?.height ?? 0;

  let composer = null;
  if (config.bloom) {
    const { EffectComposer, RenderPass, UnrealBloomPass } =
      await loadBloomModule();
    composer = new EffectComposer(renderer, renderTarget);
    composer.renderToScreen = false;
    composer.setPixelRatio(1);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(renderWidth, renderHeight),
      config.bloom.strength,
      config.bloom.radius,
      config.bloom.threshold,
    );
    [
      bloomPass.renderTargetBright,
      ...bloomPass.renderTargetsHorizontal,
      ...bloomPass.renderTargetsVertical,
    ].forEach((target) => {
      target.depthBuffer = false;
      target.stencilBuffer = false;
    });
    composer.addPass(bloomPass);
    composer.readBuffer.texture.colorSpace = THREE.SRGBColorSpace;
  }

  if (renderTarget) {
    const previousTarget = renderer.getRenderTarget();
    if (composer) {
      composer.render();
    } else {
      renderer.setRenderTarget(renderTarget);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    }
    renderer.setRenderTarget(previousTarget);
    portal.hasRendered = true;
    const surfaceMaterial = frame.userData.portalSurface.material;
    surfaceMaterial.color.set(0xffffff);
    surfaceMaterial.map = composer
      ? composer.readBuffer.texture
      : renderTarget.texture;
    surfaceMaterial.needsUpdate = true;
  }
  portal.effect = effect;
  portal.composer = composer;
  portal.loaded = true;
  portal.loadedAt = performance.now();
  portal.loadError = null;
  portal.dynamic =
    Boolean(effect) ||
    mixers.length > 0 ||
    config.idleCamera !== false;
  portal.forceRender = true;
  portal.lastUpdateAt = performance.now();
  return portal;
}

const persistentPortalTextures = new Set([
  portalEnvironment,
  glowTexture,
  cloudTexture,
  waterNormalTexture,
  sunTexture,
  portalLoadingScreen.texture,
]);

function disposePortalScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const textureSources = new Set();
  const skeletons = new Set();

  const collectTexture = (value) => {
    if (value?.isTexture && !persistentPortalTextures.has(value)) {
      textures.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(collectTexture);
    }
  };

  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    if (object.shadow?.map) object.shadow.map.dispose();
    if (object.shadow?.mapPass) object.shadow.mapPass.dispose();

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach(collectTexture);
      Object.values(material.uniforms ?? {}).forEach((uniform) => {
        collectTexture(uniform?.value);
      });
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    const source = texture.source;
    if (source && !textureSources.has(source)) {
      textureSources.add(source);
      source.data?.close?.();
      source.data = null;
    }
  });
  scene.clear();
}

function releasePortal(portal) {
  if (portal.releasePromise) return portal.releasePromise;
  if (!portal.loaded && !portal.loadError) {
    if (!portal.loadPromise) return null;
    return portal.loadPromise.then(() =>
      portal.keepResident ? null : releasePortal(portal),
    );
  }

  const surfaceMaterial = portal.frame.userData.portalSurface.material;
  surfaceMaterial.map = null;
  surfaceMaterial.color.set(portal.config.background);
  surfaceMaterial.needsUpdate = true;
  const loadingSurface = portal.frame.userData.loadingSurface;
  loadingSurface.visible = false;
  loadingSurface.material.uniforms.transitionProgress.value = 0;
  portal.loaded = false;
  portal.loadedAt = 0;

  const disposers = portal.resourceDisposers.splice(0);
  portal.releasePromise = (async () => {
    portal.effect?.setActive?.(false);
    portal.effect?.dispose?.();
    for (const dispose of disposers) {
      try {
        await dispose();
      } catch (error) {
        console.warn("作品资源释放失败", error);
      }
    }
    portal.mixers.forEach((mixer) => {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    });
    portal.mixers.length = 0;
    disposePortalScene(portal.scene);

    if (portal.composer) {
      portal.composer.passes.forEach((pass) => pass.dispose?.());
      portal.composer.dispose();
    } else {
      portal.renderTarget?.dispose();
    }

    portal.scene = portal.retired ? null : createPortalScene(portal.config);
    portal.effect = null;
    portal.composer = null;
    portal.renderTarget = null;
    portal.loadPromise = null;
    portal.loadError = null;
    portal.lastRenderAt = Number.NEGATIVE_INFINITY;
    portal.lastRenderedView = Number.NaN;
    portal.lastRenderedPitch = Number.NaN;
    portal.lastRenderedDepth = Number.NaN;
    portal.lastUpdateAt = performance.now();
    portal.dynamic = false;
    portal.forceRender = true;
    portal.hasRendered = false;
    renderer.renderLists.dispose();
  })()
    .catch((error) => {
      console.error("作品资源释放中断", error);
    })
    .finally(() => {
      portal.releasePromise = null;
      if (portal.keepResident && !portal.retired) {
        void ensurePortalLoaded(portal.index);
      }
    });
  return portal.releasePromise;
}

function ensurePortalLoaded(index) {
  const portal = portals[index];
  if (!portal || portal.retired) return Promise.resolve(portal);
  if (!portal.keepResident) return Promise.resolve(portal);
  if (portal.releasePromise) {
    return portal.releasePromise.then(() =>
      ensurePortalLoaded(index),
    );
  }
  if (portal.loaded) return Promise.resolve(portal);
  if (!portal.loadPromise) {
    portal.loadError = null;
    const loadAttempt = loadPortalContent(portal, index).catch(
      (error) => {
        portal.loadError = error;
        if (error.name !== "AbortError") {
          console.error(`作品 ${index + 1} 加载失败`, error);
        }
        return portal;
      },
    );
    portal.loadPromise = loadAttempt;
    loadAttempt.finally(() => {
      if (portal.loadPromise !== loadAttempt) return;
      portal.loadPromise = null;
      if (portal.loaded) {
        if (!portal.keepResident) releasePortal(portal);
        return;
      }
      if (portal.keepResident && portal.loadError?.name === "AbortError") {
        void ensurePortalLoaded(index);
      } else if (!portal.keepResident && portal.loadError) {
        releasePortal(portal);
      }
    });
  }
  return portal.loadPromise;
}

function setPortalCamera(portal) {
  const idleSpeed = portal.config.idleSpeed ?? PORTAL_IDLE_SPEED;
  const idlePhase = portal.index * 0.71;
  const idleScale = reduceMotion ? 0 : 1;
  galleryCamera.updateMatrixWorld(true);
  portal.frame.updateWorldMatrix(true, false);
  portalSourceEye
    .copy(galleryCamera.position);
  portal.frame.worldToLocal(portalSourceEye);

  const sourceRadius = Math.max(
    Math.hypot(portalSourceEye.x, portalSourceEye.z),
    0.0001,
  );
  const sourceDistance = Math.max(portalSourceEye.length(), 0.0001);
  const sourceAngle = Math.atan2(
    portalSourceEye.x,
    portalSourceEye.z,
  );
  const sourcePitch =
    Math.atan2(portalSourceEye.y, sourceRadius) - GALLERY_BASE_PITCH;
  const linkedAngle = THREE.MathUtils.clamp(
    sourceAngle +
      Math.sin(elapsedTime * idleSpeed + idlePhase) *
        PORTAL_IDLE_ORBIT *
        idleScale,
    -GALLERY_ORBIT_LIMIT,
    GALLERY_ORBIT_LIMIT,
  );
  const linkedPitch = THREE.MathUtils.clamp(
    sourcePitch +
      Math.sin(elapsedTime * idleSpeed * 0.61 + idlePhase + 0.8) *
        PORTAL_IDLE_PITCH *
        idleScale,
    -GALLERY_PITCH_LIMIT,
    GALLERY_PITCH_LIMIT,
  );
  const depth = galleryDepth(sourceDistance);
  const linkedView = viewFromPortalEye(linkedAngle);

  // The interior eye is a permanent point in its world. The exterior
  // viewer only changes its viewing direction and the angular aperture
  // through the frame; it never translates this camera.
  portal.camera.position.copy(portal.windowCamera);
  portal.camera.up.copy(portal.windowUp);
  portalLinkedRight
    .copy(portal.windowRight)
    .applyAxisAngle(portal.windowUp, linkedAngle);
  portal.windowLookPoint
    .copy(portal.windowForward)
    .applyAxisAngle(portal.windowUp, linkedAngle)
    .applyAxisAngle(portalLinkedRight, -linkedPitch)
    .multiplyScalar(portal.windowDistance)
    .add(portal.windowCamera);
  portal.camera.lookAt(portal.windowLookPoint);

  // Match the angular size of the exterior aperture. Approaching the
  // frame widens the fixed interior camera's FOV; moving away narrows it.
  // The look anchor stays unchanged, so the distant centre never drifts.
  const baseFov = THREE.MathUtils.degToRad(
    portal.config.centerFov ?? portal.config.fov,
  );
  const apertureScale = GALLERY_RADIUS_START / sourceDistance;
  const linkedFov = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(baseFov * 0.5) * apertureScale),
  );
  portal.camera.fov = THREE.MathUtils.clamp(
    linkedFov,
    portal.config.minLinkedFov ?? 24,
    portal.config.maxLinkedFov ?? 78,
  );
  portal.camera.aspect = PORTAL_ASPECT;
  portal.camera.updateProjectionMatrix();

  portalViewState.view = linkedView;
  portalViewState.pitch = linkedPitch / GALLERY_PITCH_LIMIT;
  portalViewState.depth = depth;
  portal.effect?.setView?.(
    portalViewState.view,
    portalViewState.depth,
    portalViewState.pitch,
  );
  return portalViewState;
}

function viewFromPortalEye(angle) {
  return -THREE.MathUtils.clamp(
    angle / GALLERY_ORBIT_LIMIT,
    -1,
    1,
  );
}

function galleryDepth(radius = galleryRadius) {
  if (radius <= GALLERY_RADIUS_START) {
    return THREE.MathUtils.clamp(
      (GALLERY_RADIUS_START - radius) /
        (GALLERY_RADIUS_START - GALLERY_RADIUS_MIN),
      0,
      1,
    );
  }
  return THREE.MathUtils.clamp(
    -(radius - GALLERY_RADIUS_START) /
      (GALLERY_RADIUS_MAX - GALLERY_RADIUS_START),
    -1,
    0,
  );
}

function renderPortal(portal) {
  if (!portal.loaded || !portal.renderTarget) return;
  if (portal.composer) {
    portal.composer.render();
    portal.frame.userData.portalSurface.material.map =
      portal.composer.readBuffer.texture;
    portal.hasRendered = true;
    return;
  }
  renderer.setRenderTarget(portal.renderTarget);
  renderer.clear(true, true, true);
  renderer.render(portal.scene, portal.camera);
  portal.hasRendered = true;
}

const portalSampleViewport = new THREE.Vector2();
const portalSampleCenter = new THREE.Vector3();
const portalSampleScale = new THREE.Vector3();
const portalSourceEye = new THREE.Vector3();
const portalLinkedRight = new THREE.Vector3();
const portalViewState = { view: 0, pitch: 0, depth: 0 };
const interactionHintAnchor = new THREE.Vector3();
const interactionHintFramePosition = new THREE.Vector3();
const interactionHintFrameQuaternion = new THREE.Quaternion();

function showInteractionHint() {
  if (!interactionHint) return;
  if (interactionHintTimer !== null) {
    window.clearTimeout(interactionHintTimer);
  }
  interactionHint.classList.add("is-visible");
  interactionHintTimer = window.setTimeout(() => {
    interactionHint.classList.remove("is-visible");
    interactionHintTimer = null;
  }, INTERACTION_HINT_DURATION);
}

function hideInteractionHint() {
  if (!interactionHint) return;
  if (interactionHintTimer !== null) {
    window.clearTimeout(interactionHintTimer);
    interactionHintTimer = null;
  }
  interactionHint.classList.remove("is-visible");
}

function updateInteractionHintPosition() {
  const frame = currentPortal?.frame;
  if (!interactionHint?.classList.contains("is-visible") || !frame?.visible) {
    return;
  }

  frame.updateWorldMatrix(true, false);
  frame.getWorldPosition(interactionHintFramePosition);
  frame.getWorldQuaternion(interactionHintFrameQuaternion);
  interactionHintAnchor
    .set(0, -frame.userData.outerHeight * 0.5, 0)
    .applyQuaternion(interactionHintFrameQuaternion)
    .add(interactionHintFramePosition)
    .project(galleryCamera);

  const x = THREE.MathUtils.clamp(
    (interactionHintAnchor.x * 0.5 + 0.5) * window.innerWidth,
    16,
    window.innerWidth - 16,
  );
  const y = THREE.MathUtils.clamp(
    (-interactionHintAnchor.y * 0.5 + 0.5) * window.innerHeight + 18,
    24,
    window.innerHeight - 36,
  );
  interactionHint.style.left = `${x}px`;
  interactionHint.style.top = `${y}px`;
}

function updatePortalWindowSampling(portal) {
  const frame = portal.frame;
  const surface = frame?.userData.portalSurface;
  const shader = surface?.material.userData.portalScreenShader;
  if (!shader) return;

  galleryCamera.updateMatrixWorld(true);
  frame.updateWorldMatrix(true, false);
  portalSampleCenter
    .set(0, 0, 0)
    .applyMatrix4(frame.matrixWorld);
  frame.getWorldScale(portalSampleScale);
  const distance = Math.max(
    galleryCamera.position.distanceTo(portalSampleCenter),
    0.01,
  );
  portalSampleCenter.project(galleryCamera);

  const halfFovTangent = Math.tan(
    THREE.MathUtils.degToRad(galleryCamera.fov) * 0.5,
  );
  const apertureWidth = frame.userData.apertureWidth;
  const apertureHeight = frame.userData.apertureHeight;
  const screenWidth =
    (apertureWidth * portalSampleScale.x) /
    (2 * distance * halfFovTangent * galleryCamera.aspect);
  const screenHeight =
    (apertureHeight * portalSampleScale.y) /
    (2 * distance * halfFovTangent);

  renderer.getDrawingBufferSize(portalSampleViewport);
  shader.uniforms.portalViewport.value.copy(portalSampleViewport);
  shader.uniforms.portalScreenCenter.value.set(
    portalSampleCenter.x * 0.5 + 0.5,
    portalSampleCenter.y * 0.5 + 0.5,
  );
  shader.uniforms.portalScreenSize.value.set(
    Math.max(screenWidth, 0.0001),
    Math.max(screenHeight, 0.0001),
  );
  shader.uniforms.portalFlipY.value =
    surface.material.map?.isCanvasTexture ? 1 : 0;
}

function updatePortal(portal, now) {
  if (!portal || portal.retired || !portal.frame) return;
  const visible = portal === currentPortal;
  portal.frame.visible = visible;
  portal.effect?.setActive?.(
    visible && portal.loaded && !document.hidden,
  );
  if (!visible) return;

  const loadingSurface = portal.frame.userData.loadingSurface;
  if (portal.loaded) {
    const progress = THREE.MathUtils.clamp(
      (now - portal.loadedAt) / 760,
      0,
      1,
    );
    loadingSurface.visible = progress < 1;
    loadingSurface.material.uniforms.transitionProgress.value = progress;
  } else {
    loadingSurface.visible = true;
    loadingSurface.material.uniforms.transitionProgress.value = 0;
  }
  loadingSurface.material.uniforms.transitionTime.value = elapsedTime;

  const transitionDuration = frameTransition?.duration ?? 0;
  const transitionProgress = frameTransition
    ? transitionDuration === 0
      ? 1
      : THREE.MathUtils.clamp(
          (now - frameTransition.startedAt) / transitionDuration,
          0,
          1,
        )
    : 0;
  const dissolveAmount = frameTransition?.kind === "exit"
    ? transitionProgress
    : 0;
  const transitionDust = portal.frame.userData.transitionDust;
  transitionDust.visible =
    frameTransition?.kind === "exit" &&
    transitionProgress < 1 &&
    !reduceMotion;
  transitionDust.material.uniforms.uProgress.value = transitionProgress;
  portal.frame.userData.frameDissolveUniforms.forEach((uniform) => {
    uniform.value = dissolveAmount;
  });
  const portalOpacity =
    1 -
    THREE.MathUtils.smoothstep(
      dissolveAmount,
      0.045,
      0.42,
    );
  portal.frame.userData.portalSurface.material.opacity = portalOpacity;
  portal.frame.userData.glass.material.opacity = 0.018 * portalOpacity;
  portal.frame.position.set(0, FRAME_HOME_Y, 0);
  portal.frame.rotation.set(0, 0, 0);
  const entranceScale = frameTransition?.kind === "enter"
    ? 0.06 + 0.94 * (1 - (1 - transitionProgress) ** 3)
    : 1;
  portal.frame.scale.setScalar(entranceScale);
  updatePortalWindowSampling(portal);

  const { view: u, pitch, depth } = setPortalCamera(portal);

  if (!portal.loaded) return;
  const viewChanged =
    !Number.isFinite(portal.lastRenderedView) ||
    Math.abs(portal.lastRenderedView - u) > 0.0005;
  const depthChanged =
    !Number.isFinite(portal.lastRenderedDepth) ||
    Math.abs(portal.lastRenderedDepth - depth) > 0.0005;
  const pitchChanged =
    !Number.isFinite(portal.lastRenderedPitch) ||
    Math.abs(portal.lastRenderedPitch - pitch) > 0.0005;
  if (
    !portal.dynamic &&
    !frameTransition &&
    !portal.forceRender &&
    !viewChanged &&
    !pitchChanged &&
    !depthChanged
  ) {
    return;
  }

  const renderInterval = portal.config.htmlScene
    ? HTML_PORTAL_FRAME_INTERVAL
    : 0;
  if (
    !portal.forceRender &&
    now - portal.lastRenderAt < renderInterval
  ) {
    return;
  }

  const portalDelta = Math.min((now - portal.lastUpdateAt) / 1000, 0.1);
  portal.lastUpdateAt = now;
  portal.mixers.forEach((mixer) => mixer.update(portalDelta));
  portal.effect?.update(portalDelta, elapsedTime);
  if (portal.renderTarget) renderPortal(portal);
  portal.lastRenderAt = now;
  portal.lastRenderedView = u;
  portal.lastRenderedPitch = pitch;
  portal.lastRenderedDepth = depth;
  portal.forceRender = false;
}

function updateActiveStatus() {
  activeWorldStatus.value = `作品 ${activeIndex + 1} / ${WORLDS.length}`;
  const finalWork = activeIndex === WORLDS.length - 1;
  nextButton.querySelector(".next-label").textContent = finalWork
    ? "FINISH"
    : "NEXT";
  nextButton.setAttribute(
    "aria-label",
    finalWork ? "结束本次展览" : "浏览完成，进入下一幅作品",
  );
}

function disposePortalFrame(portal) {
  const frame = portal.frame;
  if (!frame) return;
  const sharedMaterials = new Set([
    modernFrameMaterial,
    ...frameWoodMaterials.flatMap(({ horizontal, vertical }) => [
      horizontal,
      vertical,
    ]),
  ]);
  const geometries = new Set();
  const materials = new Set();
  frame.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials
      .filter((material) => material && !sharedMaterials.has(material))
      .forEach((material) => materials.add(material));
  });
  gallery.remove(frame);
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  frame.clear();
  portal.frame = null;
}

function beginFrameTransition(kind) {
  const duration = reduceMotion ? 0 : FRAME_TRANSITION_DURATION;
  frameTransition = {
    kind,
    duration,
    startedAt: performance.now(),
  };
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function retirePortal(portal) {
  portal.retired = true;
  portal.keepResident = false;
  await releasePortal(portal);
  disposePortalFrame(portal);
}

async function advanceExhibition() {
  if (advancing || !currentPortal) return;
  advancing = true;
  nextButton.disabled = true;
  navigationKeys.clear();
  resetPointerNavigation();
  showInteractionHint();
  galleryOrbitTarget = 0;
  galleryPitchTarget = 0;
  galleryRadiusTarget = GALLERY_RADIUS_START;

  const outgoing = currentPortal;
  await beginFrameTransition("exit");
  outgoing.frame.visible = false;
  const release = retirePortal(outgoing);

  activeIndex += 1;
  if (activeIndex >= portals.length) {
    currentPortal = null;
    frameTransition = null;
    hideInteractionHint();
    completion.hidden = false;
    document.body.classList.add("exhibition-complete");
    activeWorldStatus.value = "感谢观看，刷新页面可再次浏览";
    await release;
    advancing = false;
    return;
  }

  currentPortal = portals[activeIndex];
  currentPortal.frame.visible = true;
  updateActiveStatus();
  const entrance = beginFrameTransition("enter");
  await release;

  currentPortal.keepResident = true;
  const loadedPortal = await ensurePortalLoaded(activeIndex);
  await entrance;
  frameTransition = null;
  nextButton.disabled = false;
  advancing = false;

  if (!loadedPortal.loaded) {
    activeWorldStatus.value =
      `作品 ${activeIndex + 1} 加载失败，可继续跳过`;
  }
}

function queueAnimationFrame() {
  if (!document.hidden && animationFrameId === null) {
    animationFrameId = requestAnimationFrame(animate);
  }
}

function updateGalleryNavigation(delta) {
  if (!advancing && currentPortal) {
    const orbitDirection =
      Number(navigationKeys.has("KeyD")) -
      Number(navigationKeys.has("KeyA"));
    const radialDirection =
      Number(navigationKeys.has("KeyS")) -
      Number(navigationKeys.has("KeyW"));

    galleryOrbitTarget = THREE.MathUtils.clamp(
      galleryOrbitTarget +
        orbitDirection * GALLERY_ORBIT_SPEED * delta,
      -GALLERY_ORBIT_LIMIT,
      GALLERY_ORBIT_LIMIT,
    );
    galleryRadiusTarget = THREE.MathUtils.clamp(
      galleryRadiusTarget +
        radialDirection * GALLERY_RADIAL_SPEED * delta,
      GALLERY_RADIUS_MIN,
      GALLERY_RADIUS_MAX,
    );
  }

  galleryOrbitAngle = THREE.MathUtils.damp(
    galleryOrbitAngle,
    galleryOrbitTarget,
    8,
    delta,
  );
  galleryPitchAngle = THREE.MathUtils.damp(
    galleryPitchAngle,
    galleryPitchTarget,
    8,
    delta,
  );
  galleryRadius = THREE.MathUtils.damp(
    galleryRadius,
    galleryRadiusTarget,
    8,
    delta,
  );
  const cameraPitch = GALLERY_BASE_PITCH + galleryPitchAngle;
  const horizontalRadius = Math.cos(cameraPitch) * galleryRadius;
  galleryCamera.position.set(
    Math.sin(galleryOrbitAngle) * horizontalRadius,
    FRAME_HOME_Y + Math.sin(cameraPitch) * galleryRadius,
    Math.cos(galleryOrbitAngle) * horizontalRadius,
  );
  galleryCamera.lookAt(0, FRAME_HOME_Y, 0);
}

function animate(now) {
  animationFrameId = null;
  if (document.hidden) return;
  queueAnimationFrame();

  const frameInterval = 1000 / MAX_FRAME_RATE;
  if (now + 0.5 < nextFrameAt) return;
  if (now - nextFrameAt > frameInterval * 2) nextFrameAt = now;
  nextFrameAt += frameInterval;

  const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  elapsedTime += delta;

  updateGalleryNavigation(delta);
  updatePortal(currentPortal, now);
  updateInteractionHintPosition();
  portalLoadingScreen.update(
    now,
    Boolean(
      currentPortal?.frame?.visible &&
      currentPortal.frame.userData.loadingSurface.visible,
    ),
  );

  renderer.setRenderTarget(null);
  renderer.render(gallery, galleryCamera);
}

function resize() {
  renderer.setPixelRatio(rendererPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  galleryCamera.aspect = window.innerWidth / window.innerHeight;
  const narrow = window.innerWidth <= 720;
  const compact = window.innerWidth < 1120;
  galleryCamera.fov = narrow ? 52 : compact ? 46 : 38;
  galleryCamera.updateProjectionMatrix();
}

function normalizedGestureInput(delta, range) {
  return THREE.MathUtils.clamp(
    (delta / Math.max(range, 1)) * GALLERY_GESTURE_SENSITIVITY,
    -1,
    1,
  );
}

if (import.meta.env.DEV) {
  console.assert(
    normalizedGestureInput(-2, 1) === -1 &&
      normalizedGestureInput(2, 1) === 1,
    "Gallery gesture input must clamp symmetrically",
  );
}

function applyViewInput(
  startOrbitTarget,
  startPitchTarget,
  startRadiusTarget,
  orbitInput,
  pitchInput,
  radialInput,
) {
  galleryOrbitTarget = THREE.MathUtils.lerp(
    startOrbitTarget,
    orbitInput < 0
      ? -GALLERY_ORBIT_LIMIT
      : GALLERY_ORBIT_LIMIT,
    Math.abs(orbitInput),
  );
  galleryPitchTarget = THREE.MathUtils.lerp(
    startPitchTarget,
    pitchInput < 0 ? -GALLERY_PITCH_LIMIT : GALLERY_PITCH_LIMIT,
    Math.abs(pitchInput),
  );
  galleryRadiusTarget = THREE.MathUtils.lerp(
    startRadiusTarget,
    radialInput < 0
      ? GALLERY_RADIUS_MIN
      : GALLERY_RADIUS_MAX,
    Math.abs(radialInput),
  );
}

function currentTouchMetrics() {
  const [first, second] = touchPointers.values();
  return {
    centerX: (first.x + second.x) * 0.5,
    centerY: (first.y + second.y) * 0.5,
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  };
}

function beginTouchGesture() {
  if (touchPointers.size !== 2) {
    touchGesture = null;
    return;
  }
  const metrics = currentTouchMetrics();
  touchGesture = {
    ...metrics,
    orbitTarget: galleryOrbitTarget,
    pitchTarget: galleryPitchTarget,
    radiusTarget: galleryRadiusTarget,
  };
}

function beginTouchDrag(pointerId, x, y) {
  touchDrag = {
    id: pointerId,
    x,
    y,
    orbitTarget: galleryOrbitTarget,
    pitchTarget: galleryPitchTarget,
    radiusTarget: galleryRadiusTarget,
  };
}

function resetPointerNavigation() {
  pointerDrag = null;
  touchDrag = null;
  touchGesture = null;
  touchPointers.clear();
  stage.classList.remove("is-dragging");
}

window.addEventListener("blur", () => {
  navigationKeys.clear();
  resetPointerNavigation();
});
document.addEventListener("visibilitychange", () => {
  navigationKeys.clear();
  resetPointerNavigation();
  if (document.hidden) {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    portals.forEach((portal) => portal.effect?.setActive?.(false));
    return;
  }

  const now = performance.now();
  lastFrameTime = now;
  nextFrameAt = now;
  portals.forEach((portal) => {
    portal.lastUpdateAt = now;
    portal.forceRender = portal.loaded;
  });
  queueAnimationFrame();
});

nextButton.addEventListener("click", () => void advanceExhibition());
stage.addEventListener("pointerdown", (event) => {
  if (advancing || !currentPortal) return;
  if (event.pointerType === "touch") {
    touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    stage.setPointerCapture?.(event.pointerId);
    if (touchPointers.size === 1) {
      beginTouchDrag(event.pointerId, event.clientX, event.clientY);
    } else if (touchPointers.size === 2) {
      touchDrag = null;
      beginTouchGesture();
    } else {
      touchDrag = null;
      touchGesture = null;
    }
    event.preventDefault();
    return;
  }
  if (event.button !== 0) return;
  event.preventDefault();
  pointerDrag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    orbitTarget: galleryOrbitTarget,
    pitchTarget: galleryPitchTarget,
    radiusTarget: galleryRadiusTarget,
  };
  stage.classList.add("is-dragging");
  stage.setPointerCapture?.(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") {
    if (!touchPointers.has(event.pointerId)) return;
    touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (touchPointers.size === 2) {
      if (!touchGesture) beginTouchGesture();
      const metrics = currentTouchMetrics();
      applyViewInput(
        touchGesture.orbitTarget,
        touchGesture.pitchTarget,
        touchGesture.radiusTarget,
        normalizedGestureInput(
          touchGesture.centerX - metrics.centerX,
          Math.max(window.innerWidth * GALLERY_DRAG_RANGE, 120),
        ),
        normalizedGestureInput(
          metrics.centerY - touchGesture.centerY,
          Math.max(window.innerHeight * GALLERY_DRAG_RANGE, 120),
        ),
        normalizedGestureInput(
          touchGesture.distance - metrics.distance,
          Math.max(touchGesture.distance * GALLERY_PINCH_RANGE, 48),
        ),
      );
    } else if (touchPointers.size === 1) {
      if (touchDrag?.id !== event.pointerId) {
        beginTouchDrag(event.pointerId, event.clientX, event.clientY);
      }
      applyViewInput(
        touchDrag.orbitTarget,
        touchDrag.pitchTarget,
        touchDrag.radiusTarget,
        normalizedGestureInput(
          touchDrag.x - event.clientX,
          Math.max(window.innerWidth * GALLERY_DRAG_RANGE, 120),
        ),
        normalizedGestureInput(
          event.clientY - touchDrag.y,
          Math.max(window.innerHeight * GALLERY_DRAG_RANGE, 120),
        ),
        0,
      );
    }
    event.preventDefault();
    return;
  }
  if (event.pointerId !== pointerDrag?.id) return;
  applyViewInput(
    pointerDrag.orbitTarget,
    pointerDrag.pitchTarget,
    pointerDrag.radiusTarget,
    normalizedGestureInput(
      pointerDrag.x - event.clientX,
      Math.max(window.innerWidth * GALLERY_DRAG_RANGE, 160),
    ),
    normalizedGestureInput(
      event.clientY - pointerDrag.y,
      Math.max(window.innerHeight * GALLERY_DRAG_RANGE, 160),
    ),
    0,
  );
  event.preventDefault();
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
  stage.addEventListener(eventName, (event) => {
    if (event.pointerType === "touch") {
      if (!touchPointers.delete(event.pointerId)) return;
      if (touchPointers.size === 2) {
        touchDrag = null;
        beginTouchGesture();
      } else if (touchPointers.size === 1) {
        touchGesture = null;
        const [remainingId, remaining] = touchPointers.entries().next().value;
        beginTouchDrag(remainingId, remaining.x, remaining.y);
      } else {
        touchDrag = null;
        touchGesture = null;
      }
      return;
    }
    if (event.pointerId !== pointerDrag?.id) return;
    pointerDrag = null;
    stage.classList.remove("is-dragging");
  });
});
stage.addEventListener(
  "wheel",
  (event) => {
    if (advancing || !currentPortal) return;
    event.preventDefault();
    const pixelDelta =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? window.innerHeight
          : 1);
    applyViewInput(
      galleryOrbitTarget,
      galleryPitchTarget,
      galleryRadiusTarget,
      0,
      0,
      normalizedGestureInput(pixelDelta, GALLERY_WHEEL_RANGE),
    );
  },
  { passive: false },
);

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (GALLERY_NAVIGATION_CODES.has(event.code)) {
    event.preventDefault();
    if (!event.repeat) {
      const orbitStep = THREE.MathUtils.degToRad(2.4);
      if (event.code === "KeyA") {
        galleryOrbitTarget = Math.max(
          galleryOrbitTarget - orbitStep,
          -GALLERY_ORBIT_LIMIT,
        );
      } else if (event.code === "KeyD") {
        galleryOrbitTarget = Math.min(
          galleryOrbitTarget + orbitStep,
          GALLERY_ORBIT_LIMIT,
        );
      } else if (event.code === "KeyW") {
        galleryRadiusTarget = Math.max(
          galleryRadiusTarget - 0.22,
          GALLERY_RADIUS_MIN,
        );
      } else if (event.code === "KeyS") {
        galleryRadiusTarget = Math.min(
          galleryRadiusTarget + 0.22,
          GALLERY_RADIUS_MAX,
        );
      }
    }
    navigationKeys.add(event.code);
    return;
  }
  if (event.target.closest?.("button")) return;
  if (event.key === "ArrowRight" || event.code === "Space") {
    if (event.repeat) return;
    if (event.code === "Space") event.preventDefault();
    void advanceExhibition();
  }
});
window.addEventListener("keyup", (event) => {
  navigationKeys.delete(event.code);
});
window.addEventListener("resize", resize);
resize();

async function start() {
  await frameWoodReady;
  portals = WORLDS.map(createPortalShell);
  if (import.meta.env.DEV) {
    window.__PORTAL_DEBUG__ = () =>
      portals.map((portal) => ({
        index: portal.index,
        active: portal === currentPortal,
        retired: portal.retired,
        resident: portal.keepResident,
        loaded: portal.loaded,
        loading: Boolean(portal.loadPromise),
        releasing: Boolean(portal.releasePromise),
        error: portal.loadError?.name ?? null,
        hasFrame: Boolean(portal.frame),
      }));
  }
  currentPortal = portals[0];
  currentPortal.frame.visible = true;
  currentPortal.keepResident = true;
  const firstPortal = await ensurePortalLoaded(0);
  if (!firstPortal.loaded) throw firstPortal.loadError;
  loadProgress.style.width = "100%";
  loadValue.value = "100%";

  for (let pass = 0; pass < 3; pass += 1) {
    portals.forEach((portal) => {
      if (!portal.loaded || !portal.renderTarget) return;
      setPortalCamera(portal);
      renderPortal(portal);
    });
    await new Promise(requestAnimationFrame);
  }
  updateActiveStatus();
  document.body.classList.add("ready");
  interfaceElement.inert = false;
  showInteractionHint();
  advancing = true;
  nextButton.disabled = true;
  const initialEntrance = beginFrameTransition("enter");
  lastFrameTime = performance.now();
  nextFrameAt = lastFrameTime;
  queueAnimationFrame();
  await initialEntrance;
  frameTransition = null;
  advancing = false;
  nextButton.disabled = false;
}

start().catch((error) => {
  console.error(error);
  document.querySelector("#loading span").textContent = "3D SCENE LOAD FAILED";
  loadValue.value = "请检查 WebGL2 与本地素材";
});
