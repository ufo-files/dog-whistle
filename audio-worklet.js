const TWO_PI = Math.PI * 2;
const SIGNAL = {
  binauralBeatHz: 7.83,
  baseHz: 100,
  harmonicHz: 528,
  pingHz: 17000,
  pingEverySeconds: 3,
  chirpHz: 2500,
  chirpEverySeconds: 10,
  padHz: 432,
  pulseHz: .42,
  carrierGain: .115,
  harmonicGain: .014,
  pingGain: .012,
  chirpGain: .058,
  padGain: .035,
  breathGain: .068,
  breathCycleSeconds: 16,
};
const LAYER_DEFAULTS = {
  carrier: { enabled: true, frequency: SIGNAL.baseHz },
  harmonic: { enabled: true, frequency: SIGNAL.harmonicHz },
  ping: { enabled: true, frequency: SIGNAL.pingHz },
  chirp: { enabled: true, frequency: SIGNAL.chirpHz },
  pad: { enabled: true, frequency: SIGNAL.padHz },
  breath: { enabled: true, frequency: SIGNAL.breathCycleSeconds },
};

class DogWhistleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.playing = false;
    this.mode = "idle";
    this.binaural = false;
    this.layers = createLayerSettings();
    this.startedAt = currentTime;
    this.port.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === "start") {
        this.playing = true;
        this.mode = message.mode || "straight";
        this.startedAt = currentTime;
      } else if (message.type === "stop") {
        this.playing = false;
        this.mode = "idle";
      } else if (message.type === "binaural") {
        this.binaural = Boolean(message.value);
      } else if (message.type === "layers") {
        this.layers = normalizeLayerSettings(message.layers);
      }
    };
  }

  process(_, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || left;
    const carrierHz = this.layers.carrier.frequency;
    const leftCarrierHz = this.binaural ? carrierHz - SIGNAL.binauralBeatHz / 2 : carrierHz;
    const rightCarrierHz = this.binaural ? carrierHz + SIGNAL.binauralBeatHz / 2 : carrierHz;
    const visual = new Float32Array(left.length * 15);

    for (let i = 0; i < left.length; i += 1) {
      const offset = i * 15;
      if (!this.playing) {
        left[i] = 0;
        right[i] = 0;
        for (let slot = 0; slot < 15; slot += 1) visual[offset + slot] = 0;
        continue;
      }

      const t = currentTime + i / sampleRate - this.startedAt;
      const pulse = this.mode === "pulse" ? pulseEnvelope(t) : 1;
      const breathMotion = this.layers.breath.enabled ? breathPhase(t, this.layers.breath.frequency) : 0;
      const carrierLeft = this.layers.carrier.enabled ? sine(leftCarrierHz, t) * SIGNAL.carrierGain : 0;
      const carrierRight = this.layers.carrier.enabled ? sine(rightCarrierHz, t) * SIGNAL.carrierGain : 0;
      const harmonic = this.layers.harmonic.enabled ? sine(this.layers.harmonic.frequency, t) * SIGNAL.harmonicGain : 0;
      const pingEnvelopeValue = this.layers.ping.enabled ? pingEnvelope(t) : 0;
      const ping = sine(this.layers.ping.frequency, t) * pingEnvelopeValue * SIGNAL.pingGain;
      const pingVisual = Math.sin(TWO_PI * 9 * t) * pingEnvelopeValue * SIGNAL.pingGain * 3.4;
      const chirp = this.layers.chirp.enabled ? sampleChirp(t, this.layers.chirp.frequency) : 0;
      const pad = this.layers.pad.enabled ? sine(this.layers.pad.frequency, t) * SIGNAL.padGain : 0;
      const breathLeft = this.layers.breath.enabled ? breathLayer(t, this.binaural ? "left" : "center", this.layers.breath.frequency) * SIGNAL.breathGain : 0;
      const breathRight = this.binaural && this.layers.breath.enabled ? breathLayer(t, "right", this.layers.breath.frequency) * SIGNAL.breathGain : breathLeft;
      const leftSample = clamp((carrierLeft + harmonic + ping + chirp + pad + breathLeft) * pulse, -1, 1);
      const rightSample = clamp((carrierRight + harmonic + ping + chirp + pad + breathRight) * pulse, -1, 1);

      left[i] = leftSample;
      right[i] = rightSample;
      visual[offset] = leftSample;
      visual[offset + 1] = rightSample;
      visual[offset + 2] = carrierLeft * pulse;
      visual[offset + 3] = carrierRight * pulse;
      visual[offset + 4] = harmonic * pulse;
      visual[offset + 5] = harmonic * pulse;
      visual[offset + 6] = pingVisual * pulse;
      visual[offset + 7] = pingVisual * pulse;
      visual[offset + 8] = chirp * pulse;
      visual[offset + 9] = chirp * pulse;
      visual[offset + 10] = pad * pulse;
      visual[offset + 11] = pad * pulse;
      visual[offset + 12] = breathLeft * pulse;
      visual[offset + 13] = breathRight * pulse;
      visual[offset + 14] = breathMotion * pulse;
    }

    this.port.postMessage(visual, [visual.buffer]);

    return true;
  }
}

