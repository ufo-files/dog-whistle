const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const sphereCanvas = document.getElementById("sphere");
const playButton = document.getElementById("play");
const pulseButton = document.getElementById("pulse");
const appSwitcher = document.getElementById("app-switcher");
const binauralInput = document.getElementById("binaural");
const visualizationInput = document.getElementById("visualization");
const volumeInput = document.getElementById("volume");
const statusEl = document.getElementById("status");
const layerToggleInputs = Array.from(document.querySelectorAll(".layer-toggle"));
const layerFrequencyInputs = Array.from(document.querySelectorAll(".layer-frequency-input"));

const TWO_PI = Math.PI * 2;
const THREE_CDN_URL = "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
const VISUAL_HISTORY_LENGTH = 4096;
const WORKLET_FRAME_SIZE = 15;
const TRACE_RGB = "17, 17, 17";
const CARRIER_VISUAL_REFERENCE_GAIN = .115;
const SPHERE_RADIUS = 1.18;
const SPHERE_CAMERA_Z = 4.8;
const SPHERE_CAMERA_FOV_DEGREES = 38;
const SPHERE_WAVE_SCALE = 1.18;
const SPHERE_ENERGY_SCALE = .62;
const SPHERE_SAMPLE_SMOOTHING = .017;
const SPHERE_TEMPORAL_BLEND = .3;
const SPHERE_LAYER_TEMPORAL_BLEND = {
  carrier: .08,
  chirp: .78,
};
const SPHERE_POSITION_BLEND = .34;
const SPHERE_LAYER_POSITION_BLEND = {
  breath: .12,
  carrier: .22,
  ping: .82,
  chirp: .86,
};
const SPHERE_LED_SIZE = .026;
const SPHERE_LED_COUNT = 84000;
const SPHERE_UPDATE_INTERVAL_MS = 16;
const SPHERE_GLOBAL_OPACITY_SCALE = .58;
const SPHERE_NON_BREATH_DOT_SCALE = 1;
const SPHERE_NON_BREATH_OPACITY_SCALE = .56;
const SPHERE_HARMONIC_ORBIT_RADIUS = .13;
const SPHERE_HARMONIC_DOT_SCALE = .72;
const SPHERE_HARMONIC_TRAIL_COUNT = 20;
const SPHERE_HARMONIC_TRAIL_FRAME_STEP = 3;
const SPHERE_HARMONIC_TRAIL_STRIDE = 1;
const SPHERE_HARMONIC_ORBIT_SPEED = 3;
const SPHERE_HARMONIC_TRAIL_ABSORB_DISTANCE = .3;
const SPHERE_HARMONIC_TRAIL_ABSORB_STRENGTH = .32;
const SPHERE_DEFAULT_ORBIT_RADIUS = .045;
const SPHERE_DEFAULT_ORBIT_SPEED = 1.6;
const SPHERE_ORBIT_BASE_DRIVE = .72;
const SPHERE_ORBIT_BASE_STEP = .018;
const SPHERE_PAD_ORBIT_RADIUS = .065;
const SPHERE_PAD_ORBIT_SPEED = 1.4;
const SPHERE_BREATH_POINT_SCALE = .42;
const SPHERE_BREATH_OPACITY_SCALE = .78;
const SPHERE_BREATH_SWELL_SCALE = .18;
const SPHERE_BREATH_ORBIT_RADIUS = .064;
const SPHERE_BREATH_ORBIT_SPEED = 1.65;
const SPHERE_BREATH_ORBIT_STEP = .034;
const SPHERE_BREATH_ORBIT_SLOPE_REFERENCE = .003;
const SPHERE_BREATH_ORBIT_MIN_DRIVE = .38;
const SPHERE_CHIRP_ORBIT_RADIUS = .18;
const SPHERE_CHIRP_ORBIT_SPEED = 3;
const SPHERE_CHIRP_DOT_SCALE = .78;
const SPHERE_CHIRP_IDLE_ORBIT_DRIVE = .34;
const SPHERE_CHIRP_IDLE_ORBIT_STEP = .014;
const SPHERE_CHIRP_ORBIT_LIFT_SCALE = .04;
const SPHERE_CHIRP_DARKEN_SCALE = .34;
const SPHERE_CHIRP_LIFT_TWIST_SCALE = .42;
const SPHERE_PING_DOT_SCALE = .58;
const SPHERE_PING_JUMP_SCALE = .22;
const SPHERE_PING_JUMP_ATTACK = .68;
const SPHERE_PING_JUMP_RELEASE = .52;
const SPHERE_PLASMA_PHASE_SPEED = .011;
const SPHERE_PLASMA_LAYER_PHASE = {
  carrier: 0,
  pad: .19,
  harmonic: .37,
  chirp: .58,
};
const SPHERE_EVENT_LAYER_VISIBILITY = {
  ping: { reference: .01, floor: 0 },
  chirp: { reference: .018, floor: 0 },
};
const SPHERE_LAYER_GAIN = {
  carrier: 1,
  pad: 1.08,
  harmonic: 1.18,
  ping: 3.6,
  chirp: 1.75,
  breath: 1.3,
};
const SPHERE_LAYER_ENERGY_GAIN = {
  carrier: .48,
  pad: .55,
  harmonic: .68,
  ping: 2.8,
  chirp: 1.7,
  breath: .9,
};
const SPHERE_LAYER_RADIAL_SCALE = {
  carrier: .035,
  pad: .42,
  harmonic: .05,
  ping: .28,
  chirp: .16,
  breath: 0,
};
const SPHERE_BREATH_CORE_RADIUS = .34;
const LAYER_DEFAULTS = {
  carrier: { enabled: true, frequency: 100, min: 20, max: 1000, step: .01, unit: "Hz" },
  pad: { enabled: true, frequency: 432, min: 20, max: 20000, step: .01, unit: "Hz" },
  harmonic: { enabled: true, frequency: 528, min: 20, max: 20000, step: .01, unit: "Hz" },
  ping: { enabled: true, frequency: 17000, min: 1000, max: 20000, step: 1, unit: "Hz" },
  chirp: { enabled: true, frequency: 2500, min: 100, max: 12000, step: 1, unit: "Hz" },
  breath: { enabled: true, frequency: 16, min: 4, max: 40, step: .1, unit: "sec" },
};
const SPHERE_PHASE_AXES = [
  { x: .742, y: .284, z: .607, weight: .34, offset: .07 },
  { x: -.386, y: .813, z: .436, weight: .31, offset: .29 },
  { x: .184, y: -.514, z: .838, weight: .21, offset: .53 },
  { x: -.681, y: -.421, z: .598, weight: .14, offset: .76 },
];
const DISPLAY_CHANNELS = [
  { id: "left", label: "L", alpha: .76, width: 1.6, y: .42 },
  { id: "right", label: "R", alpha: .46, width: 1.2, y: .62 },
];
const DISPLAY_LAYERS = [
  { id: "carrier", label: "100", alpha: loudnessAlpha(.115), width: loudnessStroke(.115) },
  { id: "pad", label: "432", alpha: loudnessAlpha(.035), width: loudnessStroke(.035) },
  { id: "harmonic", label: "528", alpha: loudnessAlpha(.014), width: loudnessStroke(.014) },
  { id: "ping", label: "17k", alpha: loudnessAlpha(.029), width: loudnessStroke(.029) },
  { id: "chirp", label: "2.5k", alpha: loudnessAlpha(.058), width: loudnessStroke(.058) },
  { id: "breath", label: "air", alpha: loudnessAlpha(.068), width: loudnessStroke(.068) },
];

