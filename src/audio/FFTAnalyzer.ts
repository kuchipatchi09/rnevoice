/**
 * Scientific FFT Analysis with Quadratic Peak Interpolation and Windowing
 */

export class FFTAnalyzer {
  /**
   * Applies a Hann (Hanning) window to time-domain PCM samples
   */
  static applyHannWindow(input: Float32Array): Float32Array {
    const n = input.length;
    const output = new Float32Array(n);
    const factor = (2 * Math.PI) / (n - 1);
    for (let i = 0; i < n; i++) {
      const w = 0.5 * (1 - Math.cos(factor * i));
      output[i] = input[i] * w;
    }
    return output;
  }

  /**
   * Estimates the dominant frequency using quadratic interpolation around the peak FFT magnitude bin.
   * 
   * Given peak bin k, with neighbors alpha = logMag[k-1], beta = logMag[k], gamma = logMag[k+1]:
   * Interpolated bin offset: p = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma)
   * True frequency = (k + p) * (sampleRate / fftSize)
   */
  static estimateDominantFrequency(
    freqDataDb: Float32Array,
    sampleRate: number,
    fftSize: number,
    minFreq: number = 20,
    maxFreq: number = 5000
  ): { peakFrequency: number; rawBinFrequency: number; peakDb: number; peakIndex: number } {
    const binResolution = sampleRate / fftSize;
    const minBin = Math.max(1, Math.floor(minFreq / binResolution));
    const maxBin = Math.min(freqDataDb.length - 2, Math.ceil(maxFreq / binResolution));

    let maxDb = -Infinity;
    let peakIndex = minBin;

    for (let i = minBin; i <= maxBin; i++) {
      if (freqDataDb[i] > maxDb) {
        maxDb = freqDataDb[i];
        peakIndex = i;
      }
    }

    // If signal is essentially silence (-100dB or lower)
    if (maxDb < -90) {
      return {
        peakFrequency: 0,
        rawBinFrequency: 0,
        peakDb: maxDb,
        peakIndex: 0
      };
    }

    const rawBinFrequency = peakIndex * binResolution;

    // Boundary check for quadratic interpolation
    if (peakIndex <= 0 || peakIndex >= freqDataDb.length - 1) {
      return {
        peakFrequency: rawBinFrequency,
        rawBinFrequency,
        peakDb: maxDb,
        peakIndex
      };
    }

    const alpha = freqDataDb[peakIndex - 1];
    const beta = freqDataDb[peakIndex];
    const gamma = freqDataDb[peakIndex + 1];

    const denom = alpha - 2 * beta + gamma;
    let p = 0;
    if (Math.abs(denom) > 1e-7) {
      p = 0.5 * (alpha - gamma) / denom;
      // Clamp p to [-1, 1] to prevent wild extrapolation
      p = Math.max(-1, Math.min(1, p));
    }

    const peakFrequency = Math.max(0, (peakIndex + p) * binResolution);
    const peakDb = beta - 0.25 * (alpha - gamma) * p;

    return {
      peakFrequency,
      rawBinFrequency,
      peakDb,
      peakIndex
    };
  }

  /**
   * Computes Root Mean Square (RMS) and Peak Amplitude of normalized audio [-1.0, 1.0]
   */
  static computeAmplitudeMetrics(timeData: Float32Array): { rms: number; peak: number } {
    let sumSquares = 0;
    let peak = 0;
    const len = timeData.length;

    for (let i = 0; i < len; i++) {
      const val = timeData[i];
      const absVal = Math.abs(val);
      if (absVal > peak) peak = absVal;
      sumSquares += val * val;
    }

    const rms = len > 0 ? Math.sqrt(sumSquares / len) : 0;
    return { rms, peak };
  }

  /**
   * Fast Discrete Fourier Transform (DFT) at a specific target frequency or bin
   * Used for high-precision complex phase computation arg(X[k])
   */
  static computeComplexDftBin(
    timeData: Float32Array,
    targetFreqHz: number,
    sampleRate: number
  ): { real: number; imag: number; magnitude: number; phaseRad: number; phaseDeg: number } {
    const N = timeData.length;
    let real = 0;
    let imag = 0;
    const omega = (2 * Math.PI * targetFreqHz) / sampleRate;

    for (let n = 0; n < N; n++) {
      const sample = timeData[n];
      const angle = omega * n;
      real += sample * Math.cos(angle);
      imag -= sample * Math.sin(angle); // e^(-j*omega*n) = cos - j*sin
    }

    real /= N;
    imag /= N;

    const magnitude = Math.sqrt(real * real + imag * imag);
    let phaseRad = Math.atan2(imag, real);
    let phaseDeg = (phaseRad * 180) / Math.PI;
    if (phaseDeg < 0) phaseDeg += 360;

    return { real, imag, magnitude, phaseRad, phaseDeg };
  }
}
