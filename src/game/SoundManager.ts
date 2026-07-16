export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  
  // Music nodes
  private musicIntervalId: any = null;

  constructor() {
    // Audio Context is initialized lazily upon first user interaction to bypass browser policies
  }

  private initCtx(): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.initCtx();
    
    if (this.isMuted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }

    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  // --- MUSIC SYNTHESIZER ---
  public startMusic(): void {
    this.initCtx();
    if (this.isMuted || !this.ctx) return;
    this.stopMusic();

    // Pentatonic scale notes (C4, D4, E4, G4, A4, C5)
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    
    // Play a gentle note every 4 seconds
    this.musicIntervalId = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      
      const freq = notes[Math.floor(Math.random() * notes.length)];
      this.playGentlePad(freq, 3.5);
    }, 4000);
  }

  public stopMusic(): void {
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  private playGentlePad(frequency: number, duration: number): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle'; // Smooth flute-like tone
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    
    // Soft attack, long release envelope
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 1.0); // very quiet ambient pad
    gain.gain.setValueAtTime(0.04, t + duration - 1.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  // --- SOUND EFFECTS (SFX) ---
  
  public playClick(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  public playPlow(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Simulate scratching dirt using low frequency noise sweep
    const bufferSize = this.ctx.sampleRate * 0.15; // 0.15s duration
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    // Filter to make it sound like dirt
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.16);
  }

  public playWater(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Water spray sound using filtered white noise
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.26);
  }

  public playPlant(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  public playHarvest(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Resonant bubble pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  public playCoin(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Clear chime arpeggio (C6 then G6)
    const t = this.ctx.currentTime;
    
    // Note 1
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, t); // C6
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.15);

    // Note 2 (slightly offset)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567.98, t + 0.08); // G6
    gain2.gain.setValueAtTime(0.12, t + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.3);
  }

  public playLevelUp(): void {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Upward pentatonic sweep
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const ctx = this.ctx;
    const t = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      
      gain.gain.setValueAtTime(0.08, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.35);
    });
  }
}
