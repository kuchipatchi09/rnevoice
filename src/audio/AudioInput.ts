import { SignalFrame, InputSourceMode, SignalQuality } from "../types/index.ts";
import { FFTAnalyzer } from "./FFTAnalyzer.ts";
import { PhaseAnalyzer } from "./PhaseAnalyzer.ts";

export interface AudioInputConfig {
  fftSize: number;
  smoothingTimeConstant: number;
  movingAverageFrames: number;
  deviceId?: string;
  forceStereo?: boolean;
}

export class AudioInput {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;

  // Synthetic Test Signal Node
  private syntheticNode: AudioNode | null = null;
  private isSyntheticActive = false;

  // Buffers
  private timeBufferLeft: Float32Array = new Float32Array(2048);
  private timeBufferRight: Float32Array = new Float32Array(2048);
  private freqBufferLeft: Float32Array = new Float32Array(1024);
  private freqBufferRight: Float32Array = new Float32Array(1024);

  // Smoothing buffers (for moving average / median)
  private freqHistory: number[] = [];
  private ampHistory: number[] = [];
  private phaseHistory: number[] = [];

  private config: AudioInputConfig = {
    fftSize: 2048,
    smoothingTimeConstant: 0.3,
    movingAverageFrames: 7
  };

  private currentMode: InputSourceMode = "live-mono";
  private isRunning = false;
  private actualChannelCount = 1;

  constructor() {
    this.timeBufferLeft = new Float32Array(this.config.fftSize);
    this.timeBufferRight = new Float32Array(this.config.fftSize);
    this.freqBufferLeft = new Float32Array(this.config.fftSize / 2);
    this.freqBufferRight = new Float32Array(this.config.fftSize / 2);
  }

