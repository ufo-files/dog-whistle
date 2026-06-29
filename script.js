const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const sphereCanvas = document.getElementById("sphere");
const playButton = document.getElementById("play");
const pulseButton = document.getElementById("pulse");
const binauralInput = document.getElementById("binaural");
const visualizationInput = document.getElementById("visualization");
const volumeInput = document.getElementById("volume");
const statusEl = document.getElementById("status");

const TWO_PI = Math.PI * 2;
const THREE_CDN_URL = "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
const VISUAL_HISTORY_LENGTH = 4096;
const TRACE_RGB = "17, 17, 17";
const CARRIER_VISUAL_REFERENCE_GAIN = .115;
const SPHERE_RADIUS = 1.18;
const SPHERE_CAMERA_Z = 4.8;
const SPHERE_CAMERA_FOV_DEGREES = 38;
const SPHERE_WAVE_SCALE = 1.18;
const SPHERE_ENERGY_SCALE = .62;
const SPHERE_SAMPLE_SMOOTHING = .017;
const SPHERE_TEMPORAL_BLEND = .3;
const SPHERE_LED_SIZE = .026;
const SPHERE_LED_COUNT = 32000;
const SPHERE_UPDATE_INTERVAL_MS = 16;
const SPHERE_LAYER_GAIN = {
  carrier: 1,
  pad: 1.08,
  harmonic: 1.18,
  ping: 1.35,
  chirp: 1.75,
  breath: 1.3,
};
const SPHERE_LAYER_ENERGY_GAIN = {
  carrier: .48,
  pad: .55,
  harmonic: .68,
  ping: 1.1,
  chirp: 1.7,
  breath: .9,
};
const SPHERE_BREATH_CORE_RADIUS = .37;
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
  { id: "breath", label: "air", alpha: loudnessAlpha(.055), width: loudnessStroke(.055) },
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
  startedAt: performance.now() / 1000,
  audioStartTime: 0,
  liveWriteIndex: 0,
  liveChannels: createLiveChannels(VISUAL_HISTORY_LENGTH),
  liveLayers: createLiveLayers(VISUAL_HISTORY_LENGTH),
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

function ensureLiveChannelSize() {
  if (state.liveChannels.left.length === VISUAL_HISTORY_LENGTH) return;
  state.liveWriteIndex = 0;
  state.liveChannels = createLiveChannels(VISUAL_HISTORY_LENGTH);
  state.liveLayers = createLiveLayers(VISUAL_HISTORY_LENGTH);
}

