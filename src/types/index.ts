export type InputSourceMode = "live-mono" | "live-stereo" | "synthetic";

export type SignalQuality = "GOOD" | "LOW_LEVEL" | "CLIPPING" | "UNSTABLE" | "NO_SIGNAL";

export interface SignalFrame {
  timestamp: number;
  sampleRate: number;
  bufferSize: number;
  // Time domain PCM
  timeDataLeft: Float32Array;
  timeDataRight?: Float32Array;
  // Frequency domain
  freqDataLeft: Float32Array;
  freqDataRight?: Float32Array;
  // Analyzed features
  dominantFrequency: number;
  rawDominantFrequency: number;
  rmsAmplitude: number;
  peakAmplitude: number;
  phaseDeg: number | null; // null if mono non-simulated
  quality: SignalQuality;
  isStereo: boolean;
  isSynthetic: boolean;
}

export interface PureToneConfig {
  refFrequency: number;     // f0 (Hz), default 440
  refAmplitude: number;     // A0 (normalized 0~1), default 0.7
  refPhase: number;         // phi0 (deg), default 90
  tolFrequency: number;     // Tf (Hz), default 5
  tolAmplitude: number;     // TA (0~1), default 0.15
  tolPhase: number;         // Tphi (deg), default 10
  weightFreq: number;       // wf, default 0.45
  weightAmp: number;        // wA, default 0.10
  weightPhase: number;      // wphi, default 0.45
  threshold: number;        // D threshold, default 1.0
  autoNormalize: boolean;   // Normalize weights so sum is 1.0
  useSimulatedRefForMono: boolean; // In mono mode, compare phase against simulated 440Hz reference
}

export interface PureToneResult {
  measuredFrequency: number;
  measuredAmplitude: number;
  measuredPhase: number | null;
  errorFreq: number;
  errorAmp: number;
  errorPhase: number | null; // circular distance
  dFreq: number;             // |f - f0| / Tf
  dAmp: number;              // |A - A0| / TA
  dPhase: number | null;     // circularError / Tphi
  score: number;             // final D
  pass: boolean;             // D < threshold
  contribFreq: number;       // wf * dFreq
  contribAmp: number;        // wA * dAmp
  contribPhase: number;      // wphi * dPhase
  normalizedWf: number;
  normalizedWa: number;
  normalizedWphi: number;
  phaseAvailable: boolean;
}

export interface CalibrationResult {
  id: string;
  name: string;
  timestamp: number;
  durationSec: number;
  samplesCollected: number;
  avgFrequency: number;
  sdFrequency: number;
  avgAmplitude: number;
  sdAmplitude: number;
  avgPhase: number | null;
  sdPhase: number | null;
}

export interface ExperimentTrial {
  trialId: string;
  experimentName: string;
  condition: string;
  timestamp: number;
  formattedTime: string;
  refFrequency: number;
  measuredFrequency: number;
  freqError: number;
  refAmplitude: number;
  measuredAmplitude: number;
  ampError: number;
  refPhase: number;
  measuredPhase: number | null;
  phaseError: number | null;
  wf: number;
  wA: number;
  wPhase: number;
  Tf: number;
  TA: number;
  TPhase: number;
  score: number;
  pass: boolean;
  mode: InputSourceMode;
  quality: SignalQuality;
}

export interface LissajousSimParams {
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phaseDeg: number;
  delta: number; // phase drift speed
}

export interface VoiceFeatures {
  durationSec: number;
  sampleRate: number;
  avgRms: number;
  peakRms: number;
  meanPitchHz: number | null;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralBandwidth: number;
  zeroCrossingRate: number;
  dominantBands: number[];
  envelope: Float32Array;
  stftSpectrogram: {
    times: number[];
    freqs: number[];
    matrix: Float32Array[]; // [timeIndex][freqBinIndex] = magnitude (dB)
    maxDb: number;
    minDb: number;
  };
  pcmData: Float32Array;
}

export interface AppSettings {
  selectedDeviceId: string;
  fftSize: number;
  smoothingTimeConstant: number;
  movingAverageFrames: number;
  maxDisplayFrequency: number;
  pureToneConfig: PureToneConfig;
}
