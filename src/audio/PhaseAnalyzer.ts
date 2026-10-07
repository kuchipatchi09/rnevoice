import { FFTAnalyzer } from "./FFTAnalyzer.ts";

export class PhaseAnalyzer {
  /**
   * Calculates circular distance between two angles in degrees [0, 360]
   * phaseError = min( abs(phi - phi0), 360 - abs(phi - phi0) )
   */
  static calculateCircularDistanceDeg(phi1: number, phi2: number): number {
    const diff = Math.abs((phi1 % 360) - (phi2 % 360));
    return Math.min(diff, 360 - diff);
  }

  /**
   * Calculates phase difference between two audio channels (Left = Ref, Right = Input)
   * Evaluates at the dominant frequency using complex DFT coefficients.
   */
  static analyzePhaseDifference(
    timeDataLeft: Float32Array,
    timeDataRight: Float32Array,
    targetFreqHz: number,
    sampleRate: number
  ): {
    phaseLeftDeg: number;
    phaseRightDeg: number;
    deltaPhaseDeg: number; // Wrapped to [0, 360)
    deltaPhaseSignedDeg: number; // Wrapped to [-180, 180]
    coherence: number;
  } {
    if (targetFreqHz <= 10) {
      return {
        phaseLeftDeg: 0,
        phaseRightDeg: 0,
        deltaPhaseDeg: 0,
        deltaPhaseSignedDeg: 0,
        coherence: 0
      };
    }

    const dftLeft = FFTAnalyzer.computeComplexDftBin(timeDataLeft, targetFreqHz, sampleRate);
    const dftRight = FFTAnalyzer.computeComplexDftBin(timeDataRight, targetFreqHz, sampleRate);

    let deltaDeg = dftRight.phaseDeg - dftLeft.phaseDeg;
    while (deltaDeg < 0) deltaDeg += 360;
    deltaDeg = deltaDeg % 360;

    let deltaSignedDeg = deltaDeg;
    if (deltaSignedDeg > 180) {
      deltaSignedDeg -= 360;
    }

    // Coherence estimate based on normalized product of magnitudes
    const coherence = Math.min(1.0, (dftLeft.magnitude * dftRight.magnitude) * 4);

    return {
      phaseLeftDeg: dftLeft.phaseDeg,
      phaseRightDeg: dftRight.phaseDeg,
      deltaPhaseDeg: deltaDeg,
      deltaPhaseSignedDeg: deltaSignedDeg,
      coherence
    };
  }

  /**
   * Computes phase of input signal relative to a mathematical synthetic reference:
   * ref(t) = sin(2 * pi * f_ref * t + phi_ref)
   */
  static analyzePhaseWithSyntheticReference(
    timeData: Float32Array,
    targetFreqHz: number,
    sampleRate: number
  ): {
    phaseDeg: number;
    coherence: number;
  } {
    const dft = FFTAnalyzer.computeComplexDftBin(timeData, targetFreqHz, sampleRate);
    return {
      phaseDeg: dft.phaseDeg,
      coherence: dft.magnitude
    };
  }
}
