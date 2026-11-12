/**
 * Real-Audio Web Audio API Engine for VoIP Quality & Packet Degradation Simulation.
 * Uses real human speech recordings and applies physical RTP packet-loss frame dropouts (20ms frames),
 * jitter buffer variance, and ITU-T / PSTN codec bandpass filters.
 */

import { AGENT_SPEECH_BASE64, CUSTOMER_SPEECH_BASE64 } from './speechSamples';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

class AudioSimulationEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private stopCallback: (() => void) | null = null;
  private currentTimeout: number | null = null;
  private decodedBuffers: Map<string, AudioBuffer> = new Map();

  private async getContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  private async getAudioBuffer(sampleKey: 'agent' | 'customer'): Promise<AudioBuffer> {
    const ctx = await this.getContext();
    if (this.decodedBuffers.has(sampleKey)) {
      return this.decodedBuffers.get(sampleKey)!;
    }

    const base64Data = sampleKey === 'agent' ? AGENT_SPEECH_BASE64 : CUSTOMER_SPEECH_BASE64;
    const arrayBuffer = base64ToArrayBuffer(base64Data);

    // decodeAudioData consumes the arrayBuffer, so we decode once and cache it
    const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });

    this.decodedBuffers.set(sampleKey, decoded);
    return decoded;
  }

  /**
   * Plays realistic human voice audio modified by real-time VoIP transport parameters:
   * - packetLossPct: Drops 20ms RTP audio frames
   * - jitterMs: Introduces buffer flutter / jitter stutter
   * - latencyMs: Introduces propagation delay before speech starts
   * - codecId: Frequency response filtering (PSTN 300-3400Hz vs HD Voice 50-8000Hz)
   */
  public async playSimulation(
    packetLossPct: number,
    jitterMs: number,
    latencyMs: number,
    codecId: string = 'g711u',
    sampleKey: 'agent' | 'customer' = 'agent',
    onFinish?: () => void
  ): Promise<void> {
    this.stop();
    const ctx = await this.getContext();
    const audioBuffer = await this.getAudioBuffer(sampleKey);

    this.isPlaying = true;
    this.stopCallback = onFinish || null;

    // 1. Buffer Source Node
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    this.currentSource = source;

    // 2. Gain Node for Packet Loss Slicing
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

    // 3. Codec Frequency Filtering
    // G.711 / G.729: Classic PSTN telephone passband (300Hz - 3400Hz)
    // Opus / G.722: Wideband HD Voice (50Hz - 8000Hz)
    const isWideband = codecId === 'opus' || codecId === 'g722';
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(isWideband ? 60 : 300, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(isWideband ? 7800 : 3400, ctx.currentTime);

    // Master Output Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, ctx.currentTime);

    // Audio Graph Connections
    source.connect(gainNode);
    gainNode.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 4. One-Way Transmission Latency Delay
    const startDelay = Math.min(1.2, Math.max(0.02, latencyMs / 1000));
    const startTime = ctx.currentTime + startDelay;

    // 5. Simulate 20ms RTP Packet Loss Dropouts
    // Standard VoIP RTP packets are 20ms (0.020s) duration.
    const frameDuration = 0.02;
    const totalDuration = audioBuffer.duration;
    const numFrames = Math.floor(totalDuration / frameDuration);

    if (packetLossPct > 0.1) {
      for (let f = 0; f < numFrames; f++) {
        const frameTime = startTime + f * frameDuration;
        const isDropped = Math.random() * 100 < packetLossPct;

        if (isDropped) {
          // Zero-gain dropout for 20ms frame with 1ms micro-fade to avoid harsh digital clicks
          gainNode.gain.setValueAtTime(0.0001, frameTime);
          gainNode.gain.setValueAtTime(0.0001, frameTime + frameDuration * 0.94);
          gainNode.gain.setValueAtTime(1.0, frameTime + frameDuration);
        }
      }
    }

    // 6. Simulate Jitter Buffer Flutter
    if (jitterMs > 25) {
      const jitterSlices = Math.floor(totalDuration / 0.1);
      for (let j = 0; j < jitterSlices; j++) {
        const sliceTime = startTime + j * 0.1;
        if (Math.random() < 0.25) {
          const rateFluctuation = 1.0 + ((Math.random() - 0.5) * jitterMs) / 350;
          source.playbackRate.setValueAtTime(
            Math.max(0.7, Math.min(1.3, rateFluctuation)),
            sliceTime
          );
          source.playbackRate.setValueAtTime(1.0, sliceTime + 0.08);
        }
      }
    }

    // Start source playback after transmission delay
    source.start(startTime);

    // Schedule finish
    const totalMs = (startDelay + totalDuration) * 1000 + 100;
    this.currentTimeout = window.setTimeout(() => {
      this.isPlaying = false;
      this.currentSource = null;
      if (this.stopCallback) {
        this.stopCallback();
      }
    }, totalMs);

    source.onended = () => {
      // Natural end if finished before timeout
      if (this.isPlaying) {
        this.isPlaying = false;
        this.currentSource = null;
        if (this.stopCallback) {
          this.stopCallback();
        }
      }
    };
  }

  public stop(): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {}
      try {
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }

    this.isPlaying = false;
    if (this.stopCallback) {
      const cb = this.stopCallback;
      this.stopCallback = null;
      cb();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioSimulator = new AudioSimulationEngine();
