/** Sons curtinhos sintetizados na hora — nenhum arquivo externo é necessário. */
export class Sound {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  tone(frequency, duration, { type = 'sine', gain = 0.12, slideTo = null, delay = 0 } = {}) {
    if (!this.enabled) return;
    const context = this.ensure();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  horn() {
    this.tone(196, 0.55, { type: 'sawtooth', gain: 0.08 });
    this.tone(147, 0.6, { type: 'sawtooth', gain: 0.06 });
  }

  bell() {
    this.tone(1046, 0.5, { type: 'triangle', gain: 0.1 });
    this.tone(1568, 0.35, { type: 'sine', gain: 0.05, delay: 0.03 });
  }

  board() {
    [523, 659, 784].forEach((note, i) => {
      this.tone(note, 0.22, { type: 'triangle', gain: 0.09, delay: i * 0.08 });
    });
  }

  deliver() {
    [784, 880, 1046, 1318].forEach((note, i) => {
      this.tone(note, 0.26, { type: 'triangle', gain: 0.09, delay: i * 0.09 });
    });
  }

  victory() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((note, i) => {
      this.tone(note, 0.38, { type: 'triangle', gain: 0.1, delay: i * 0.16 });
    });
  }
}
