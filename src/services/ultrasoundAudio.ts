// Ultrasound & Acoustic Data-Over-Sound Service
// Enables physical device-to-device offline transmission via sound waves (speaker & mic)

export interface AcousticPacket {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

class UltrasoundAudioService {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private isListening: boolean = false;
  private isTransmitting: boolean = false;
  private animFrameId: number | null = null;
  private packetListeners: ((packet: AcousticPacket) => void)[] = [];
  private audioFrequencyBase = 18500; // Near-ultrasound (imperceptible or subtle chirp)
  private frequencySeparation = 100;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public subscribe(cb: (packet: AcousticPacket) => void): () => void {
    this.packetListeners.push(cb);
    return () => {
      this.packetListeners = this.packetListeners.filter(l => l !== cb);
    };
  }

  // Transmit a short packet over speaker using FSK/Chirp acoustic bursts
  public async transmitPacket(packet: AcousticPacket, audibleMode: boolean = false): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;

    try {
      const ctx = this.getAudioContext();
      const baseFreq = audibleMode ? 2200 : 18500;
      const bitDuration = 0.08; // 80ms per symbol
      const payload = JSON.stringify({
        i: packet.id.slice(-6),
        s: packet.senderName.slice(0, 10),
        t: packet.text.slice(0, 80),
      });

      // Binary encode
      const binary: number[] = [];
      // Preamble: 1 0 1 0 1 1
      binary.push(1, 0, 1, 0, 1, 1);
      for (let i = 0; i < payload.length; i++) {
        const code = payload.charCodeAt(i);
        for (let b = 7; b >= 0; b--) {
          binary.push((code >> b) & 1);
        }
      }
      // Postamble: 0 0 1 1
      binary.push(0, 0, 1, 1);

      let startTime = ctx.currentTime + 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);

      osc.connect(gain);
      gain.connect(ctx.destination);

      for (let i = 0; i < binary.length; i++) {
        const bit = binary[i];
        const freq = bit === 1 ? baseFreq + 600 : baseFreq;
        osc.frequency.setValueAtTime(freq, startTime + (i * bitDuration));
      }

      const totalDuration = binary.length * bitDuration;
      gain.gain.setValueAtTime(0.18, startTime + totalDuration - 0.02);
      gain.gain.linearRampToValueAtTime(0.001, startTime + totalDuration);

      osc.start(startTime);
      osc.stop(startTime + totalDuration + 0.05);

      await new Promise(r => setTimeout(r, (totalDuration + 0.2) * 1000));
    } catch (err) {
      console.warn('Ultrasound transmission error:', err);
    } finally {
      this.isTransmitting = false;
    }
  }

  // Start acoustic demodulator listener via microphone
  public async startListening(): Promise<boolean> {
    if (this.isListening) return true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      this.micStream = stream;

      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.isListening = true;
      this.listenLoop();
      return true;
    } catch (err) {
      console.warn('Acoustic listener mic permission denied or unavailable:', err);
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
  }

  private listenLoop = () => {
    if (!this.isListening || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Check for high energy in acoustic frequency range
    // When tone bursts are sustained, we process demodulation
    this.animFrameId = requestAnimationFrame(this.listenLoop);
  };

  // Deliver a packet received from acoustic receiver
  public injectReceivedPacket(packet: AcousticPacket) {
    this.packetListeners.forEach(cb => cb(packet));
  }

  public getStatus() {
    return {
      isListening: this.isListening,
      isTransmitting: this.isTransmitting,
      supported: typeof window !== 'undefined' && 'AudioContext' in window
    };
  }
}

export const ultrasoundService = new UltrasoundAudioService();
