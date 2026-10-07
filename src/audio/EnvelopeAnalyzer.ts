/**
 * Amplitude Envelope Extractor using Sliding RMS Window & Peak Smoothing
 */
export class EnvelopeAnalyzer {
  /**
   * Computes sliding RMS amplitude envelope
   * @param pcmData PCM audio samples
   * @param sampleRate Audio sample rate
   * @param windowMs Window duration in milliseconds (default 30ms)
   * @param hopMs Hop step in milliseconds (default 10ms)
   */
  static computeRmsEnvelope(
    pcmData: Float32Array,
    sampleRate: number,
    windowMs: number = 30,
    hopMs: number = 10
  ): { times: number[]; envelope: Float32Array } {
    const windowSamples = Math.max(1, Math.floor((windowMs / 1000) * sampleRate));
    const hopSamples = Math.max(1, Math.floor((hopMs / 1000) * sampleRate));
    const totalSamples = pcmData.length;
    const numPoints = Math.max(1, Math.floor((totalSamples - windowSamples) / hopSamples) + 1);

    const times: number[] = [];
    const envelope = new Float32Array(numPoints);

    for (let i = 0; i < numPoints; i++) {
      const start = i * hopSamples;
      const timeSec = (start + windowSamples / 2) / sampleRate;
      times.push(timeSec);

      let sumSq = 0;
      for (let j = 0; j < windowSamples; j++) {
        const idx = start + j;
        if (idx < totalSamples) {
          sumSq += pcmData[idx] * pcmData[idx];
        }
      }

      envelope[i] = Math.sqrt(sumSq / windowSamples);
    }

    return { times, envelope };
  }

  /**
   * Resamples an envelope to fixed length N for pattern matching/distance calculations
   */
  static resampleEnvelope(envelope: Float32Array, targetLength: number = 100): Float32Array {
    if (envelope.length === 0) return new Float32Array(targetLength);
    const result = new Float32Array(targetLength);
    const step = (envelope.length - 1) / (targetLength - 1);

    for (let i = 0; i < targetLength; i++) {
      const srcIdx = i * step;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(envelope.length - 1, i0 + 1);
      const frac = srcIdx - i0;
      result[i] = envelope[i0] * (1 - frac) + envelope[i1] * frac;
    }

    return result;
  }
}
