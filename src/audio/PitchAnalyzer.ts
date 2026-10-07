/**
 * Real-time Voice Pitch (F0) Estimation using Autocorrelation & Normalized Difference
 */
export class PitchAnalyzer {
  /**
   * Estimates fundamental frequency (pitch) of a voice signal buffer using Autocorrelation
   * @param buffer PCM audio samples
   * @param sampleRate Audio sample rate in Hz
   * @param minPitchHz Minimum pitch to detect (default 60Hz)
   * @param maxPitchHz Maximum pitch to detect (default 500Hz)
   */
  static estimatePitchAutocorr(
    buffer: Float32Array,
    sampleRate: number,
    minPitchHz: number = 60,
    maxPitchHz: number = 500
  ): { pitchHz: number | null; confidence: number } {
    const size = buffer.length;
    let rms = 0;
    for (let i = 0; i < size; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / size);

    // If signal is too quiet, no pitch
    if (rms < 0.015) {
      return { pitchHz: null, confidence: 0 };
    }

    const minPeriod = Math.floor(sampleRate / maxPitchHz);
    const maxPeriod = Math.floor(sampleRate / minPitchHz);

    // Normalized autocorrelation
    let bestCorrelation = -1;
    let bestPeriod = -1;

    // Normalization factor (energy)
    let energy0 = 0;
    for (let i = 0; i < size - maxPeriod; i++) {
      energy0 += buffer[i] * buffer[i];
    }

    if (energy0 < 1e-6) {
      return { pitchHz: null, confidence: 0 };
    }

    const correlations = new Float32Array(maxPeriod + 2);

    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      let corr = 0;
      let energyLag = 0;
      const len = size - lag;

      for (let i = 0; i < len; i++) {
        corr += buffer[i] * buffer[i + lag];
        energyLag += buffer[i + lag] * buffer[i + lag];
      }

      const norm = Math.sqrt(energy0 * energyLag);
      const normalizedCorr = norm > 0 ? corr / norm : 0;
      correlations[lag] = normalizedCorr;

      if (normalizedCorr > bestCorrelation) {
        bestCorrelation = normalizedCorr;
        bestPeriod = lag;
      }
    }

    // Confidence threshold (human voice typically > 0.45)
    if (bestCorrelation < 0.4 || bestPeriod <= 0) {
      return { pitchHz: null, confidence: bestCorrelation };
    }

    // Quadratic interpolation around the best lag
    let finePeriod = bestPeriod;
    if (bestPeriod > minPeriod && bestPeriod < maxPeriod) {
      const alpha = correlations[bestPeriod - 1];
      const beta = correlations[bestPeriod];
      const gamma = correlations[bestPeriod + 1];
      const denom = alpha - 2 * beta + gamma;
      if (Math.abs(denom) > 1e-6) {
        const delta = 0.5 * (alpha - gamma) / denom;
        finePeriod = bestPeriod + Math.max(-1, Math.min(1, delta));
      }
    }

    const pitchHz = sampleRate / finePeriod;
    return {
      pitchHz: (pitchHz >= minPitchHz && pitchHz <= maxPitchHz) ? pitchHz : null,
      confidence: bestCorrelation
    };
  }
}
