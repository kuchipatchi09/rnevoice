import { VoiceFeatures } from "../types/index.ts";
import { STFTAnalyzer } from "../audio/STFTAnalyzer.ts";
import { PitchAnalyzer } from "../audio/PitchAnalyzer.ts";
import { EnvelopeAnalyzer } from "../audio/EnvelopeAnalyzer.ts";
import { FFTAnalyzer } from "../audio/FFTAnalyzer.ts";

export interface VoiceDistanceWeights {
  wSpectrum: number;
  wEnvelope: number;
  wPitch: number;
  wDuration: number;
  wRhythm: number;
}

export class VoiceFeatureExtractor {
  /**
   * Extracts acoustic and spectral features from recorded audio
   */
  static extractFeatures(pcmData: Float32Array, sampleRate: number): VoiceFeatures {
    const durationSec = pcmData.length / sampleRate;

    // Amplitude metrics
    const { rms: avgRms, peak: peakRms } = FFTAnalyzer.computeAmplitudeMetrics(pcmData);

    // Pitch estimation using central portion of audio for stability
    const midStart = Math.floor(pcmData.length * 0.25);
    const midEnd = Math.floor(pcmData.length * 0.75);
    const midBuffer = pcmData.slice(midStart, midEnd);
    const pitchResult = PitchAnalyzer.estimatePitchAutocorr(midBuffer, sampleRate, 60, 500);

    // Amplitude Envelope
    const { envelope } = EnvelopeAnalyzer.computeRmsEnvelope(pcmData, sampleRate, 30, 10);

    // STFT Spectrogram
    const stftResult = STFTAnalyzer.computeSTFT(pcmData, sampleRate, 2048, 512, 5000);

    // Global Spectrum for Spectral Features
    const avgSpectrogramMag = this.computeAverageSpectrum(stftResult.matrix);

    const spectralCentroid = STFTAnalyzer.computeSpectralCentroid(avgSpectrogramMag, sampleRate, 2048);
    const spectralRolloff = STFTAnalyzer.computeSpectralRolloff(avgSpectrogramMag, sampleRate, 2048, 0.85);
    const spectralBandwidth = this.computeSpectralBandwidth(avgSpectrogramMag, spectralCentroid, sampleRate, 2048);
    const zcr = STFTAnalyzer.computeZCR(pcmData);

    // Find top dominant frequency bands
    const dominantBands = this.findDominantBands(avgSpectrogramMag, sampleRate, 2048, 3);

    return {
      durationSec,
      sampleRate,
      avgRms,
      peakRms,
      meanPitchHz: pitchResult.pitchHz,
      spectralCentroid,
      spectralRolloff,
      spectralBandwidth,
      zeroCrossingRate: zcr,
      dominantBands,
      envelope,
      stftSpectrogram: stftResult,
      pcmData
    };
  }

  private static computeAverageSpectrum(matrix: Float32Array[]): Float32Array {
    if (matrix.length === 0) return new Float32Array(1024);
    const numBins = matrix[0].length;
    const avg = new Float32Array(numBins);

    for (let f = 0; f < matrix.length; f++) {
      const frame = matrix[f];
      for (let k = 0; k < numBins; k++) {
        avg[k] += frame[k];
      }
    }

    for (let k = 0; k < numBins; k++) {
      avg[k] /= matrix.length;
    }

    return avg;
  }

  private static computeSpectralBandwidth(
    magnitudes: Float32Array,
    centroid: number,
    sampleRate: number,
    fftSize: number
  ): number {
    const binResolution = sampleRate / fftSize;
    let num = 0;
    let den = 0;
    const len = magnitudes.length;

    for (let k = 0; k < len; k++) {
      const freq = k * binResolution;
      const mag = Math.pow(10, magnitudes[k] / 20);
      num += Math.pow(freq - centroid, 2) * mag;
      den += mag;
    }

    return den > 1e-9 ? Math.sqrt(num / den) : 0;
  }

  private static findDominantBands(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number,
    topN: number = 3
  ): number[] {
    const binResolution = sampleRate / fftSize;
    const indexed = Array.from(magnitudes).map((val, idx) => ({
      freq: idx * binResolution,
      val
    })).filter(item => item.freq >= 80 && item.freq <= 4000);

    indexed.sort((a, b) => b.val - a.val);

    // Peak separation filter
    const peaks: number[] = [];
    for (const item of indexed) {
      if (peaks.length >= topN) break;
      const isDistinct = peaks.every(p => Math.abs(p - item.freq) > 100);
      if (isDistinct) {
        peaks.push(Math.round(item.freq));
      }
    }

    return peaks.sort((a, b) => a - b);
  }

  /**
   * Extensible Voice Authentication Distance Metric
   * D_voice = w1 * D_spectrum + w2 * D_envelope + w3 * D_pitch + w4 * D_duration + w5 * D_rhythm
   */
  static computeVoiceDistance(
    feat1: VoiceFeatures,
    feat2: VoiceFeatures,
    weights: VoiceDistanceWeights = {
      wSpectrum: 0.35,
      wEnvelope: 0.25,
      wPitch: 0.20,
      wDuration: 0.10,
      wRhythm: 0.10
    }
  ): {
    totalDistance: number;
    dSpectrum: number;
    dEnvelope: number;
    dPitch: number;
    dDuration: number;
    dRhythm: number;
  } {
    // 1. Spectrum Distance (Normalized Euclidean on Centroid & Rolloff)
    const centroidDiff = Math.abs(feat1.spectralCentroid - feat2.spectralCentroid) / 1000;
    const rolloffDiff = Math.abs(feat1.spectralRolloff - feat2.spectralRolloff) / 2000;
    const dSpectrum = Math.min(2.0, (centroidDiff + rolloffDiff) / 2);

    // 2. Envelope Distance (Resampled MSE)
    const env1 = EnvelopeAnalyzer.resampleEnvelope(feat1.envelope, 100);
    const env2 = EnvelopeAnalyzer.resampleEnvelope(feat2.envelope, 100);
    let envMse = 0;
    for (let i = 0; i < 100; i++) {
      envMse += Math.pow(env1[i] - env2[i], 2);
    }
    const dEnvelope = Math.min(2.0, Math.sqrt(envMse / 100) * 5);

    // 3. Pitch Difference
    let dPitch = 0;
    if (feat1.meanPitchHz && feat2.meanPitchHz) {
      dPitch = Math.min(2.0, Math.abs(feat1.meanPitchHz - feat2.meanPitchHz) / 50);
    } else {
      dPitch = 0.5;
    }

    // 4. Duration Difference
    const dDuration = Math.min(2.0, Math.abs(feat1.durationSec - feat2.durationSec) / Math.max(0.1, feat1.durationSec));

    // 5. Rhythm / ZCR Difference
    const dRhythm = Math.min(2.0, Math.abs(feat1.zeroCrossingRate - feat2.zeroCrossingRate) * 10);

    const totalDistance =
      weights.wSpectrum * dSpectrum +
      weights.wEnvelope * dEnvelope +
      weights.wPitch * dPitch +
      weights.wDuration * dDuration +
      weights.wRhythm * dRhythm;

    return {
      totalDistance,
      dSpectrum,
      dEnvelope,
      dPitch,
      dDuration,
      dRhythm
    };
  }
}
