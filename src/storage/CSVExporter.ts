import { ExperimentTrial } from "../types/index.ts";

export class CSVExporter {
  /**
   * Generates and downloads a CSV file of recorded experiment trials
   */
  static exportTrials(trials: ExperimentTrial[], filenamePrefix: string = "lissajous_experiment") {
    if (trials.length === 0) {
      alert("내보낼 실험 데이터가 없습니다.");
      return;
    }

    const headers = [
      "trial_id",
      "experiment_name",
      "condition",
      "timestamp_iso",
      "timestamp_formatted",
      "reference_frequency_hz",
      "measured_frequency_hz",
      "frequency_error_hz",
      "reference_amplitude",
      "measured_amplitude",
      "amplitude_error",
      "reference_phase_deg",
      "measured_phase_deg",
      "phase_error_deg",
      "weight_frequency",
      "weight_amplitude",
      "weight_phase",
      "tolerance_frequency_hz",
      "tolerance_amplitude",
      "tolerance_phase_deg",
      "final_score_d",
      "result",
      "input_mode",
      "signal_quality"
    ];

    const rows = trials.map((t) => [
      t.trialId,
      `"${t.experimentName.replace(/"/g, '""')}"`,
      `"${t.condition.replace(/"/g, '""')}"`,
      new Date(t.timestamp).toISOString(),
      `"${t.formattedTime}"`,
      t.refFrequency.toFixed(3),
      t.measuredFrequency.toFixed(3),
      t.freqError.toFixed(3),
      t.refAmplitude.toFixed(4),
      t.measuredAmplitude.toFixed(4),
      t.ampError.toFixed(4),
      t.refPhase.toFixed(2),
      t.measuredPhase !== null ? t.measuredPhase.toFixed(2) : "N/A",
      t.phaseError !== null ? t.phaseError.toFixed(2) : "N/A",
      t.wf.toFixed(4),
      t.wA.toFixed(4),
      t.wPhase.toFixed(4),
      t.Tf.toFixed(2),
      t.TA.toFixed(4),
      t.TPhase.toFixed(2),
      t.score.toFixed(4),
      t.pass ? "PASS" : "FAIL",
      t.mode,
      t.quality
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