function createLayerSettings() {
  return normalizeLayerSettings(LAYER_DEFAULTS);
}

function normalizeLayerSettings(settings) {
  return Object.entries(LAYER_DEFAULTS).reduce((layers, [id, defaults]) => {
    const input = settings && settings[id] ? settings[id] : defaults;
    const frequency = Number(input.frequency);
    layers[id] = {
      enabled: input.enabled !== false,
      frequency: Number.isFinite(frequency) ? frequency : defaults.frequency,
    };
    return layers;
  }, {});
}

function sampleChirp(t, chirpHz) {
  const envelope = chirpEnvelope(t);
  if (!envelope) return 0;
  const phase = positiveModulo(t, SIGNAL.chirpEverySeconds);
  const eventTime = phase - .16;
  return Math.sin(chirpPhase(eventTime, chirpHz)) * envelope * SIGNAL.chirpGain;
}

function chirpEnvelope(t) {
  const phase = positiveModulo(t, SIGNAL.chirpEverySeconds);
  if (phase < .22 || phase > .62) return 0;
  const eventTime = phase - .22;
  return Math.sin(Math.PI * eventTime / .4);
}

function chirpPhase(eventTime, chirpHz) {
  const duration = .4;
  const startHz = chirpHz - 420;
  const sweepHz = 840;
  const clampedTime = Math.min(duration, Math.max(0, eventTime));
  const cycles = startHz * clampedTime + (sweepHz / (2 * duration)) * clampedTime * clampedTime;
  return TWO_PI * cycles;
}

function pingEnvelope(t) {
  const phase = positiveModulo(t, SIGNAL.pingEverySeconds);
  if (phase > .14) return 0;
  return Math.sin(Math.PI * phase / .14);
}

function pulseEnvelope(t) {
  const wave = unipolarSine(SIGNAL.pulseHz, t);
  const smoothed = wave * wave * (3 - 2 * wave);
  return .18 + .82 * smoothed;
}

function breathLayer(t, ear = "center", cycleSeconds = SIGNAL.breathCycleSeconds) {
  const offset = ear === "right" ? .037 : 0;
  const noiseTime = t + offset;
  const envelope = .16 + breathPhase(t, cycleSeconds) * .66;
  const chest = .94 + .035 * sine(.17, t + .2) + .025 * sine(.29, t + 1.3);
  const air =
    interpolatedNoise(noiseTime * 85) * .2 +
    interpolatedNoise(noiseTime * 180) * .2 +
    interpolatedNoise(noiseTime * 360) * .17 +
    interpolatedNoise(noiseTime * 720) * .13 +
    interpolatedNoise(noiseTime * 1150) * .09 +
    interpolatedNoise(noiseTime * 1800) * .058 +
    interpolatedNoise(noiseTime * 2600) * .034 +
    interpolatedNoise(noiseTime * 3400) * .018;
  const mouth = .82 + .08 * unipolarSine(.37, t + 1.6) + .05 * unipolarSine(.71, t);
  return softClip(air * envelope * chest * mouth);
}

function breathPhase(t, cycleSeconds = SIGNAL.breathCycleSeconds) {
  const length = Math.max(4, cycleSeconds);
  const cycle = positiveModulo(t + .35, length) / length;
  if (cycle < .25) return smoothstep(cycle / .25);
  if (cycle < .5) return 1;
  if (cycle < .75) return 1 - smoothstep((cycle - .5) / .25);
  return 0;
}

function sine(frequency, t) {
  return Math.sin(TWO_PI * frequency * t);
}

function unipolarSine(frequency, t) {
  return .5 + .5 * sine(frequency, t);
}

function smoothstep(value) {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function softClip(value) {
  return Math.tanh(value * 1.4) / 1.4;
}

function interpolatedNoise(x) {
  const i = Math.floor(x);
  const fraction = x - i;
  const eased = fraction * fraction * (3 - 2 * fraction);
  return lerp(hashNoise(i), hashNoise(i + 1), eased);
}

function hashNoise(index) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

registerProcessor("dog-whistle-processor", DogWhistleProcessor);