  public async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput");
    } catch (e) {
      console.warn("Could not enumerate audio devices:", e);
      return [];
    }
  }

  public async startMicrophone(deviceId?: string, requestStereo: boolean = true): Promise<boolean> {
    this.stop();

    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: requestStereo ? { ideal: 2 } : { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 }
        },
        video: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTracks = this.mediaStream.getAudioTracks();
      const settings = audioTracks.length > 0 ? audioTracks[0].getSettings() : {};
      this.actualChannelCount = settings.channelCount || 1;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create Analysers
      this.setupAnalysers();

      if (this.actualChannelCount >= 2) {
        this.splitterNode = this.audioContext.createChannelSplitter(2);
        this.sourceNode.connect(this.splitterNode);
        if (this.analyserLeft && this.analyserRight) {
          this.splitterNode.connect(this.analyserLeft, 0);
          this.splitterNode.connect(this.analyserRight, 1);
        }
        this.currentMode = "live-stereo";
      } else {
        if (this.analyserLeft) {
          this.sourceNode.connect(this.analyserLeft);
        }
        this.currentMode = "live-mono";
      }

      this.isSyntheticActive = false;
      this.isRunning = true;
      return true;
    } catch (err) {
      console.error("Failed to acquire microphone stream:", err);
      this.isRunning = false;
      throw err;
    }
  }

  public startSyntheticTestSignal(freq: number = 440, amp: number = 0.7, phaseDeg: number = 90, noise: number = 0.005) {
    this.stop();

    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    this.setupAnalysers();

    const sampleRate = this.audioContext.sampleRate;
    const bufferDuration = 2.0;
    const totalFrames = Math.floor(sampleRate * bufferDuration);
    const audioBuffer = this.audioContext.createBuffer(2, totalFrames, sampleRate);
    
    const leftData = audioBuffer.getChannelData(0);
    const rightData = audioBuffer.getChannelData(1);
    const phaseRad = (phaseDeg * Math.PI) / 180;
    const omega = 2 * Math.PI * freq;

    for (let i = 0; i < totalFrames; i++) {
      const t = i / sampleRate;
      const refSignal = amp * Math.sin(omega * t);
      const randomNoise = (Math.random() * 2 - 1) * noise;
      const shiftedSignal = amp * Math.sin(omega * t + phaseRad) + randomNoise;

      leftData[i] = Math.max(-1, Math.min(1, refSignal));
      rightData[i] = Math.max(-1, Math.min(1, shiftedSignal));
    }

    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.loop = true;

    this.splitterNode = this.audioContext.createChannelSplitter(2);
    bufferSource.connect(this.splitterNode);

    if (this.analyserLeft && this.analyserRight) {
      this.splitterNode.connect(this.analyserLeft, 0);
      this.splitterNode.connect(this.analyserRight, 1);
    }

    bufferSource.start();
    this.syntheticNode = bufferSource;
    this.isSyntheticActive = true;
    this.currentMode = "synthetic";
    this.actualChannelCount = 2;
    this.isRunning = true;
  }

  public updateSyntheticParams(freq: number, amp: number, phaseDeg: number, noise: number) {
    if (this.isSyntheticActive) {
      this.startSyntheticTestSignal(freq, amp, phaseDeg, noise);
    }
  }

  private setupAnalysers() {
    if (!this.audioContext) return;

    this.analyserLeft = this.audioContext.createAnalyser();
    this.analyserLeft.fftSize = this.config.fftSize;
    this.analyserLeft.smoothingTimeConstant = this.config.smoothingTimeConstant;

    this.analyserRight = this.audioContext.createAnalyser();
    this.analyserRight.fftSize = this.config.fftSize;
    this.analyserRight.smoothingTimeConstant = this.config.smoothingTimeConstant;

    this.timeBufferLeft = new Float32Array(this.config.fftSize);
    this.timeBufferRight = new Float32Array(this.config.fftSize);
    this.freqBufferLeft = new Float32Array(this.config.fftSize / 2);
    this.freqBufferRight = new Float32Array(this.config.fftSize / 2);
  }

  public getCurrentFrame(refFreq: number = 440, useSimulatedRefForMono: boolean = true): SignalFrame | null {
    if (!this.isRunning || !this.analyserLeft || !this.audioContext) {
      return null;
    }

    const sampleRate = this.audioContext.sampleRate;
    (this.analyserLeft as unknown as { getFloatTimeDomainData: (b: Float32Array) => void }).getFloatTimeDomainData(this.timeBufferLeft);
    (this.analyserLeft as unknown as { getFloatFrequencyData: (b: Float32Array) => void }).getFloatFrequencyData(this.freqBufferLeft);

    const isStereoActive = (this.currentMode === "live-stereo" || this.currentMode === "synthetic") && !!this.analyserRight;

    if (isStereoActive && this.analyserRight) {
      (this.analyserRight as unknown as { getFloatTimeDomainData: (b: Float32Array) => void }).getFloatTimeDomainData(this.timeBufferRight);
      (this.analyserRight as unknown as { getFloatFrequencyData: (b: Float32Array) => void }).getFloatFrequencyData(this.freqBufferRight);
    }

    // Dominant Frequency Calculation with Quadratic Peak Interpolation
    const targetFreqData = isStereoActive ? this.freqBufferRight : this.freqBufferLeft;
    const targetTimeData = isStereoActive ? this.timeBufferRight : this.timeBufferLeft;

    const freqAnalysis = FFTAnalyzer.estimateDominantFrequency(
      targetFreqData,
      sampleRate,
      this.config.fftSize,
      20,
      5000
    );

    const ampMetrics = FFTAnalyzer.computeAmplitudeMetrics(targetTimeData);

    // Smoothing with Moving Average / Median
    const smoothedFreq = this.applySmoothing(this.freqHistory, freqAnalysis.peakFrequency, this.config.movingAverageFrames);
    const smoothedRms = this.applySmoothing(this.ampHistory, ampMetrics.rms, this.config.movingAverageFrames);

    // Phase Calculation
    let phaseDeg: number | null = null;

    if (isStereoActive && smoothedFreq > 20) {
      const phaseResult = PhaseAnalyzer.analyzePhaseDifference(
        this.timeBufferLeft,
        this.timeBufferRight,
        smoothedFreq,
        sampleRate
      );
      phaseDeg = this.applySmoothing(this.phaseHistory, phaseResult.deltaPhaseDeg, this.config.movingAverageFrames);
    } else if (useSimulatedRefForMono && smoothedFreq > 20) {
      // Single channel mode with simulated reference phase
      const simPhase = PhaseAnalyzer.analyzePhaseWithSyntheticReference(targetTimeData, refFreq, sampleRate);
      phaseDeg = this.applySmoothing(this.phaseHistory, simPhase.phaseDeg, this.config.movingAverageFrames);
    }

    // Signal Quality assessment
    const quality = this.evaluateSignalQuality(smoothedRms, ampMetrics.peak, this.freqHistory);

    return {
      timestamp: performance.now(),
      sampleRate,
      bufferSize: this.config.fftSize,
      timeDataLeft: this.timeBufferLeft,
      timeDataRight: isStereoActive ? this.timeBufferRight : undefined,
      freqDataLeft: this.freqBufferLeft,
      freqDataRight: isStereoActive ? this.freqBufferRight : undefined,
      dominantFrequency: smoothedFreq,
      rawDominantFrequency: freqAnalysis.peakFrequency,
      rmsAmplitude: smoothedRms,
      peakAmplitude: ampMetrics.peak,
      phaseDeg,
      quality,
      isStereo: isStereoActive,
      isSynthetic: this.isSyntheticActive
    };
  }

  private applySmoothing(history: number[], newValue: number, maxFrames: number): number {
    if (isNaN(newValue)) return 0;
    history.push(newValue);
    if (history.length > maxFrames) {
      history.shift();
    }
    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  }

  private evaluateSignalQuality(rms: number, peak: number, freqHist: number[]): SignalQuality {
    if (rms < 0.005) return "NO_SIGNAL";
    if (rms < 0.02) return "LOW_LEVEL";
    if (peak >= 0.98) return "CLIPPING";

    if (freqHist.length >= 5) {
      const mean = freqHist.reduce((a, b) => a + b, 0) / freqHist.length;
      const variance = freqHist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / freqHist.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 25 && mean > 50) {
        return "UNSTABLE";
      }
    }

    return "GOOD";
  }

  public stop() {
    this.isRunning = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.syntheticNode) {
      try {
        (this.syntheticNode as AudioBufferSourceNode).stop();
      } catch {}
      this.syntheticNode.disconnect();
      this.syntheticNode = null;
    }
    this.freqHistory = [];
    this.ampHistory = [];
    this.phaseHistory = [];
  }

  public setFftSize(size: number) {
    this.config.fftSize = size;
    if (this.analyserLeft) this.analyserLeft.fftSize = size;
    if (this.analyserRight) this.analyserRight.fftSize = size;
    this.setupAnalysers();
  }

  public setSmoothingTimeConstant(value: number) {
    this.config.smoothingTimeConstant = value;
    if (this.analyserLeft) this.analyserLeft.smoothingTimeConstant = value;
    if (this.analyserRight) this.analyserRight.smoothingTimeConstant = value;
  }

  public getMode(): InputSourceMode {
    return this.currentMode;
  }

  public getSampleRate(): number {
    return this.audioContext ? this.audioContext.sampleRate : 48000;
  }

  public getActualChannelCount(): number {
    return this.actualChannelCount;
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}