const state = {
  audio: null,
  processor: null,
  master: null,
  playing: false,
  mode: "idle",
  binaural: binauralInput.checked,
  visualization: visualizationInput.value,
  volume: Number(volumeInput.value),
  layers: createLayerSettings(),
  startedAt: performance.now() / 1000,
  audioStartTime: 0,
  liveWriteIndex: 0,
  liveChannels: createLiveChannels(VISUAL_HISTORY_LENGTH),
  liveLayers: createLiveLayers(VISUAL_HISTORY_LENGTH),
  liveBreathEnvelope: new Float32Array(VISUAL_HISTORY_LENGTH),
};

const sphereState = {
  loading: false,
  ready: false,
  error: "",
  THREE: null,
  renderer: null,
  scene: null,
  camera: null,
  mesh: null,
  ledLayers: [],
  plasmaPhase: 0,
  lastGeometryUpdate: 0,
};

async function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error("Web Audio is not supported in this browser.");

  const audio = new AudioContext();
  const master = audio.createGain();
  if (!audio.audioWorklet) throw new Error("AudioWorklet is not supported in this browser.");
  await audio.audioWorklet.addModule("audio-worklet.js");
  const processor = new AudioWorkletNode(audio, "dog-whistle-processor", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  master.gain.value = 0;
  processor.port.onmessage = (event) => writeWorkletFrameBlock(event.data);
  processor.port.postMessage({ type: "binaural", value: state.binaural });
  sendLayerSettings(processor);

  processor.connect(master).connect(audio.destination);
  state.audio = audio;
  state.processor = processor;
  state.master = master;
}

function createLiveChannels(length) {
  return DISPLAY_CHANNELS.reduce((channels, channel) => {
    channels[channel.id] = new Float32Array(length);
    return channels;
  }, {});
}

function createLiveLayers(length) {
  return DISPLAY_LAYERS.reduce((layers, layer) => {
    layers[layer.id] = {
      left: new Float32Array(length),
      right: new Float32Array(length),
    };
    return layers;
  }, {});
}

function createLayerSettings() {
  return Object.entries(LAYER_DEFAULTS).reduce((settings, [id, defaults]) => {
    settings[id] = {
      enabled: defaults.enabled,
      frequency: defaults.frequency,
    };
    return settings;
  }, {});
}

function ensureLiveChannelSize() {
  if (state.liveChannels.left.length === VISUAL_HISTORY_LENGTH) return;
  state.liveWriteIndex = 0;
  state.liveChannels = createLiveChannels(VISUAL_HISTORY_LENGTH);
  state.liveLayers = createLiveLayers(VISUAL_HISTORY_LENGTH);
  state.liveBreathEnvelope = new Float32Array(VISUAL_HISTORY_LENGTH);
}

function writeWorkletFrameBlock(block) {
  if (!block || !block.length) return;
  ensureLiveChannelSize();

  for (let offset = 0; offset < block.length; offset += WORKLET_FRAME_SIZE) {
    const index = state.liveWriteIndex;
    state.liveChannels.left[index] = block[offset];
    state.liveChannels.right[index] = block[offset + 1];
    state.liveLayers.carrier.left[index] = block[offset + 2];
    state.liveLayers.carrier.right[index] = block[offset + 3];
    state.liveLayers.harmonic.left[index] = block[offset + 4];
    state.liveLayers.harmonic.right[index] = block[offset + 5];
    state.liveLayers.ping.left[index] = block[offset + 6];
    state.liveLayers.ping.right[index] = block[offset + 7];
    state.liveLayers.chirp.left[index] = block[offset + 8];
    state.liveLayers.chirp.right[index] = block[offset + 9];
    state.liveLayers.pad.left[index] = block[offset + 10];
    state.liveLayers.pad.right[index] = block[offset + 11];
    state.liveLayers.breath.left[index] = block[offset + 12];
    state.liveLayers.breath.right[index] = block[offset + 13];
    state.liveBreathEnvelope[index] = block[offset + 14];
    state.liveWriteIndex = (index + 1) % VISUAL_HISTORY_LENGTH;
  }
}

function readLiveSamples(samples) {
  const start = state.liveWriteIndex % samples.length;
  const ordered = new Float32Array(samples.length);
  ordered.set(samples.subarray(start), 0);
  ordered.set(samples.subarray(0, start), samples.length - start);
  return ordered;
}

