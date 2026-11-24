/**
 * Procedural Winter Blizzard & Howling Wind Audio Synthesizer
 * 100% Native Web Audio API - No external mp3 or audio assets required.
 */
export class BlizzardAudio {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.gainNode = null;
    this.filter1 = null;
    this.filter2 = null;
    this.lfo = null;
    this.lfoGain = null;
    this.volume = 0.35;
    this.windSpeed = 1.0;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Create 5-second looping stereo pink/white noise buffer
    const bufferSize = this.ctx.sampleRate * 5;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    const left = noiseBuffer.getChannelData(0);
    const right = noiseBuffer.getChannelData(1);

    let b0_l = 0, b1_l = 0, b2_l = 0;
    let b0_r = 0, b1_r = 0, b2_r = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white_l = Math.random() * 2 - 1;
      const white_r = Math.random() * 2 - 1;

      // Pink noise filtering approximation
      b0_l = 0.99765 * b0_l + white_l * 0.0990460;
      b1_l = 0.96300 * b1_l + white_l * 0.2965164;
      b2_l = 0.57000 * b2_l + white_l * 1.0526913;
      left[i] = (b0_l + b1_l + b2_l + white_l * 0.1848) * 0.12;

      b0_r = 0.99765 * b0_r + white_r * 0.0990460;
      b1_r = 0.96300 * b1_r + white_r * 0.2965164;
      b2_r = 0.57000 * b2_r + white_r * 1.0526913;
      right[i] = (b0_r + b1_r + b2_r + white_r * 0.1848) * 0.12;
    }

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    // Resonant bandpass filter for cold whistling wind
    this.filter1 = this.ctx.createBiquadFilter();
    this.filter1.type = 'bandpass';
    this.filter1.frequency.value = 380;
    this.filter1.Q.value = 3.5;

    // Lowpass filter for deep canyon rumbles
    this.filter2 = this.ctx.createBiquadFilter();
    this.filter2.type = 'lowpass';
    this.filter2.frequency.value = 450;

    // LFO for periodic gusting wind variations
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.18; // Slow gust cycle
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 180;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter1.frequency);

    // Master Volume Gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0;

    // Signal chain
    this.noiseSource.connect(this.filter1);
    this.noiseSource.connect(this.filter2);
    this.filter1.connect(this.gainNode);
    this.filter2.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.noiseSource.start(0);
    this.lfo.start(0);
  }

  toggle() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = !this.isPlaying;
    const now = this.ctx.currentTime;
    if (this.isPlaying) {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 1.2);
    } else {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    }
    return this.isPlaying;
  }

  setIntensity(level) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (level === 0) {
      // Light breeze
      this.filter1.frequency.setTargetAtTime(260, now, 0.5);
      this.filter1.Q.setTargetAtTime(2.0, now, 0.5);
      this.lfo.frequency.setTargetAtTime(0.12, now, 0.5);
    } else if (level === 1) {
      // Moderate wind
      this.filter1.frequency.setTargetAtTime(390, now, 0.5);
      this.filter1.Q.setTargetAtTime(3.8, now, 0.5);
      this.lfo.frequency.setTargetAtTime(0.22, now, 0.5);
    } else {
      // Roaring blizzard
      this.filter1.frequency.setTargetAtTime(540, now, 0.5);
      this.filter1.Q.setTargetAtTime(5.5, now, 0.5);
      this.lfo.frequency.setTargetAtTime(0.45, now, 0.5);
    }
  }
}
