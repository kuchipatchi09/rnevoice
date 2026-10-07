export class WeightCalculator {
  /**
   * Normalizes weights so their sum equals 1.0
   */
  static normalizeWeights(wf: number, wA: number, wPhi: number): { wf: number; wA: number; wPhi: number } {
    const sum = wf + wA + wPhi;
    if (sum <= 0) {
      return { wf: 0.45, wA: 0.10, wPhi: 0.45 };
    }
    return {
      wf: wf / sum,
      wA: wA / sum,
      wPhi: wPhi / sum
    };
  }

  /**
   * Computes individual contributions and final weighted score D
   */
  static computeWeightedScore(
    df: number,
    dA: number,
    dPhi: number | null,
    wf: number,
    wA: number,
    wPhi: number,
    autoNormalize: boolean = true
  ): {
    score: number;
    contribFreq: number;
    contribAmp: number;
    contribPhase: number;
    normWf: number;
    normWa: number;
    normWphi: number;
  } {
    let effectiveWf = wf;
    let effectiveWa = wA;
    let effectiveWphi = wPhi;

    if (dPhi === null) {
      // If phase is not available, redistribute phase weight proportionally to freq and amp
      const subSum = wf + wA;
      if (subSum > 0) {
        effectiveWf = wf / subSum;
        effectiveWa = wA / subSum;
      } else {
        effectiveWf = 0.8;
        effectiveWa = 0.2;
      }
      effectiveWphi = 0;
    } else if (autoNormalize) {
      const normalized = this.normalizeWeights(wf, wA, wPhi);
      effectiveWf = normalized.wf;
      effectiveWa = normalized.wA;
      effectiveWphi = normalized.wPhi;
    }

    const contribFreq = effectiveWf * df;
    const contribAmp = effectiveWa * dA;
    const contribPhase = dPhi !== null ? effectiveWphi * dPhi : 0;
    const score = contribFreq + contribAmp + contribPhase;

    return {
      score,
      contribFreq,
      contribAmp,
      contribPhase,
      normWf: effectiveWf,
      normWa: effectiveWa,
      normWphi: effectiveWphi
    };
  }
}