function writeWorkletFrameBlock(block) {
  if (!block || !block.length) return;
  ensureLiveChannelSize();

  for (let offset = 0; offset < block.length; offset += 14) {
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
  ledLayers.forEach((ledLayer) => group.add(ledLayer.points));
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
  gradient.addColorStop(.62, "rgba(17, 17, 17, .9)");
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
  const baseCount = Math.floor(SPHERE_LED_COUNT / DISPLAY_LAYERS.length);
  let remainder = SPHERE_LED_COUNT - baseCount * DISPLAY_LAYERS.length;

  return DISPLAY_LAYERS.map((layer, index) => {
    const count = baseCount + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    const visualGain = SPHERE_LAYER_GAIN[layer.id] || 1;
    const coreScale = layer.id === "breath" ? .72 : 1;
    const material = new THREE.PointsMaterial({
      color: 0x111111,
      size: SPHERE_LED_SIZE * (.5 + layer.width * .16) * Math.sqrt(visualGain) * coreScale,
      map: pointTexture,
      transparent: true,
      opacity: clamp(layer.alpha * (.72 + visualGain * .18) * (layer.id === "breath" ? 1.5 : 1), .16, .82),
      alphaTest: .03,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return createSphereLedLayer(THREE, layer, material, count, index * 100000);
  });
}

function createSphereLedLayer(THREE, layer, material, count, seedOffset) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const displacements = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    const point = seededSpherePoint(i + seedOffset);
    const nx = point.x;
    const ny = point.y;
    const nz = point.z;

    directions[offset] = nx;
    directions[offset + 1] = ny;
    directions[offset + 2] = nz;
    positions[offset] = nx * SPHERE_RADIUS;
    positions[offset + 1] = ny * SPHERE_RADIUS;
    positions[offset + 2] = nz * SPHERE_RADIUS;
    phases[i] = spherePhase(nx, ny, nz);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  return {
    layer,
    geometry,
    points: new THREE.Points(geometry, material),
    directions,
    phases,
    displacements,
    swell: 0,
  };
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

  updateSphereLedLayers({ metrics, active });
  sphereState.mesh.rotation.x += .0018 * active;
  sphereState.mesh.rotation.y += .0026 * active;
  sphereState.mesh.rotation.z += .0011 * active;
}

function updateSphereLedLayers({ metrics, active }) {
  sphereState.ledLayers.forEach((ledLayer) => {
    updateSphereLedLayer({ ledLayer, metrics, active });
  });
}

function updateSphereLedLayer({ ledLayer, metrics, active }) {
  const left = zoomSamples(visualLayerSamples(ledLayer.layer, "left"), .48);
  const right = zoomSamples(visualLayerSamples(ledLayer.layer, "right"), .48);
  const layerEnergy = rms(left, right);
  const layerPeak = peakAbs(left, right);
  const displacementGain = SPHERE_LAYER_GAIN[ledLayer.layer.id] || 1;
  const energyGain = SPHERE_LAYER_ENERGY_GAIN[ledLayer.layer.id] || .55;
  const eventLift = layerPeak * energyGain * SPHERE_ENERGY_SCALE * active;
  const isBreath = ledLayer.layer.id === "breath";
  const baseRadius = isBreath ? SPHERE_BREATH_CORE_RADIUS : SPHERE_RADIUS;
  const targetCoreSwell = isBreath ? smoothstep(clamp(layerEnergy / .0028, 0, 1)) * .29 * active : 0;
  const coreSwell = isBreath ? lerp(ledLayer.swell || 0, targetCoreSwell, .035) : 0;
  const waveformScale = isBreath ? .18 : 1;
  const energyScale = isBreath ? .18 : 1;
  const eventComponent = isBreath ? 0 : eventLift;
  const mixedEnergyComponent = isBreath ? 0 : metrics.energy * SPHERE_ENERGY_SCALE * .12 * active;
  const positions = ledLayer.geometry.attributes.position.array;
  if (isBreath) ledLayer.swell = coreSwell;

  for (let i = 0; i < ledLayer.phases.length; i += 1) {
    const offset = i * 3;
    const nx = ledLayer.directions[offset];
    const ny = ledLayer.directions[offset + 1];
    const nz = ledLayer.directions[offset + 2];
    const sample = sphereDirectionalSampleAt({ left, right, nx, ny, nz });
    const targetDisplacement =
      sample * SPHERE_WAVE_SCALE * displacementGain * waveformScale * active +
      layerEnergy * SPHERE_ENERGY_SCALE * energyGain * energyScale * active +
      eventComponent +
      mixedEnergyComponent;
    const displacement = lerp(ledLayer.displacements[i] || 0, targetDisplacement, SPHERE_TEMPORAL_BLEND);
    const radius = baseRadius + coreSwell + displacement;

    ledLayer.displacements[i] = displacement;
    positions[offset] = nx * radius;
    positions[offset + 1] = ny * radius;
    positions[offset + 2] = nz * radius;
  }

  ledLayer.geometry.attributes.position.needsUpdate = true;
}

function resetSphereDisplacementMemory() {
  if (sphereState.displacements) sphereState.displacements.fill(0);
  sphereState.ledLayers.forEach((ledLayer) => {
    ledLayer.displacements.fill(0);
    ledLayer.swell = 0;
  });
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
    DISPLAY_LAYERS.forEach((layer) => {
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

  DISPLAY_LAYERS.forEach((layer) => {
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
  DISPLAY_LAYERS.forEach((layer) => {
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
binauralInput.addEventListener("change", updateBinaural);
visualizationInput.addEventListener("change", updateVisualization);
volumeInput.addEventListener("input", () => {
  state.volume = Number(volumeInput.value);
  updateMasterGain();
});
window.addEventListener("resize", resizeCanvas);

draw();
