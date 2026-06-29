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
  breathGain: .055,
};

class DogWhistleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.playing = false;
    this.mode = "idle";
    this.binaural = true;
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
      }
    };
  }

  process(_, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || left;
    const leftCarrierHz = this.binaural ? SIGNAL.baseHz - SIGNAL.binauralBeatHz / 2 : SIGNAL.baseHz;
    const rightCarrierHz = this.binaural ? SIGNAL.baseHz + SIGNAL.binauralBeatHz / 2 : SIGNAL.baseHz;
    const visual = new Float32Array(left.length * 14);

    for (let i = 0; i < left.length; i += 1) {
      const offset = i * 14;
      if (!this.playing) {
        left[i] = 0;
        right[i] = 0;
        for (let slot = 0; slot < 14; slot += 1) visual[offset + slot] = 0;
        continue;
      }

      const t = currentTime + i / sampleRate - this.startedAt;
      const pulse = this.mode === "pulse" ? pulseEnvelope(t) : 1;
      const carrierLeft = sine(leftCarrierHz, t) * SIGNAL.carrierGain;
      const carrierRight = sine(rightCarrierHz, t) * SIGNAL.carrierGain;
      const harmonic = sine(SIGNAL.harmonicHz, t) * SIGNAL.harmonicGain;
      const pingEnvelopeValue = pingEnvelope(t);
      const ping = sine(SIGNAL.pingHz, t) * pingEnvelopeValue * SIGNAL.pingGain;
      const pingVisual = pingEnvelopeValue * SIGNAL.pingGain * 2.4;
      const chirp = sampleChirp(t);
      const pad = sine(SIGNAL.padHz, t) * SIGNAL.padGain;
      const breathLeft = breathLayer(t, this.binaural ? "left" : "center") * SIGNAL.breathGain;
      const breathRight = this.binaural ? breathLayer(t, "right") * SIGNAL.breathGain : breathLeft;
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
    }

    this.port.postMessage(visual, [visual.buffer]);

    return true;
  }
}

function sampleChirp(t) {
  const envelope = chirpEnvelope(t);
  if (!envelope) return 0;
  const phase = positiveModulo(t, SIGNAL.chirpEverySeconds);
  const eventTime = phase - .16;
  return Math.sin(chirpPhase(eventTime)) * envelope * SIGNAL.chirpGain;
}

function chirpEnvelope(t) {
  const phase = positiveModulo(t, SIGNAL.chirpEverySeconds);
  if (phase < .22 || phase > .62) return 0;
  const eventTime = phase - .22;
  return Math.sin(Math.PI * eventTime / .4);
}

function chirpPhase(eventTime) {
  const duration = .4;
  const startHz = SIGNAL.chirpHz - 420;
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

function breathLayer(t, ear = "center") {
  const offset = ear === "right" ? .037 : 0;
  const noiseTime = t + offset;
  const cycle = positiveModulo(t + .35, 5.6) / 5.6;
  const inhale = cycle < .38 ? smoothstep(cycle / .38) : 1 - smoothstep((cycle - .38) / .62);
  const exhale = cycle < .2 ? smoothstep(cycle / .2) : 1 - smoothstep((cycle - .2) / .8);
  const envelope = .06 + inhale * .14 + exhale * .8;
  const chest = .9 + .06 * sine(.17, t + .2) + .04 * sine(.29, t + 1.3);
  const air =
    interpolatedNoise(noiseTime * 42) * .26 +
    interpolatedNoise(noiseTime * 95) * .22 +
    interpolatedNoise(noiseTime * 190) * .16 +
    interpolatedNoise(noiseTime * 360) * .1 +
    interpolatedNoise(noiseTime * 720) * .06 +
    interpolatedNoise(noiseTime * 1150) * .048 +
    interpolatedNoise(noiseTime * 1800) * .032 +
    interpolatedNoise(noiseTime * 2600) * .018 +
    interpolatedNoise(noiseTime * 3400) * .01;
  const mouth = .78 + .14 * unipolarSine(.11, t + 1.6) + .08 * unipolarSine(.23, t);
  return softClip(air * envelope * chest * mouth);
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
