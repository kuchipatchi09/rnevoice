import { ExperimentTrial } from "../types/index.ts";
import { ExperimentStorage } from "../storage/ExperimentStorage.ts";
import { CSVExporter } from "../storage/CSVExporter.ts";
import { HistogramRenderer } from "../visualization/HistogramRenderer.ts";

export class RecordsTab {
  private container: HTMLElement;
  private trials: ExperimentTrial[] = [];
  private histogramRenderer: HistogramRenderer | null = null;
  private filterCondition = "";

  constructor(container: HTMLElement) {
    this.container = container;
    this.trials = ExperimentStorage.getTrials();
    this.render();
    this.initHistogram();
    this.bindEvents();
  }

  public refresh() {
    this.trials = ExperimentStorage.getTrials();
    this.render();
    this.initHistogram();
    this.bindEvents();
  }

  private initHistogram() {
    const canvas = this.container.querySelector("#canvas-histogram") as HTMLCanvasElement | null;
    if (canvas) {
      canvas.width = canvas.clientWidth * window.devicePixelRatio || 450;
      canvas.height = canvas.clientHeight * window.devicePixelRatio || 160;
      this.histogramRenderer = new HistogramRenderer(canvas);
      const scores = this.trials.map(t => t.score);
      this.histogramRenderer.render(scores, 1.0);
    }
  }

  private calculateStatistics() {
    const total = this.trials.length;
    if (total === 0) {
      return {
        total: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
        meanFreqErr: 0,
        sdFreqErr: 0,
        meanPhaseErr: 0,
        sdPhaseErr: 0,
        meanD: 0,
        sdD: 0
      };
    }

    const passCount = this.trials.filter(t => t.pass).length;
    const failCount = total - passCount;
    const passRate = (passCount / total) * 100;

    const freqErrors = this.trials.map(t => t.freqError);
    const meanFreqErr = freqErrors.reduce((a, b) => a + b, 0) / total;
    const sdFreqErr = Math.sqrt(freqErrors.reduce((a, b) => a + Math.pow(b - meanFreqErr, 2), 0) / total);

    const validPhaseErrors = this.trials.filter(t => t.phaseError !== null).map(t => t.phaseError as number);
    const meanPhaseErr = validPhaseErrors.length > 0 ? validPhaseErrors.reduce((a, b) => a + b, 0) / validPhaseErrors.length : 0;
    const sdPhaseErr = validPhaseErrors.length > 0 ? Math.sqrt(validPhaseErrors.reduce((a, b) => a + Math.pow(b - meanPhaseErr, 2), 0) / validPhaseErrors.length) : 0;

    const scores = this.trials.map(t => t.score);
    const meanD = scores.reduce((a, b) => a + b, 0) / total;
    const sdD = Math.sqrt(scores.reduce((a, b) => a + Math.pow(b - meanD, 2), 0) / total);

    return {
      total,
      passCount,
      failCount,
      passRate,
      meanFreqErr,
      sdFreqErr,
      meanPhaseErr,
      sdPhaseErr,
      meanD,
      sdD
    };
  }

