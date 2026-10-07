import { ExperimentTrial, CalibrationResult, AppSettings, PureToneConfig } from "../types/index.ts";

const TRIALS_KEY = "rne_lissajous_trials_v1";
const CALIBRATION_KEY = "rne_lissajous_calibrations_v1";
const SETTINGS_KEY = "rne_lissajous_settings_v1";
const LAST_TRIAL_INDEX_KEY = "rne_lissajous_trial_index_v1";

export const DEFAULT_CONFIG: PureToneConfig = {
  refFrequency: 440,
  refAmplitude: 0.7,
  refPhase: 90,
  tolFrequency: 5.0,
  tolAmplitude: 0.15,
  tolPhase: 10.0,
  weightFreq: 0.45,
  weightAmp: 0.10,
  weightPhase: 0.45,
  threshold: 1.0,
  autoNormalize: true,
  useSimulatedRefForMono: true
};

export const DEFAULT_SETTINGS: AppSettings = {
  selectedDeviceId: "",
  fftSize: 2048,
  smoothingTimeConstant: 0.25,
  movingAverageFrames: 7,
  maxDisplayFrequency: 5000,
  pureToneConfig: DEFAULT_CONFIG
};

export class ExperimentStorage {
  static getTrials(): ExperimentTrial[] {
    try {
      const raw = localStorage.getItem(TRIALS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveTrial(trial: ExperimentTrial): void {
    const trials = this.getTrials();
    trials.push(trial);
    localStorage.setItem(TRIALS_KEY, JSON.stringify(trials));
  }

  static clearTrials(): void {
    localStorage.removeItem(TRIALS_KEY);
  }

  static deleteTrial(trialId: string): void {
    const trials = this.getTrials().filter(t => t.trialId !== trialId);
    localStorage.setItem(TRIALS_KEY, JSON.stringify(trials));
  }

  static getNextTrialNumber(): number {
    const current = parseInt(localStorage.getItem(LAST_TRIAL_INDEX_KEY) || "0", 10);
    const next = current + 1;
    localStorage.setItem(LAST_TRIAL_INDEX_KEY, next.toString());
    return next;
  }

  static getCalibrations(): CalibrationResult[] {
    try {
      const raw = localStorage.getItem(CALIBRATION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveCalibration(calib: CalibrationResult): void {
    const list = this.getCalibrations();
    list.unshift(calib);
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(list.slice(0, 10)));
  }

  static getSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}