function smoothstep(value) {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function hashNoise(index) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function setButtonState() {
  playButton.textContent = state.mode === "straight" ? "Stop" : "Play";
  pulseButton.textContent = state.mode === "pulse" ? "Stop" : "Pulse";
  playButton.classList.toggle("active", state.mode === "straight");
  pulseButton.classList.toggle("active", state.mode === "pulse");
  pulseButton.setAttribute("aria-pressed", String(state.mode === "pulse"));
  binauralInput.checked = state.binaural;
}

function setLayerControlState() {
  layerToggleInputs.forEach((input) => {
    const layerId = input.dataset.layer;
    const setting = state.layers[layerId];
    if (!setting) return;
    input.checked = setting.enabled;
    const control = document.querySelector('[data-layer-control="' + layerId + '"]');
    if (control) control.classList.toggle("disabled", !setting.enabled);
  });

  layerFrequencyInputs.forEach((input) => {
    const layerId = input.dataset.layer;
    const defaults = LAYER_DEFAULTS[layerId];
    const setting = state.layers[layerId];
    if (!defaults || !setting) return;
    input.value = formatInputNumber(setting.frequency, defaults.step);
  });
}

function sendLayerSettings(processor = state.processor) {
  if (!processor) return;
  processor.port.postMessage({
    type: "layers",
    layers: state.layers,
  });
}

function updateMasterGain() {
  if (!state.master || !state.audio) return;
  state.master.gain.setTargetAtTime(state.volume, state.audio.currentTime, .03);
}

async function startPlayback(mode) {
  try {
    if (!state.audio) await createAudio();
    if (state.audio.state === "suspended") await state.audio.resume();
  } catch (error) {
    statusEl.textContent = error.message || "Audio unavailable";
    return;
  }

  state.playing = true;
  state.mode = mode;
  state.startedAt = state.audio.currentTime;
  state.audioStartTime = state.audio.currentTime;
  statusEl.textContent = mode === "pulse" ? "Active / pulsed audio" : "Active / straight audio";
  setButtonState();
  state.processor.port.postMessage({ type: "start", mode });
  updateMasterGain();
}

function stopPlayback() {
  state.playing = false;
  state.mode = "idle";
  statusEl.textContent = "Idle / output muted";
  setButtonState();
  if (state.master) {
    state.master.gain.setTargetAtTime(0, state.audio.currentTime, .025);
  }
  if (state.processor) state.processor.port.postMessage({ type: "stop" });
}

function togglePlay() {
  if (state.mode === "straight") {
    stopPlayback();
    return;
  }
  startPlayback("straight");
}

function togglePulse() {
  if (state.mode === "pulse") {
    stopPlayback();
    return;
  }
  startPlayback("pulse");
}

function updateBinaural() {
  state.binaural = binauralInput.checked;
  if (state.processor) state.processor.port.postMessage({ type: "binaural", value: state.binaural });
  resetSphereDisplacementMemory();
  setButtonState();
}

function updateLayerFromControl(event) {
  const input = event.currentTarget;
  const layerId = input.dataset.layer;
  const defaults = LAYER_DEFAULTS[layerId];
  const setting = state.layers[layerId];
  if (!defaults || !setting) return;

  if (input.classList.contains("layer-toggle")) {
    setting.enabled = input.checked;
  } else {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    setting.frequency = clamp(value, defaults.min, defaults.max);
    input.value = formatInputNumber(setting.frequency, defaults.step);
  }

  clearLayerSamples(layerId);
  sendLayerSettings();
  resetSphereDisplacementMemory();
  setLayerControlState();
}

function clearLayerSamples(layerId) {
  const layer = state.liveLayers[layerId];
  if (!layer) return;
  layer.left.fill(0);
  layer.right.fill(0);
  if (layerId === "breath") state.liveBreathEnvelope.fill(0);
}

function layerEnabled(layerId) {
  return state.layers[layerId] ? state.layers[layerId].enabled : true;
}

function activeDisplayLayers() {
  return DISPLAY_LAYERS.filter((layer) => layerEnabled(layer.id));
}

function formatInputNumber(value, step) {
  if (step >= 1) return String(Math.round(value));
  return formatNumber(value);
}

function formatNumber(value) {
  return Number(value.toFixed(2)).toString();
}

function updateVisualization() {
  state.visualization = visualizationInput.value;
}

function resizeCanvas() {
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.floor(window.innerWidth * pixelRatio);
  const height = Math.floor(window.innerHeight * pixelRatio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  sphereCanvas.style.width = window.innerWidth + "px";
  sphereCanvas.style.height = window.innerHeight + "px";
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function draw() {
  resizeCanvas();

  const width = window.innerWidth;
  const height = window.innerHeight;
  const active = state.playing ? 1 : .62;
  const sphereMode = state.visualization === "sphere";
  const sphereReady = sphereMode && sphereState.ready;

  canvas.style.display = sphereReady ? "none" : "block";
  sphereCanvas.style.display = sphereReady ? "block" : "none";

  if (sphereMode) {
    drawSphere({ width, height, active });
  } else if (state.visualization === "circle") {
    ctx.clearRect(0, 0, width, height);
    drawStereoCircle({ width, height, active });
  } else {
    ctx.clearRect(0, 0, width, height);
    drawStereoWaveform({ width, height, active });
  }

  window.requestAnimationFrame(draw);
}

function drawSphere({ width, height, active }) {
  if (!sphereState.ready) {
    ensureSphereRenderer();
    drawSphereLoading(width, height);
    return;
  }

  resizeSphereRenderer(width, height);
  const now = performance.now();
  if (now - sphereState.lastGeometryUpdate >= SPHERE_UPDATE_INTERVAL_MS) {
    updateSphereGeometry(active);
    sphereState.lastGeometryUpdate = now;
  }
  sphereState.renderer.render(sphereState.scene, sphereState.camera);
}

function ensureSphereRenderer() {
  if (sphereState.ready || sphereState.loading) return;

  sphereState.loading = true;
  import(THREE_CDN_URL)
    .then((THREE) => {
      createSphereRenderer(THREE);
      sphereState.loading = false;
      sphereState.ready = true;
      sphereState.error = "";
    })
    .catch(() => {
      sphereState.loading = false;
      sphereState.error = "Sphere view needs Three.js";
    });
}

function createSphereRenderer(THREE) {
  const renderer = new THREE.WebGLRenderer({
    canvas: sphereCanvas,
    alpha: true,
    antialias: true,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(SPHERE_CAMERA_FOV_DEGREES, 1, .1, 100);
  const group = new THREE.Group();
  const pointTexture = createSpherePointTexture(THREE);
  const ledLayers = createSphereLedLayers(THREE, pointTexture);

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.max(1, Math.min(2, window.devicePixelRatio || 1)));
  if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  camera.position.z = SPHERE_CAMERA_Z;
  ledLayers.forEach((ledLayer) => {
    if (ledLayer.trails) ledLayer.trails.forEach((trail) => group.add(trail.points));
    group.add(ledLayer.points);
  });
  scene.add(group);

  sphereState.THREE = THREE;
  sphereState.renderer = renderer;
  sphereState.scene = scene;
  sphereState.camera = camera;
  sphereState.mesh = group;
  sphereState.ledLayers = ledLayers;
  resizeSphereRenderer(window.innerWidth, window.innerHeight);
}

function createSpherePointTexture(THREE) {
  const textureCanvas = document.createElement("canvas");
  const size = 64;
  textureCanvas.width = size;
  textureCanvas.height = size;

  const textureCtx = textureCanvas.getContext("2d");
  const gradient = textureCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, "rgba(17, 17, 17, 1)");
  gradient.addColorStop(.62, "rgba(17, 17, 17, .86)");
  gradient.addColorStop(1, "rgba(17, 17, 17, 0)");
  textureCtx.fillStyle = gradient;
  textureCtx.beginPath();
  textureCtx.arc(32, 32, 30, 0, TWO_PI);
  textureCtx.fill();

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function createSphereLedLayers(THREE, pointTexture) {
  const layerWeights = DISPLAY_LAYERS.map((layer) => layer.id === "breath" ? SPHERE_BREATH_POINT_SCALE : 1);
  const totalWeight = layerWeights.reduce((sum, weight) => sum + weight, 0);
  let assignedCount = 0;

  return DISPLAY_LAYERS.map((layer, index) => {
    const remainingLayers = DISPLAY_LAYERS.length - index - 1;
    const targetCount = Math.floor(SPHERE_LED_COUNT * layerWeights[index] / totalWeight);
    const count = index === DISPLAY_LAYERS.length - 1
      ? SPHERE_LED_COUNT - assignedCount
      : Math.max(1, Math.min(targetCount, SPHERE_LED_COUNT - assignedCount - remainingLayers));
    assignedCount += count;
    const visualGain = SPHERE_LAYER_GAIN[layer.id] || 1;
    const coreScale = layer.id === "breath" ? .72 : 1;
    const nonBreathScale = layer.id === "breath" ? 1 : SPHERE_NON_BREATH_DOT_SCALE;
    const nonBreathOpacityScale = layer.id === "breath" ? 1 : SPHERE_NON_BREATH_OPACITY_SCALE;
    const harmonicScale = layer.id === "harmonic" ? SPHERE_HARMONIC_DOT_SCALE : 1;
    const pingScale = layer.id === "ping" ? SPHERE_PING_DOT_SCALE : 1;
    const chirpScale = layer.id === "chirp" ? SPHERE_CHIRP_DOT_SCALE : 1;
    const opacityScale = layer.id === "ping" ? 2.4 : layer.id === "chirp" ? 1.7 : layer.id === "breath" ? SPHERE_BREATH_OPACITY_SCALE : layer.id === "harmonic" ? .16 : 1;
    const minOpacity = layer.id === "harmonic" ? .025 : .08;
    const opacity = clamp(layer.alpha * (.72 + visualGain * .18) * opacityScale * nonBreathOpacityScale * SPHERE_GLOBAL_OPACITY_SCALE, minOpacity, .82);
    const material = new THREE.PointsMaterial({
      color: 0x111111,
      size: SPHERE_LED_SIZE * (.5 + layer.width * .16) * Math.sqrt(visualGain) * coreScale * nonBreathScale * harmonicScale * pingScale * chirpScale,
      map: pointTexture,
      transparent: true,
      opacity,
      alphaTest: .03,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return createSphereLedLayer(THREE, layer, material, count, index * 100000, pointTexture, opacity);
  });
}

function createSphereLedLayer(THREE, layer, material, count, seedOffset, pointTexture, baseOpacity) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const radialVariances = new Float32Array(count);
  const displacements = new Float32Array(count);
  const initialRadius = layer.id === "breath" ? SPHERE_BREATH_CORE_RADIUS : SPHERE_RADIUS;

  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    const point = seededSpherePoint(i + seedOffset);
    const nx = point.x;
    const ny = point.y;
    const nz = point.z;

    directions[offset] = nx;
    directions[offset + 1] = ny;
    directions[offset + 2] = nz;
    positions[offset] = nx * initialRadius;
    positions[offset + 1] = ny * initialRadius;
    positions[offset + 2] = nz * initialRadius;
    phases[i] = spherePhase(nx, ny, nz);
    radialVariances[i] = .62 + (hashNoise(i + seedOffset + 211) * .5 + .5) * .76;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const trails = surfaceTrailLayer(layer.id)
    ? createSurfaceTrails(THREE, layer, count, pointTexture)
    : null;

  return {
    layer,
    geometry,
    material,
    baseOpacity,
    points: new THREE.Points(geometry, material),
    directions,
    phases,
    radialVariances,
    displacements,
    trails,
    trailHistory: surfaceTrailLayer(layer.id) ? createSurfaceTrailHistory(positions) : null,
    swell: 0,
  };
}

function createSurfaceTrailHistory(positions) {
  return Array.from({ length: SPHERE_HARMONIC_TRAIL_COUNT * SPHERE_HARMONIC_TRAIL_FRAME_STEP }, () => new Float32Array(positions));
}

function createSurfaceTrails(THREE, layer, count, pointTexture) {
  const trails = [];
  const pointIndices = [];

  for (let i = 0; i < count; i += SPHERE_HARMONIC_TRAIL_STRIDE) {
    pointIndices.push(i);
  }

  for (let i = 0; i < SPHERE_HARMONIC_TRAIL_COUNT; i += 1) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pointIndices.length * 3);
    const fade = 1 - (i + 1) / SPHERE_HARMONIC_TRAIL_COUNT;
    const opacity = layer.alpha * .36 * fade * fade * SPHERE_GLOBAL_OPACITY_SCALE * SPHERE_NON_BREATH_OPACITY_SCALE;
    const material = new THREE.PointsMaterial({
      color: 0x555555,
      size: SPHERE_LED_SIZE * (.72 + layer.width * .14) * SPHERE_HARMONIC_DOT_SCALE * SPHERE_NON_BREATH_DOT_SCALE * (1 - i * .018),
      map: pointTexture,
      transparent: true,
      opacity,
      alphaTest: .001,
      depthWrite: false,
      sizeAttenuation: true,
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, material);
    points.renderOrder = 4;
    trails.push({
      geometry,
      positions,
      pointIndices,
      step: i,
      points,
    });
  }

  return trails;
}

function surfaceOrbitLayer(layerId) {
  return DISPLAY_LAYERS.some((layer) => layer.id === layerId) && layerId !== "ping";
}

function surfaceTrailLayer(layerId) {
  return surfaceOrbitLayer(layerId) && layerId !== "breath";
}

function seededSpherePoint(index) {
  let x = hashNoise(index * 3 + 11);
  let y = hashNoise(index * 3 + 17);
  let z = hashNoise(index * 3 + 23);
  let length = Math.hypot(x, y, z);

  while (length < .18) {
    x = hashNoise(index * 5 + 31);
    y = hashNoise(index * 5 + 37);
    z = hashNoise(index * 5 + 41);
    length = Math.hypot(x, y, z);
  }

  return {
    x: x / length,
    y: y / length,
    z: z / length,
  };
}

function spherePhase(nx, ny, nz) {
  const xy = (Math.atan2(ny, nx) + Math.PI) / TWO_PI;
  const yz = (Math.atan2(nz, ny) + Math.PI) / TWO_PI;
  const zx = (Math.atan2(nx, nz) + Math.PI) / TWO_PI;
  return positiveModulo(xy * .43 + yz * .34 + zx * .23, 1);
}

function resizeSphereRenderer(width, height) {
  const renderer = sphereState.renderer;
  const camera = sphereState.camera;
  if (!renderer || !camera) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function updateSphereGeometry(active) {
  const left = zoomSamples(readLiveSamples(state.liveChannels.left), .48);
  const right = zoomSamples(readLiveSamples(state.liveChannels.right), .48);
  const metrics = sphereSignalMetrics(left, right);

  updatePlasmaPhase(metrics, active);
  updateSphereLedLayers({ metrics, active });
  sphereState.mesh.rotation.x += .0018 * active;
  sphereState.mesh.rotation.y += .0026 * active;
  sphereState.mesh.rotation.z += .0011 * active;
}

function updatePlasmaPhase(metrics, active) {
  const energyDrive = clamp(metrics.energy / .06, 0, 1);
  sphereState.plasmaPhase = positiveModulo(
    sphereState.plasmaPhase + SPHERE_PLASMA_PHASE_SPEED * (.55 + energyDrive * .9) * Math.max(.35, active),
    1
  );
}

function updateSphereLedLayers({ metrics, active }) {
  sphereState.ledLayers.forEach((ledLayer) => {
    updateSphereLedLayer({ ledLayer, metrics, active });
  });
}

function updateSphereLedLayer({ ledLayer, metrics, active }) {
  ledLayer.points.visible = layerEnabled(ledLayer.layer.id);
  if (ledLayer.trails) ledLayer.trails.forEach((trail) => {
    trail.points.visible = ledLayer.points.visible;
  });
  if (!ledLayer.points.visible) return;

  const left = zoomSamples(visualLayerSamples(ledLayer.layer, "left"), .48);
  const right = zoomSamples(visualLayerSamples(ledLayer.layer, "right"), .48);
  const layerEnergy = rms(left, right);
  const layerPeak = peakAbs(left, right);
  const displacementGain = SPHERE_LAYER_GAIN[ledLayer.layer.id] || 1;
  const energyGain = SPHERE_LAYER_ENERGY_GAIN[ledLayer.layer.id] || .55;
  const radialScale = SPHERE_LAYER_RADIAL_SCALE[ledLayer.layer.id] ?? .25;
  const eventLift = layerPeak * energyGain * SPHERE_ENERGY_SCALE * active * radialScale;
  const pingJump = ledLayer.layer.id === "ping"
    ? updatePingJump(ledLayer, layerPeak, active)
    : 0;
  updateEventLayerOpacity(ledLayer, { layerEnergy, layerPeak, active });
  const isBreath = ledLayer.layer.id === "breath";
  const baseRadius = isBreath ? SPHERE_BREATH_CORE_RADIUS : SPHERE_RADIUS;
  const breathMotion = isBreath ? latestLiveSample(state.liveBreathEnvelope) : 0;
  const targetCoreSwell = isBreath ? smoothstep(clamp(breathMotion, 0, 1)) * SPHERE_BREATH_SWELL_SCALE * active : 0;
  const coreSwell = isBreath ? lerp(ledLayer.swell || 0, targetCoreSwell, .06) : 0;
  const waveformScale = isBreath ? 0 : radialScale;
  const energyScale = isBreath ? 0 : radialScale;
  const eventComponent = isBreath ? 0 : eventLift;
  const mixedEnergyComponent = isBreath ? 0 : metrics.energy * SPHERE_ENERGY_SCALE * .12 * active * radialScale;
  const positions = ledLayer.geometry.attributes.position.array;
  const temporalBlend = SPHERE_LAYER_TEMPORAL_BLEND[ledLayer.layer.id] || SPHERE_TEMPORAL_BLEND;
  const positionBlend = SPHERE_LAYER_POSITION_BLEND[ledLayer.layer.id] || SPHERE_POSITION_BLEND;
  const surfaceOrbit = surfaceOrbitLayer(ledLayer.layer.id)
    ? updateSurfaceOrbit(ledLayer, { left, right, layerEnergy, active })
    : null;
  const chirpOrbitLift = ledLayer.layer.id === "chirp" && surfaceOrbit
    ? smoothstep(clamp(layerPeak / .018, 0, 1)) * SPHERE_CHIRP_ORBIT_LIFT_SCALE * active
    : 0;
  if (ledLayer.layer.id === "chirp") updateChirpDarkening(ledLayer, chirpOrbitLift);
  if (isBreath) ledLayer.swell = coreSwell;

  for (let i = 0; i < ledLayer.phases.length; i += 1) {
    const offset = i * 3;
    const nx = ledLayer.directions[offset];
    const ny = ledLayer.directions[offset + 1];
    const nz = ledLayer.directions[offset + 2];
    const sample = sphereDirectionalSampleAt({ left, right, nx, ny, nz });
    const targetDisplacement =
      (
        sample * SPHERE_WAVE_SCALE * displacementGain * waveformScale * active +
        layerEnergy * SPHERE_ENERGY_SCALE * energyGain * energyScale * active +
      eventComponent +
      mixedEnergyComponent +
      pingJump +
      chirpOrbitLift
      ) * (ledLayer.radialVariances ? ledLayer.radialVariances[i] : 1);
    const displacement = lerp(ledLayer.displacements[i] || 0, targetDisplacement, temporalBlend);
    const radius = baseRadius + coreSwell + displacement;

    ledLayer.displacements[i] = displacement;
    let targetX;
    let targetY;
    let targetZ;
    if (surfaceOrbit) {
      const orbit = surfaceOrbitOffset({ nx, ny, nz, phase: ledLayer.phases[i], surfaceOrbit });
      const liftTwist = ledLayer.layer.id === "chirp" && chirpOrbitLift
        ? chirpOrbitLift * SPHERE_CHIRP_LIFT_TWIST_SCALE * (ledLayer.radialVariances ? ledLayer.radialVariances[i] : 1)
        : 0;
      targetX = nx * radius + orbit.x + orbit.x * liftTwist;
      targetY = ny * radius + orbit.y + orbit.y * liftTwist;
      targetZ = nz * radius + orbit.z + orbit.z * liftTwist;
    } else {
      targetX = nx * radius;
      targetY = ny * radius;
      targetZ = nz * radius;
    }

    positions[offset] = lerp(positions[offset], targetX, positionBlend);
    positions[offset + 1] = lerp(positions[offset + 1], targetY, positionBlend);
    positions[offset + 2] = lerp(positions[offset + 2], targetZ, positionBlend);
  }

  ledLayer.geometry.attributes.position.needsUpdate = true;
  if (ledLayer.trails && surfaceOrbit) updateSurfaceTrails(ledLayer);
}

function updatePingJump(ledLayer, layerPeak, active) {
  const target = smoothstep(clamp(layerPeak / .03, 0, 1)) * SPHERE_PING_JUMP_SCALE * active;
  const current = ledLayer.pingJump || 0;
  const easing = target > current ? SPHERE_PING_JUMP_ATTACK : SPHERE_PING_JUMP_RELEASE;
  ledLayer.pingJump = lerp(current, target, easing);
  return ledLayer.pingJump;
}

function updateChirpDarkening(ledLayer, chirpOrbitLift) {
  if (!ledLayer.material) return;
  const darken = clamp(chirpOrbitLift / Math.max(.001, SPHERE_CHIRP_ORBIT_LIFT_SCALE), 0, 1);
  const visibility = SPHERE_EVENT_LAYER_VISIBILITY[ledLayer.layer.id] ? ledLayer.eventVisibility || 0 : 1;
  ledLayer.material.opacity = clamp(ledLayer.baseOpacity * visibility * (1 + darken * SPHERE_CHIRP_DARKEN_SCALE), 0, .82);
}

function updateEventLayerOpacity(ledLayer, { layerEnergy, layerPeak, active }) {
  const visibility = SPHERE_EVENT_LAYER_VISIBILITY[ledLayer.layer.id];
  if (!visibility || !ledLayer.material) return;
  const energyVisibility = smoothstep(clamp(layerEnergy / visibility.reference, 0, 1));
  const peakVisibility = smoothstep(clamp(layerPeak / (visibility.reference * 1.6), 0, 1));
  const target = Math.max(visibility.floor, energyVisibility, peakVisibility) * active;
  ledLayer.eventVisibility = lerp(ledLayer.eventVisibility || 0, target, target > (ledLayer.eventVisibility || 0) ? .68 : .42);
  ledLayer.material.opacity = ledLayer.baseOpacity * ledLayer.eventVisibility;
}

function updateSurfaceOrbit(ledLayer, { left, right, layerEnergy, active }) {
  const length = Math.min(left.length, right.length);
  const sampleCount = Math.min(192, length);
  let absoluteSum = 0;
  let slopeSum = 0;
  let previous = 0;

  for (let i = length - sampleCount; i < length; i += 1) {
    const mono = ((left[i] || 0) + (right[i] || 0)) * .5;
    absoluteSum += Math.abs(mono);
    if (i > length - sampleCount) slopeSum += Math.abs(mono - previous);
    previous = mono;
  }

  const divisor = Math.max(1, sampleCount);
  const absoluteMean = absoluteSum / divisor;
  const slopeMean = slopeSum / divisor;
  const motionActive = state.playing ? active : .28;
  const targetDrive = clamp(
    absoluteMean / .012 * .58 +
    slopeMean / .018 * .24 +
    layerEnergy / .014 * .18,
    0,
    1
  ) * motionActive;
  const baseDrive = surfaceOrbitBaseDrive(ledLayer.layer.id) * Math.max(.35, active);
  const breathDrive = ledLayer.layer.id === "breath" ? breathEnvelopeSlopeDrive() : 0;
  const breathMotionDrive = ledLayer.layer.id === "breath" && breathDrive > .04
    ? Math.max(SPHERE_BREATH_ORBIT_MIN_DRIVE, smoothstep(breathDrive)) * active
    : 0;
  const orbitTargetDrive = ledLayer.layer.id === "chirp"
    ? Math.max(targetDrive, (SPHERE_CHIRP_IDLE_ORBIT_DRIVE + clamp(layerEnergy / .006, 0, 1) * .66) * motionActive)
    : ledLayer.layer.id === "breath"
      ? breathMotionDrive
      : Math.max(baseDrive, targetDrive);

  const orbitDriveBlend = ledLayer.layer.id === "chirp"
    ? .55
    : ledLayer.layer.id === "breath"
      ? (orbitTargetDrive > (ledLayer.orbitDrive || 0) ? .095 : .045)
      : .12;
  ledLayer.orbitDrive = lerp(ledLayer.orbitDrive || 0, orbitTargetDrive, orbitDriveBlend);
  const orbitSpeed = surfaceOrbitSpeed(ledLayer.layer.id);
  const orbitRadius = surfaceOrbitRadius(ledLayer.layer.id);
  const idleOrbitStep = ledLayer.layer.id === "chirp"
    ? SPHERE_CHIRP_IDLE_ORBIT_STEP * Math.max(.35, active)
    : ledLayer.layer.id === "breath"
      ? SPHERE_BREATH_ORBIT_STEP * breathMotionDrive
      : SPHERE_ORBIT_BASE_STEP * Math.max(.35, active);
  ledLayer.orbitPhase = positiveModulo(
    (ledLayer.orbitPhase || 0) +
    (
      idleOrbitStep +
      (absoluteMean / .012 * .022 + slopeMean / .018 * .012 + layerEnergy / .014 * .01) * motionActive
    ) * orbitSpeed,
    1
  );

  return {
    drive: ledLayer.orbitDrive || 0,
    phase: ledLayer.orbitPhase || 0,
    radius: orbitRadius,
    layerId: ledLayer.layer.id,
    sharedPhase: sphereState.plasmaPhase,
  };
}

function surfaceOrbitSpeed(layerId) {
  if (layerId === "harmonic") return SPHERE_HARMONIC_ORBIT_SPEED;
  if (layerId === "chirp") return SPHERE_CHIRP_ORBIT_SPEED;
  if (layerId === "pad") return SPHERE_PAD_ORBIT_SPEED;
  if (layerId === "breath") return SPHERE_BREATH_ORBIT_SPEED;
  return SPHERE_DEFAULT_ORBIT_SPEED;
}

function surfaceOrbitBaseDrive(layerId) {
  if (layerId === "harmonic") return SPHERE_ORBIT_BASE_DRIVE;
  if (layerId === "pad") return SPHERE_ORBIT_BASE_DRIVE * .72;
  if (layerId === "carrier") return SPHERE_ORBIT_BASE_DRIVE * .46;
  return 0;
}

function surfaceOrbitRadius(layerId) {
  if (layerId === "harmonic") return SPHERE_HARMONIC_ORBIT_RADIUS;
  if (layerId === "chirp") return SPHERE_CHIRP_ORBIT_RADIUS;
  if (layerId === "pad") return SPHERE_PAD_ORBIT_RADIUS;
  if (layerId === "breath") return SPHERE_BREATH_ORBIT_RADIUS;
  return SPHERE_DEFAULT_ORBIT_RADIUS;
}

function surfaceOrbitOffset({ nx, ny, nz, phase, surfaceOrbit }) {
  const radiusVariance = surfaceOrbit.layerId === "breath"
    ? .72 + positiveModulo(phase * 5.37, 1) * .56
    : .28 + Math.pow(positiveModulo(phase * 5.37, 1), .72) * 1.92;
  const spinVariance = .55 + positiveModulo(phase * 7.91, 1) * 1.05;
  const radius = surfaceOrbit.radius * surfaceOrbit.drive * radiusVariance;
  if (radius <= .0001) return { x: 0, y: 0, z: 0 };

  const layerPhase = SPHERE_PLASMA_LAYER_PHASE[surfaceOrbit.layerId] || 0;
  const angle = (
    surfaceOrbit.sharedPhase +
    surfaceOrbit.phase * spinVariance +
    layerPhase +
    phase
  ) * TWO_PI;
  const tangentA = tangentFromAxis({ x: 0, y: 1, z: 0 }, nx, ny, nz);
  const tangentB = {
    x: ny * tangentA.z - nz * tangentA.y,
    y: nz * tangentA.x - nx * tangentA.z,
    z: nx * tangentA.y - ny * tangentA.x,
  };
  const x = Math.cos(angle) * tangentA.x - Math.sin(angle) * tangentB.x;
  const y = Math.cos(angle) * tangentA.y - Math.sin(angle) * tangentB.y;
  const z = Math.cos(angle) * tangentA.z - Math.sin(angle) * tangentB.z;

  return {
    x: x * radius,
    y: y * radius,
    z: z * radius,
  };
}

function tangentFromAxis(axis, nx, ny, nz) {
  let x = axis.y * nz - axis.z * ny;
  let y = axis.z * nx - axis.x * nz;
  let z = axis.x * ny - axis.y * nx;
  const length = Math.hypot(x, y, z);

  if (length < .001) {
    x = -ny;
    y = nx;
    z = 0;
  }

  const fallbackLength = Math.max(.001, Math.hypot(x, y, z));
  return {
    x: x / fallbackLength,
    y: y / fallbackLength,
    z: z / fallbackLength,
  };
}

function updateSurfaceTrails(ledLayer) {
  if (!ledLayer.trailHistory) return;

  for (let trailIndex = 0; trailIndex < ledLayer.trails.length; trailIndex += 1) {
    const trail = ledLayer.trails[trailIndex];
    const trailPositions = trail.geometry.attributes.position.array;
    const historyIndex = Math.min(ledLayer.trailHistory.length - 1, (trailIndex + 1) * SPHERE_HARMONIC_TRAIL_FRAME_STEP - 1);
    const snapshot = ledLayer.trailHistory[historyIndex];
    const neighborSnapshot = ledLayer.trailHistory[Math.max(0, historyIndex - SPHERE_HARMONIC_TRAIL_FRAME_STEP)];

    for (let i = 0; i < trail.pointIndices.length; i += 1) {
      const pointIndex = trail.pointIndices[i];
      const neighborPointIndex = trail.pointIndices[(i + 11 + trailIndex * 7) % trail.pointIndices.length];
      const sourceOffset = pointIndex * 3;
      const neighborOffset = neighborPointIndex * 3;
      const trailOffset = i * 3;
      const absorbed = harmonicTrailAbsorption({
        source: snapshot,
        sourceOffset,
        neighbor: neighborSnapshot,
        neighborOffset,
        age: trailIndex / Math.max(1, ledLayer.trails.length - 1),
      });

      trailPositions[trailOffset] = absorbed.x;
      trailPositions[trailOffset + 1] = absorbed.y;
      trailPositions[trailOffset + 2] = absorbed.z;
    }

    trail.geometry.attributes.position.needsUpdate = true;
  }

  const currentPositions = ledLayer.geometry.attributes.position.array;
  const newestSnapshot = ledLayer.trailHistory.pop();
  newestSnapshot.set(currentPositions);
  ledLayer.trailHistory.unshift(newestSnapshot);
}

function harmonicTrailAbsorption({ source, sourceOffset, neighbor, neighborOffset, age }) {
  const sx = source[sourceOffset];
  const sy = source[sourceOffset + 1];
  const sz = source[sourceOffset + 2];
  const nx = neighbor[neighborOffset];
  const ny = neighbor[neighborOffset + 1];
  const nz = neighbor[neighborOffset + 2];
  const distance = Math.hypot(nx - sx, ny - sy, nz - sz);
  const closeness = 1 - smoothstep(distance / SPHERE_HARMONIC_TRAIL_ABSORB_DISTANCE);
  const pull = closeness * SPHERE_HARMONIC_TRAIL_ABSORB_STRENGTH * (.35 + age * .65);

  return {
    x: lerp(sx, nx, pull),
    y: lerp(sy, ny, pull),
    z: lerp(sz, nz, pull),
  };
}

function resetSphereDisplacementMemory() {
  if (sphereState.displacements) sphereState.displacements.fill(0);
  sphereState.ledLayers.forEach((ledLayer) => {
    const baseRadius = ledLayer.layer.id === "breath" ? SPHERE_BREATH_CORE_RADIUS : SPHERE_RADIUS;
    const positions = ledLayer.geometry.attributes.position.array;

    ledLayer.displacements.fill(0);
    ledLayer.swell = 0;
    ledLayer.orbitDrive = 0;
    ledLayer.orbitPhase = 0;
    ledLayer.pingJump = 0;
    ledLayer.eventVisibility = 0;
    for (let i = 0; i < ledLayer.directions.length; i += 3) {
      positions[i] = ledLayer.directions[i] * baseRadius;
      positions[i + 1] = ledLayer.directions[i + 1] * baseRadius;
      positions[i + 2] = ledLayer.directions[i + 2] * baseRadius;
    }
    ledLayer.geometry.attributes.position.needsUpdate = true;
    if (ledLayer.trailHistory) {
      ledLayer.trailHistory.forEach((snapshot) => snapshot.set(positions));
    }
    if (ledLayer.trails) {
      ledLayer.trails.forEach((trail) => {
        trail.positions.fill(0);
        trail.geometry.attributes.position.needsUpdate = true;
      });
    }
  });
}

function latestLiveSample(samples) {
  const index = positiveModulo(state.liveWriteIndex - 1, samples.length);
  return samples[index] || 0;
}

function breathEnvelopeSlopeDrive() {
  const samples = state.liveBreathEnvelope;
  const latestIndex = positiveModulo(state.liveWriteIndex - 1, samples.length);
  const latest = samples[latestIndex] || 0;
  const shortPrevious = samples[positiveModulo(latestIndex - 1024, samples.length)] || 0;
  const longPrevious = samples[positiveModulo(latestIndex - 3072, samples.length)] || 0;
  const delta = Math.max(
    Math.abs(latest - shortPrevious) * 1.6,
    Math.abs(latest - longPrevious)
  );
  return clamp(delta / SPHERE_BREATH_ORBIT_SLOPE_REFERENCE, 0, 1);
}

function sphereSignalMetrics(left, right) {
  const breathLeft = zoomSamples(visualLayerSamples({ id: "breath" }, "left"), .48);
  const breathRight = zoomSamples(visualLayerSamples({ id: "breath" }, "right"), .48);
  const chirpLeft = zoomSamples(visualLayerSamples({ id: "chirp" }, "left"), .48);
  const chirpRight = zoomSamples(visualLayerSamples({ id: "chirp" }, "right"), .48);
  const pingLeft = zoomSamples(visualLayerSamples({ id: "ping" }, "left"), .48);
  const pingRight = zoomSamples(visualLayerSamples({ id: "ping" }, "right"), .48);

  return {
    energy: rms(left, right),
    breath: rms(breathLeft, breathRight),
    chirp: rms(chirpLeft, chirpRight),
    ping: rms(pingLeft, pingRight),
  };
}

function sphereDerivedSurfaceMotion(nx, ny, nz, progress, metrics, time) {
  const breath = clamp(metrics.breath / .004, 0, 1);
  const chirp = clamp(metrics.chirp / .018, 0, 1);
  const ping = clamp(metrics.ping / .08, 0, 1);
  const lowEnergy = clamp(metrics.energy / .08, 0, 1);
  const breathTexture =
    Math.sin(nx * 8.5 + ny * 3.7 + time * .55) *
    Math.sin(nz * 7.2 - time * .38) *
    .026 * breath;
  const chirpRipple = Math.sin((progress * TWO_PI * 18) + time * 5.2) * .018 * chirp;
  const pingRipple = Math.sin((progress * TWO_PI * 42) - time * 7.6) * .014 * ping;
  const carrierLift = Math.sin((ny + nz) * 4.4 + time * .18) * .01 * lowEnergy;

  return breathTexture + chirpRipple + pingRipple + carrierLift;
}

function drawSphereLoading(width, height) {
  canvas.style.display = "block";
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.fillStyle = traceColor(.42);
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sphereState.error || "Loading sphere", width * .5, height * .52);
  ctx.restore();
}

function drawStereoWaveform({ width, height, active }) {
  const amplitude = Math.min(560, height * .42) * active;

  DISPLAY_CHANNELS.forEach((channel) => {
    const centerY = height * channel.y;
    drawCenterLine(centerY, width);
    drawChannelLabel(channel.label, centerY);
    activeDisplayLayers().forEach((layer) => {
      drawLiveLayerWaveform({ centerY, amplitude, width, channel, layer });
    });
  });
}

function drawLiveLayerWaveform({ centerY, amplitude, width, channel, layer }) {
  const points = buildLiveLayerPoints({ centerY, amplitude, width, channel, layer });
  drawSignalTrace(points, layer.alpha, layer.width, 1);
}

function buildLiveLayerPoints({ centerY, amplitude, width, channel, layer }) {
  const samples = zoomSamples(visualLayerSamples(layer, channel.id), .48);
  const count = Math.max(280, Math.ceil(width / 3));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const progress = i / count;
    const sample = rawSampleAt(samples, progress);
    const x = progress * width;
    points.push({
      x,
      y: centerY - sample * amplitude,
    });
  }
  return points;
}

function drawCurve(points, offsetX = 0, offsetY = 0) {
  if (!points.length) return;
  ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
  }
}

function drawStereoCircle({ width, height, active }) {
  const centerX = width * .5;
  const centerY = height * .52;
  const radius = Math.min(width * .42, sphereProjectedRadius(height));

  drawCircleFrame(centerX, centerY, radius);
  if (!state.binaural) {
    drawMonoCircleLayers({ centerX, centerY, radius, active });
    return;
  }

  activeDisplayLayers().forEach((layer) => {
    const leftSamples = zoomSamples(visualLayerSamples(layer, "left"), .48);
    const rightSamples = zoomSamples(visualLayerSamples(layer, "right"), .48);
    const leftPoints = buildCirclePoints({
      samples: leftSamples,
      centerX,
      centerY,
      radius,
      startAngle: Math.PI * 1.5,
      endAngle: Math.PI * .5,
      active,
    });
    const rightPoints = buildCirclePoints({
      samples: rightSamples,
      centerX,
      centerY,
      radius,
      startAngle: Math.PI * .5,
      endAngle: -Math.PI * .5,
      active,
    });

    drawCircleWave({ points: leftPoints, alpha: layer.alpha, width: layer.width });
    drawCircleWave({ points: rightPoints, alpha: layer.alpha, width: layer.width });
  });
}

function sphereProjectedRadius(height) {
  const fovRadians = SPHERE_CAMERA_FOV_DEGREES * Math.PI / 180;
  return height * .5 * SPHERE_RADIUS / (SPHERE_CAMERA_Z * Math.tan(fovRadians * .5));
}

function drawMonoCircleLayers({ centerX, centerY, radius, active }) {
  activeDisplayLayers().forEach((layer) => {
    const samples = zoomSamples(visualLayerSamples(layer, "left"), .48);
    const points = buildCirclePoints({
      samples,
      centerX,
      centerY,
      radius,
      startAngle: -Math.PI * .5,
      endAngle: Math.PI * 1.5,
      active,
      looped: true,
    });

    drawCircleWave({ points, alpha: layer.alpha, width: layer.width, closed: true });
  });
}

function visualLayerSamples(layer, channel) {
  return readLiveSamples(state.liveLayers[layer.id][channel]);
}

function zoomSamples(samples, fraction) {
  const length = Math.max(2, Math.floor(samples.length * fraction));
  return samples.subarray(samples.length - length);
}

function drawCircleFrame(centerX, centerY, radius) {
  ctx.save();
  ctx.strokeStyle = traceColor(.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();
}

function drawCircleWave({ points, alpha, width, closed = false }) {
  drawSignalTrace(points, alpha, width, .72, closed);
}

function drawSignalTrace(points, alpha, width, contourScale, closed = false) {
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  drawOffsetTrace(points, 0, 0, traceColor(alpha), width, closed);
  ctx.restore();
}

function drawOffsetTrace(points, offsetX, offsetY, color, width, closed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  drawCurve(points, offsetX, offsetY);
  if (closed) ctx.closePath();
  ctx.stroke();
}

function buildCirclePoints({ samples, centerX, centerY, radius, startAngle, endAngle, active, looped = false }) {
  const count = 384;
  const points = [];
  const amplitude = radius * .48 * active;

  for (let i = 0; i <= count; i += 1) {
    const progress = i / count;
    const theta = lerp(startAngle, endAngle, progress);
    const sample = looped ? seamlessLoopedSampleAt(samples, progress) : rawSampleAt(samples, progress);
    const radial = radius + sample * amplitude;
    const x = centerX + Math.cos(theta) * radial;
    const y = centerY + Math.sin(theta) * radial;
    points.push({ x, y });
  }

  return points;
}

function rawSampleAt(samples, progress) {
  const index = Math.min(samples.length - 1, Math.floor(progress * samples.length));
  return samples[index] || 0;
}

function loopedSampleAt(samples, progress) {
  if (!samples.length) return 0;
  if (samples.length === 1) return samples[0] || 0;

  const position = positiveModulo(progress, 1) * samples.length;
  const index = Math.floor(position);
  const nextIndex = (index + 1) % samples.length;
  const fraction = position - index;
  return lerp(samples[index] || 0, samples[nextIndex] || 0, fraction);
}

function seamlessLoopedSampleAt(samples, progress) {
  if (!samples.length) return 0;
  if (samples.length === 1) return samples[0] || 0;

  const p = positiveModulo(progress, 1);
  const seamWidth = .055;
  const sample = loopedSampleAt(samples, p);
  const seamSample = ((samples[0] || 0) + (samples[samples.length - 1] || 0)) * .5;

  if (p < seamWidth) {
    return lerp(seamSample, sample, smoothstep(p / seamWidth));
  }

  if (p > 1 - seamWidth) {
    return lerp(sample, seamSample, smoothstep((p - (1 - seamWidth)) / seamWidth));
  }

  return sample;
}

function sphereSampleAt(samples, progress) {
  const center = seamlessLoopedSampleAt(samples, progress);
  const offsets = [
    -SPHERE_SAMPLE_SMOOTHING * 2,
    -SPHERE_SAMPLE_SMOOTHING,
    -SPHERE_SAMPLE_SMOOTHING * .45,
    SPHERE_SAMPLE_SMOOTHING * .45,
    SPHERE_SAMPLE_SMOOTHING,
    SPHERE_SAMPLE_SMOOTHING * 2,
  ];
  const weights = [.08, .16, .22, .22, .16, .08];
  let sum = center * .08;
  let weight = .08;

  for (let i = 0; i < offsets.length; i += 1) {
    sum += seamlessLoopedSampleAt(samples, progress + offsets[i]) * weights[i];
    weight += weights[i];
  }

  return sum / weight;
}

function sphereDirectionalSampleAt({ left, right, nx, ny, nz }) {
  let leftSum = 0;
  let rightSum = 0;
  let weightSum = 0;

  for (let i = 0; i < SPHERE_PHASE_AXES.length; i += 1) {
    const axis = SPHERE_PHASE_AXES[i];
    const dot = nx * axis.x + ny * axis.y + nz * axis.z;
    const progress = positiveModulo(.5 + dot * .5 + axis.offset, 1);
    leftSum += sphereProjectionSampleAt(left, progress) * axis.weight;
    rightSum += sphereProjectionSampleAt(right, progress) * axis.weight;
    weightSum += axis.weight;
  }

  const leftSample = leftSum / weightSum;
  const rightSample = rightSum / weightSum;
  if (!state.binaural) return (leftSample + rightSample) * .5;

  return lerp(leftSample, rightSample, smoothstep((nx + 1) * .5));
}

function sphereProjectionSampleAt(samples, progress) {
  const spread = SPHERE_SAMPLE_SMOOTHING;
  return (
    seamlessLoopedSampleAt(samples, progress - spread) * .25 +
    seamlessLoopedSampleAt(samples, progress) * .5 +
    seamlessLoopedSampleAt(samples, progress + spread) * .25
  );
}

function rms(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;

  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    sum += left[i] * left[i] + right[i] * right[i];
  }
  return Math.sqrt(sum / (length * 2));
}

function peakAbs(left, right) {
  const length = Math.min(left.length, right.length);
  let peak = 0;

  for (let i = 0; i < length; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }

  return peak;
}

function drawCenterLine(y, width) {
  ctx.save();
  ctx.strokeStyle = traceColor(.18);
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.restore();
}

function drawChannelLabel(label, y) {
  ctx.save();
  ctx.fillStyle = traceColor(.42);
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  ctx.textBaseline = "middle";
  ctx.fillText(label, 14, y - 18);
  ctx.restore();
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function traceColor(alpha) {
  return "rgba(" + TRACE_RGB + ", " + alpha + ")";
}

function loudnessStroke(level) {
  return .42 + Math.sqrt(level / CARRIER_VISUAL_REFERENCE_GAIN) * .9;
}

function loudnessAlpha(level) {
  return .16 + Math.sqrt(level / CARRIER_VISUAL_REFERENCE_GAIN) * .5;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

playButton.addEventListener("click", togglePlay);
pulseButton.addEventListener("click", togglePulse);
appSwitcher.addEventListener("change", () => {
  if (appSwitcher.value && appSwitcher.value !== window.location.href) {
    window.location.href = appSwitcher.value;
  }
});
binauralInput.addEventListener("change", updateBinaural);
visualizationInput.addEventListener("change", updateVisualization);
volumeInput.addEventListener("input", () => {
  state.volume = Number(volumeInput.value);
  updateMasterGain();
});
window.addEventListener("resize", resizeCanvas);
layerToggleInputs.forEach((input) => input.addEventListener("change", updateLayerFromControl));
layerFrequencyInputs.forEach((input) => {
  input.addEventListener("change", updateLayerFromControl);
  input.addEventListener("focus", () => input.select());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });
});

setLayerControlState();
draw();
