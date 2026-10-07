export class STFTAnalyzer {
  /**
   * Performs STFT on an audio buffer
   * @param pcmData Full recorded Float32Array PCM samples
   * @param sampleRate Audio sample rate
   * @param fftSize Window/FFT size (default 2048)
   * @param hopSize Step size between frames (default 512)
   * @param maxFreq Max frequency to include in spectrogram (default 5000Hz)
   */
  static computeSTFT(
    pcmData: Float32Array,
    sampleRate: number,
    fftSize: number = 2048,
    hopSize: number = 512,
    maxFreq: number = 5000
  ): {
    times: number[];
    freqs: number[];
    matrix: Float32Array[];
    maxDb: number;
    minDb: number;
  } {
    const totalSamples = pcmData.length;
    const numFrames = Math.max(1, Math.floor((totalSamples - fftSize) / hopSize) + 1);
    
    // Calculate frequency bins
    const binResolution = sampleRate / fftSize;
    const maxBin = Math.min(Math.floor(fftSize / 2), Math.ceil(maxFreq / binResolution));
    
    const freqs: number[] = [];
    for (let k = 0; k <= maxBin; k++) {
      freqs.push(k * binResolution);
    }

    const times: number[] = [];
    const matrix: Float32Array[] = [];

    // Precompute Hann window
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    let globalMaxDb = -Infinity;
    let globalMinDb = Infinity;

    // Allocate frame buffer
    const frameBuffer = new Float32Array(fftSize);

    for (let f = 0; f < numFrames; f++) {
      const startIdx = f * hopSize;
      const timeSec = (startIdx + fftSize / 2) / sampleRate;
      times.push(timeSec);

      // Windowed frame
      for (let i = 0; i < fftSize; i++) {
        const idx = startIdx + i;
        frameBuffer[i] = idx < totalSamples ? pcmData[idx] * window[i] : 0;
      }

      // Compute Real FFT magnitudes using Radix-2 Cooley-Tukey
      const magDb = this.computeFrameMagnitudes(frameBuffer, maxBin);

      for (let k = 0; k <= maxBin; k++) {
        const val = magDb[k];
        if (val > globalMaxDb) globalMaxDb = val;
        if (val < globalMinDb && val > -120) globalMinDb = val;
      }

      matrix.push(magDb);
    }

    if (globalMinDb === Infinity) globalMinDb = -100;
    if (globalMaxDb === -Infinity) globalMaxDb = 0;

    return {
      times,
      freqs,
      matrix,
      maxDb: globalMaxDb,
      minDb: globalMinDb
    };
  }

  /**
   * Fast Cooley-Tukey Radix-2 FFT for frame magnitudes
   */
  private static computeFrameMagnitudes(frame: Float32Array, maxBin: number): Float32Array {
    const N = frame.length;
    const real = new Float32Array(frame);
    const imag = new Float32Array(N);

    // Bit reversal
    let j = 0;
    for (let i = 0; i < N - 1; i++) {
      if (i < j) {
        const tr = real[i];
        real[i] = real[j];
        real[j] = tr;
        const ti = imag[i];
        imag[i] = imag[j];
        imag[j] = ti;
      }
      let k = N >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // FFT stages
    for (let len = 2; len <= N; len <<= 1) {
      const halfLen = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < N; i += len) {
        let wr = 1;
        let wi = 0;
        for (let k = 0; k < halfLen; k++) {
          const uR = real[i + k];
          const uI = imag[i + k];
          const vR = real[i + k + halfLen] * wr - imag[i + k + halfLen] * wi;
          const vI = real[i + k + halfLen] * wi + imag[i + k + halfLen] * wr;

          real[i + k] = uR + vR;
          imag[i + k] = uI + vI;
          real[i + k + halfLen] = uR - vR;
          imag[i + k + halfLen] = uI - vI;

          const nextWr = wr * wStepR - wi * wStepI;
          wi = wr * wStepI + wi * wStepR;
          wr = nextWr;
        }
      }
    }

    const output = new Float32Array(maxBin + 1);
    const eps = 1e-10;
    for (let k = 0; k <= maxBin; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / N;
      output[k] = 20 * Math.log10(mag + eps);
    }

    return output;
  }

  /**
   * Computes Spectral Centroid (Center of Mass of spectrum)
   */
  static computeSpectralCentroid(magnitudes: Float32Array, sampleRate: number, fftSize: number): number {
    const binResolution = sampleRate / fftSize;
    let num = 0;
    let den = 0;
    const len = magnitudes.length;

    for (let k = 0; k < len; k++) {
      const freq = k * binResolution;
      const mag = Math.pow(10, magnitudes[k] / 20);
      num += freq * mag;
      den += mag;
    }

    return den > 1e-9 ? num / den : 0;
  }

  /**
   * Computes Spectral Rolloff (Frequency below which 85% of total energy resides)
   */
  static computeSpectralRolloff(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number,
    thresholdPct: number = 0.85
  ): number {
    const binResolution = sampleRate / fftSize;
    const len = magnitudes.length;
    let totalEnergy = 0;
    const linearMags = new Float32Array(len);

    for (let k = 0; k < len; k++) {
      const mag = Math.pow(10, magnitudes[k] / 20);
      linearMags[k] = mag * mag;
      totalEnergy += linearMags[k];
    }

    const targetEnergy = totalEnergy * thresholdPct;
    let cumulativeEnergy = 0;

    for (let k = 0; k < len; k++) {
      cumulativeEnergy += linearMags[k];
      if (cumulativeEnergy >= targetEnergy) {
        return k * binResolution;
      }
    }

    return (len - 1) * binResolution;
  }

  /**
   * Computes Zero Crossing Rate (ZCR)
   */
  static computeZCR(pcmData: Float32Array): number {
    const len = pcmData.length;
    if (len < 2) return 0;
    let zeroCrossings = 0;
    for (let i = 1; i < len; i++) {
      if ((pcmData[i] >= 0 && pcmData[i - 1] < 0) || (pcmData[i] < 0 && pcmData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    return zeroCrossings / (len - 1);
  }
}
