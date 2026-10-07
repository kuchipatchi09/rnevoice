import { PureToneConfig, PureToneResult, SignalFrame } from "../types/index.ts";
import { PhaseAnalyzer } from "../audio/PhaseAnalyzer.ts";
import { WeightCalculator } from "./WeightCalculator.ts";

export class PureToneClassifier {
  /**
   * Evaluates a live signal frame against reference parameters and tolerances
   */
  static evaluate(frame: SignalFrame | null, config: PureToneConfig): PureToneResult {
    if (!frame || frame.dominantFrequency <= 5) {
      return {
        measuredFrequency: 0,
        measuredAmplitude: 0,
        measuredPhase: null,
        errorFreq: 0,
        errorAmp: 0,
        errorPhase: null,
        dFreq: 0,
        dAmp: 0,
        dPhase: null,
        score: 0,
        pass: false,
        contribFreq: 0,
        contribAmp: 0,
        contribPhase: 0,
        normalizedWf: config.weightFreq,
        normalizedWa: config.weightAmp,
        normalizedWphi: config.weightPhase,
        phaseAvailable: false
      };
    }

    const measuredFreq = frame.dominantFrequency;
    const measuredAmp = frame.rmsAmplitude;
    const measuredPhase = frame.phaseDeg;

    // Errors
    const errorFreq = Math.abs(measuredFreq - config.refFrequency);
    const errorAmp = Math.abs(measuredAmp - config.refAmplitude);
    
    let errorPhase: number | null = null;
    let dPhase: number | null = null;

    if (measuredPhase !== null) {
      errorPhase = PhaseAnalyzer.calculateCircularDistanceDeg(measuredPhase, config.refPhase);
      dPhase = errorPhase / Math.max(0.001, config.tolPhase);
    }

    // Normalized errors
    const dFreq = errorFreq / Math.max(0.001, config.tolFrequency);
    const dAmp = errorAmp / Math.max(0.001, config.tolAmplitude);

    // Weighted Score computation
    const weightedResult = WeightCalculator.computeWeightedScore(
      dFreq,
      dAmp,
      dPhase,
      config.weightFreq,
      config.weightAmp,
      config.weightPhase,
      config.autoNormalize
    );

    const pass = weightedResult.score < config.threshold && frame.quality !== "NO_SIGNAL";

    return {
      measuredFrequency: measuredFreq,
      measuredAmplitude: measuredAmp,
      measuredPhase,
      errorFreq,
      errorAmp,
      errorPhase,
      dFreq,
      dAmp,
      dPhase,
      score: weightedResult.score,
      pass,
      contribFreq: weightedResult.contribFreq,
      contribAmp: weightedResult.contribAmp,
      contribPhase: weightedResult.contribPhase,
      normalizedWf: weightedResult.normWf,
      normalizedWa: weightedResult.normWa,
      normalizedWphi: weightedResult.normWphi,
      phaseAvailable: measuredPhase !== null
    };
  }
}