  private bindEvents() {
    const btnExport = this.container.querySelector("#btn-export-csv");
    const btnClear = this.container.querySelector("#btn-clear-trials");
    const inputFilter = this.container.querySelector("#input-filter-cond") as HTMLInputElement | null;

    btnExport?.addEventListener("click", () => {
      CSVExporter.exportTrials(this.trials, "rne_pure_tone_trials");
    });

    btnClear?.addEventListener("click", () => {
      if (confirm("모든 실험 기록을 삭제하시겠습니까?")) {
        ExperimentStorage.clearTrials();
        this.refresh();
      }
    });

    inputFilter?.addEventListener("input", () => {
      this.filterCondition = inputFilter.value.toLowerCase();
      this.renderTableRows();
    });

    // Delete individual row
    this.container.querySelectorAll<HTMLButtonElement>("button[data-del-trial]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del-trial");
        if (id) {
          ExperimentStorage.deleteTrial(id);
          this.refresh();
        }
      });
    });
  }

  private renderTableRows() {
    const tbody = this.container.querySelector("#tbody-trials");
    if (!tbody) return;

    const filtered = this.trials.filter(t =>
      t.trialId.toLowerCase().includes(this.filterCondition) ||
      t.experimentName.toLowerCase().includes(this.filterCondition) ||
      t.condition.toLowerCase().includes(this.filterCondition)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-8 text-center text-xs font-mono text-lab-grayDark">
            기록된 실험 데이터가 없습니다. Pure Tone 화면에서 "Record Trial"을 실행하세요.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.slice().reverse().map((t) => `
      <tr class="border-b border-lab-light hover:bg-white/60 transition-colors text-xs font-mono">
        <td class="py-2.5 px-3 font-bold text-lab-black">${t.trialId}</td>
        <td class="py-2.5 px-3 text-lab-grayDark">${t.formattedTime}</td>
        <td class="py-2.5 px-3 text-lab-dark">${t.experimentName}</td>
        <td class="py-2.5 px-3 text-lab-grayDark text-[11px]">${t.condition}</td>
        <td class="py-2.5 px-3 font-bold ${t.freqError <= t.Tf ? "text-lab-black" : "text-lab-red"}">
          ${t.measuredFrequency.toFixed(1)}Hz <span class="text-[10px] text-lab-grayDark">(Δ${t.freqError.toFixed(1)})</span>
        </td>
        <td class="py-2.5 px-3">
          ${t.measuredAmplitude.toFixed(2)} <span class="text-[10px] text-lab-grayDark">(Δ${t.ampError.toFixed(2)})</span>
        </td>
        <td class="py-2.5 px-3">
          ${t.measuredPhase !== null ? `${t.measuredPhase.toFixed(1)}° (Δ${t.phaseError?.toFixed(1) || "0"}°)` : "N/A"}
        </td>
        <td class="py-2.5 px-3 font-bold ${t.pass ? "text-lab-black" : "text-lab-red"}">
          ${t.score.toFixed(3)}
        </td>
        <td class="py-2.5 px-3">
          <span class="lab-badge ${t.pass ? "lab-badge-good" : "lab-badge-danger"}">
            ${t.pass ? "PASS" : "FAIL"}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right">
          <button data-del-trial="${t.trialId}" class="text-lab-grayDark hover:text-lab-red p-1">
            ✕
          </button>
        </td>
      </tr>
    `).join("");
  }

  private render() {
    const stats = this.calculateStatistics();

    this.container.innerHTML = `
      <div class="flex-1 p-6 max-w-[1700px] mx-auto w-full space-y-6">
        
        <!-- Header & Action Bar -->
        <div class="lab-card flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="w-2.5 h-2.5 bg-lab-black rounded-full"></span>
            <div>
              <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                Experiment Trial Records & Statistical Aggregation
              </h2>
              <p class="text-[11px] font-mono text-lab-grayDark">
                Quantitative Accuracy Analysis, Error Distributions, RFC-4180 CSV Export
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <input id="input-filter-cond" type="text" placeholder="Filter by Name / Condition..." class="lab-input w-56 text-xs">
            <button id="btn-export-csv" class="lab-btn-accent px-4 py-2 font-bold">
              📥 Export CSV
            </button>
            <button id="btn-clear-trials" class="lab-btn px-3 py-2 text-lab-red hover:bg-red-50">
              🗑 Clear All
            </button>
          </div>
        </div>

        <!-- Statistical Summary Cards & Histogram -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <!-- Stats Cards (7 cols) -->
          <div class="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            
            <div class="lab-card-compact flex flex-col justify-between">
              <span class="text-[10px] font-mono text-lab-grayDark uppercase">Total Trials</span>
              <div class="text-2xl font-mono font-bold text-lab-black">${stats.total}</div>
              <span class="text-[10px] font-mono text-lab-grayDark">
                PASS: <strong class="text-emerald-700">${stats.passCount}</strong> / FAIL: <strong class="text-lab-red">${stats.failCount}</strong>
              </span>
            </div>

            <div class="lab-card-compact flex flex-col justify-between">
              <span class="text-[10px] font-mono text-lab-grayDark uppercase">PASS Acceptance Rate</span>
              <div class="text-2xl font-mono font-bold text-emerald-800">${stats.passRate.toFixed(1)}%</div>
              <span class="text-[10px] font-mono text-lab-grayDark">Threshold D &lt; 1.00</span>
            </div>

            <div class="lab-card-compact flex flex-col justify-between">
              <span class="text-[10px] font-mono text-lab-grayDark uppercase">Score D Mean ± SD</span>
              <div class="text-xl font-mono font-bold text-lab-black">${stats.meanD.toFixed(3)} ± ${stats.sdD.toFixed(3)}</div>
              <span class="text-[10px] font-mono text-lab-grayDark">Weighted Composite Error</span>
            </div>

            <div class="lab-card-compact flex flex-col justify-between">
              <span class="text-[10px] font-mono text-lab-grayDark uppercase">Freq Error Mean ± SD</span>
              <div class="text-lg font-mono font-bold text-lab-black">${stats.meanFreqErr.toFixed(2)} ± ${stats.sdFreqErr.toFixed(2)} Hz</div>
              <span class="text-[10px] font-mono text-lab-grayDark">Target: 440 Hz</span>
            </div>

            <div class="lab-card-compact flex flex-col justify-between">
              <span class="text-[10px] font-mono text-lab-grayDark uppercase">Phase Error Mean ± SD</span>
              <div class="text-lg font-mono font-bold text-lab-black">${stats.meanPhaseErr.toFixed(1)} ± ${stats.sdPhaseErr.toFixed(1)}°</div>
              <span class="text-[10px] font-mono text-lab-grayDark">Circular Distance Metric</span>
            </div>

            <div class="lab-card-compact flex flex-col justify-between">
              <span class="text-[10px] font-mono text-lab-grayDark uppercase">Experiment Status</span>
              <div class="text-sm font-mono font-bold text-lab-black">${stats.total >= 10 ? "Adequate Sample Size" : "Collecting Samples..."}</div>
              <span class="text-[10px] font-mono text-lab-grayDark">N=${stats.total} Trials Recorded</span>
            </div>

          </div>

          <!-- Histogram Canvas (5 cols) -->
          <div class="lg:col-span-5 lab-card flex flex-col">
            <div class="flex items-center justify-between pb-1 mb-1 border-b border-lab-light">
              <span class="text-xs font-mono font-bold text-lab-black">Score D Frequency Histogram</span>
              <span class="text-[10px] font-mono text-lab-grayDark">Distribution Profile</span>
            </div>
            <div class="relative w-full h-44 bg-white border border-lab-gray rounded-sm overflow-hidden">
              <canvas id="canvas-histogram" class="w-full h-full block"></canvas>
            </div>
          </div>
        </div>

        <!-- Trial History Table -->
        <div class="lab-card overflow-hidden p-0">
          <div class="p-3 bg-lab-light/50 border-b border-lab-gray flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-lab-black">RECORDED TRIALS LOG</span>
            <span class="text-[10px] font-mono text-lab-grayDark">Ordered latest first</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-lab-gray bg-lab-bg text-[10px] font-mono text-lab-grayDark uppercase">
                  <th class="py-2.5 px-3">Trial ID</th>
                  <th class="py-2.5 px-3">Time</th>
                  <th class="py-2.5 px-3">Experiment</th>
                  <th class="py-2.5 px-3">Condition</th>
                  <th class="py-2.5 px-3">Frequency</th>
                  <th class="py-2.5 px-3">Amplitude</th>
                  <th class="py-2.5 px-3">Phase Diff</th>
                  <th class="py-2.5 px-3">Score D</th>
                  <th class="py-2.5 px-3">Result</th>
                  <th class="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody id="tbody-trials"></tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.renderTableRows();
  }
}
