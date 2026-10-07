import { AudioInput } from "../audio/AudioInput.ts";
import { WaveformRenderer } from "../visualization/WaveformRenderer.ts";
import { SpectrumRenderer } from "../visualization/SpectrumRenderer.ts";
import { LissajousRenderer } from "../visualization/LissajousRenderer.ts";
import { PureToneClassifier } from "../algorithms/PureToneClassifier.ts";
import { ExperimentStorage } from "../storage/ExperimentStorage.ts";
import { PureToneConfig, SignalFrame, PureToneResult, ExperimentTrial } from "../types/index.ts";

export class PureToneTab {
  private container: HTMLElement;
  private audioInput: AudioInput;
  private config: PureToneConfig;
  
  private waveformRenderer: WaveformRenderer | null = null;
  private spectrumRenderer: SpectrumRenderer | null = null;
  private lissajousRenderer: LissajousRenderer | null = null;

  private experimentName = "Phase Test 01";
  private condition = "Ref 440Hz / Phase 90°";
  private trialCount = 1;
  private isCalibrating = false;
  private calibrationSamples: { freq: number; amp: number; phase: number | null }[] = [];

  private synthFreq = 440;
  private synthAmp = 0.70;
  private synthPhase = 90;
  private synthNoise = 0.005;

  constructor(container: HTMLElement, audioInput: AudioInput, config: PureToneConfig) {
    this.container = container;
    this.audioInput = audioInput;
    this.config = config;
    this.trialCount = ExperimentStorage.getNextTrialNumber();
    this.render();
    this.initCanvases();
    this.bindEvents();
  }

  public updateConfig(newConfig: PureToneConfig) {
    this.config = newConfig;
    this.updateControlsFromConfig();
  }
  public updateFrame(frame: SignalFrame | null) {
    if (!this.container.isConnected) return;

    const result = PureToneClassifier.evaluate(frame, this.config);

    if (frame) {
      if (this.waveformRenderer) {
        this.waveformRenderer.render(frame.timeDataLeft, frame.timeDataRight, frame.isStereo);
      }

      if (this.spectrumRenderer) {
        const targetFreqData = frame.isStereo && frame.freqDataRight ? frame.freqDataRight : frame.freqDataLeft;
        this.spectrumRenderer.render(
          targetFreqData,
          frame.sampleRate,
          result.measuredFrequency,
          frame.peakAmplitude > 0 ? 20 * Math.log10(frame.peakAmplitude + 1e-6) : -100,
          5000
        );
      }

      if (this.lissajousRenderer) {
        if (frame.isStereo && frame.timeDataRight) {
          this.lissajousRenderer.render(
            frame.timeDataLeft,
            frame.timeDataRight,
            "STEREO MEASUREMENT",
            result.measuredPhase,
            false
          );
        } else if (this.config.useSimulatedRefForMono) {
          const simX = this.generateSimulatedRefBuffer(frame.bufferSize, this.config.refFrequency, frame.sampleRate);
          this.lissajousRenderer.render(
            simX,
            frame.timeDataLeft,
            "SIMULATED REFERENCE (X=Sim, Y=Mic)",
            result.measuredPhase,
            true
          );
        } else {
          this.lissajousRenderer.renderMathSimulation(
            1.0,
            1.0,
            this.config.refFrequency,
            this.config.refFrequency,
            this.config.refPhase
          );
        }
      }
    }

    this.updateMetricsUI(result, frame);

    if (this.isCalibrating && frame && frame.dominantFrequency > 20) {
      this.calibrationSamples.push({
        freq: frame.dominantFrequency,
        amp: frame.rmsAmplitude,
        phase: frame.phaseDeg
      });
    }
  }

  private generateSimulatedRefBuffer(size: number, freq: number, sampleRate: number): Float32Array {
    const buf = new Float32Array(size);
    const omega = 2 * Math.PI * freq;
    for (let i = 0; i < size; i++) {
      buf[i] = Math.sin((omega * i) / sampleRate);
    }
    return buf;
  }
  private updateMetricsUI(result: PureToneResult, frame: SignalFrame | null) {
    const elMeasFreq = this.container.querySelector("#val-meas-freq");
    const elErrFreq = this.container.querySelector("#val-err-freq");
    const elMeasAmp = this.container.querySelector("#val-meas-amp");
    const elErrAmp = this.container.querySelector("#val-err-amp");
    const elMeasPhase = this.container.querySelector("#val-meas-phase");
    const elErrPhase = this.container.querySelector("#val-err-phase");

    if (elMeasFreq) elMeasFreq.textContent = result.measuredFrequency > 10 ? `${result.measuredFrequency.toFixed(2)} Hz` : "--- Hz";
    if (elErrFreq) elErrFreq.textContent = result.measuredFrequency > 10 ? `Δ ${result.errorFreq.toFixed(2)} Hz` : "Δ 0.00 Hz";

    if (elMeasAmp) elMeasAmp.textContent = result.measuredAmplitude.toFixed(3);
    if (elErrAmp) elErrAmp.textContent = `Δ ${result.errorAmp.toFixed(3)}`;

    if (elMeasPhase) {
      elMeasPhase.textContent = result.measuredPhase !== null ? `${result.measuredPhase.toFixed(1)}°` : "N/A";
    }

    if (elErrPhase) {
      elErrPhase.textContent = result.errorPhase !== null ? `Δ ${result.errorPhase.toFixed(1)}°` : "N/A";
    }

    const elDfVal = this.container.querySelector("#val-df");
    const elDfBar = this.container.querySelector("#bar-df") as HTMLElement | null;
    const elDfContrib = this.container.querySelector("#val-contrib-df");

    const elDaVal = this.container.querySelector("#val-da");
    const elDaBar = this.container.querySelector("#bar-da") as HTMLElement | null;
    const elDaContrib = this.container.querySelector("#val-contrib-da");

    const elDphiVal = this.container.querySelector("#val-dphi");
    const elDphiBar = this.container.querySelector("#bar-dphi") as HTMLElement | null;
    const elDphiContrib = this.container.querySelector("#val-contrib-dphi");

    if (elDfVal) elDfVal.textContent = result.dFreq.toFixed(3);
    if (elDfBar) elDfBar.style.width = `${Math.min(100, result.dFreq * 100)}%`;
    if (elDfContrib) elDfContrib.textContent = `+${result.contribFreq.toFixed(3)}`;

    if (elDaVal) elDaVal.textContent = result.dAmp.toFixed(3);
    if (elDaBar) elDaBar.style.width = `${Math.min(100, result.dAmp * 100)}%`;
    if (elDaContrib) elDaContrib.textContent = `+${result.contribAmp.toFixed(3)}`;

    if (elDphiVal) elDphiVal.textContent = result.dPhase !== null ? result.dPhase.toFixed(3) : "N/A";
    if (elDphiBar) elDphiBar.style.width = result.dPhase !== null ? `${Math.min(100, result.dPhase * 100)}%` : "0%";
    if (elDphiContrib) elDphiContrib.textContent = result.dPhase !== null ? `+${result.contribPhase.toFixed(3)}` : "+0.000";

    const elScore = this.container.querySelector("#val-final-score");
    if (elScore) {
      elScore.textContent = result.score.toFixed(3);
      elScore.className = result.pass
        ? "text-4xl font-mono font-bold text-lab-black"
        : "text-4xl font-mono font-bold text-lab-red";
    }

    const elDecisionBox = this.container.querySelector("#box-decision");
    const elDecisionBadge = this.container.querySelector("#badge-decision");
    const elDecisionText = this.container.querySelector("#text-decision-desc");

    if (elDecisionBox && elDecisionBadge && elDecisionText) {
      if (!frame || frame.quality === "NO_SIGNAL" || result.measuredFrequency < 20) {
        elDecisionBox.className = "p-4 rounded-sm border border-lab-gray bg-lab-light/40 text-center";
        elDecisionBadge.className = "text-xl font-mono font-bold text-lab-grayDark";
        elDecisionBadge.textContent = "STANDBY";
        elDecisionText.textContent = "Awaiting continuous acoustic input...";
      } else if (result.pass) {
        elDecisionBox.className = "p-4 rounded-sm border-2 border-emerald-600 bg-emerald-50/70 text-center transition-colors";
        elDecisionBadge.className = "text-2xl font-mono font-bold text-emerald-800 tracking-wider";
        elDecisionBadge.textContent = "PASS";
        elDecisionText.textContent = `Signal matched within tolerance (D=${result.score.toFixed(3)} < ${this.config.threshold.toFixed(2)})`;
      } else {
        elDecisionBox.className = "p-4 rounded-sm border-2 border-lab-red bg-red-50/70 text-center transition-colors";
        elDecisionBadge.className = "text-2xl font-mono font-bold text-lab-red tracking-wider";
        elDecisionBadge.textContent = "FAIL";
        elDecisionText.textContent = `Signal exceeds configured tolerance (D=${result.score.toFixed(3)} ≥ ${this.config.threshold.toFixed(2)})`;
      }
    }
  }
  private initCanvases() {
    const waveCanvas = this.container.querySelector("#canvas-waveform") as HTMLCanvasElement | null;
    const specCanvas = this.container.querySelector("#canvas-spectrum") as HTMLCanvasElement | null;
    const lissCanvas = this.container.querySelector("#canvas-lissajous") as HTMLCanvasElement | null;

    if (waveCanvas) {
      waveCanvas.width = waveCanvas.clientWidth * window.devicePixelRatio || 600;
      waveCanvas.height = waveCanvas.clientHeight * window.devicePixelRatio || 160;
      this.waveformRenderer = new WaveformRenderer(waveCanvas);
    }

    if (specCanvas) {
      specCanvas.width = specCanvas.clientWidth * window.devicePixelRatio || 600;
      specCanvas.height = specCanvas.clientHeight * window.devicePixelRatio || 160;
      this.spectrumRenderer = new SpectrumRenderer(specCanvas);
    }

    if (lissCanvas) {
      lissCanvas.width = lissCanvas.clientWidth * window.devicePixelRatio || 400;
      lissCanvas.height = lissCanvas.clientHeight * window.devicePixelRatio || 400;
      this.lissajousRenderer = new LissajousRenderer(lissCanvas);
    }
  }

  private bindEvents() {
    const btnMic = this.container.querySelector("#btn-mic-toggle");
    const btnSynth = this.container.querySelector("#btn-synth-toggle");
    const btnStop = this.container.querySelector("#btn-stop-audio");
    const btnCalib = this.container.querySelector("#btn-start-calibration");
    const btnRecord = this.container.querySelector("#btn-record-trial");

    if (btnMic) {
      btnMic.addEventListener("click", async () => {
        try {
          await this.audioInput.startMicrophone(undefined, true);
        } catch (e) {
          alert(`마이크 연결 실패: ${(e as Error).message}\n브라우저 마이크 권한을 허용해 주세요.`);
        }
      });
    }

    if (btnSynth) {
      btnSynth.addEventListener("click", () => {
        this.audioInput.startSyntheticTestSignal(
          this.synthFreq,
          this.synthAmp,
          this.synthPhase,
          this.synthNoise
        );
      });
    }

    if (btnStop) {
      btnStop.addEventListener("click", () => {
        this.audioInput.stop();
      });
    }

    if (btnCalib) {
      btnCalib.addEventListener("click", () => {
        this.startCalibration();
      });
    }

    if (btnRecord) {
      btnRecord.addEventListener("click", () => {
        this.recordCurrentTrial();
      });
    }

    const sliderWf = this.container.querySelector("#slider-wf") as HTMLInputElement | null;
    const sliderWa = this.container.querySelector("#slider-wa") as HTMLInputElement | null;
    const sliderWphi = this.container.querySelector("#slider-wphi") as HTMLInputElement | null;
    const chkAutoNorm = this.container.querySelector("#chk-autonorm") as HTMLInputElement | null;

    const updateWeights = () => {
      if (sliderWf && sliderWa && sliderWphi) {
        this.config.weightFreq = parseFloat(sliderWf.value);
        this.config.weightAmp = parseFloat(sliderWa.value);
        this.config.weightPhase = parseFloat(sliderWphi.value);
        if (chkAutoNorm) this.config.autoNormalize = chkAutoNorm.checked;

        const lblWf = this.container.querySelector("#lbl-wf");
        const lblWa = this.container.querySelector("#lbl-wa");
        const lblWphi = this.container.querySelector("#lbl-wphi");
        if (lblWf) lblWf.textContent = this.config.weightFreq.toFixed(2);
        if (lblWa) lblWa.textContent = this.config.weightAmp.toFixed(2);
        if (lblWphi) lblWphi.textContent = this.config.weightPhase.toFixed(2);

        ExperimentStorage.saveSettings({
          ...ExperimentStorage.getSettings(),
          pureToneConfig: this.config
        });
      }
    };

    sliderWf?.addEventListener("input", updateWeights);
    sliderWa?.addEventListener("input", updateWeights);
    sliderWphi?.addEventListener("input", updateWeights);
    chkAutoNorm?.addEventListener("change", updateWeights);

    this.bindNumberInput("#input-ref-freq", (val) => { this.config.refFrequency = val; });
    this.bindNumberInput("#input-ref-amp", (val) => { this.config.refAmplitude = val; });
    this.bindNumberInput("#input-ref-phase", (val) => { this.config.refPhase = val; });
    this.bindNumberInput("#input-tol-freq", (val) => { this.config.tolFrequency = val; });
    this.bindNumberInput("#input-tol-amp", (val) => { this.config.tolAmplitude = val; });
    this.bindNumberInput("#input-tol-phase", (val) => { this.config.tolPhase = val; });
    this.bindNumberInput("#input-threshold", (val) => { this.config.threshold = val; });

    const sFreq = this.container.querySelector("#synth-freq") as HTMLInputElement | null;
    const sAmp = this.container.querySelector("#synth-amp") as HTMLInputElement | null;
    const sPhase = this.container.querySelector("#synth-phase") as HTMLInputElement | null;
    const sNoise = this.container.querySelector("#synth-noise") as HTMLInputElement | null;

    const updateSynth = () => {
      if (sFreq && sAmp && sPhase && sNoise) {
        this.synthFreq = parseFloat(sFreq.value);
        this.synthAmp = parseFloat(sAmp.value);
        this.synthPhase = parseFloat(sPhase.value);
        this.synthNoise = parseFloat(sNoise.value);

        const lblSf = this.container.querySelector("#lbl-synth-freq");
        const lblSa = this.container.querySelector("#lbl-synth-amp");
        const lblSp = this.container.querySelector("#lbl-synth-phase");
        const lblSn = this.container.querySelector("#lbl-synth-noise");
        if (lblSf) lblSf.textContent = `${this.synthFreq} Hz`;
        if (lblSa) lblSa.textContent = this.synthAmp.toFixed(2);
        if (lblSp) lblSp.textContent = `${this.synthPhase}°`;
        if (lblSn) lblSn.textContent = this.synthNoise.toFixed(3);

        this.audioInput.updateSyntheticParams(this.synthFreq, this.synthAmp, this.synthPhase, this.synthNoise);
      }
    };

    sFreq?.addEventListener("input", updateSynth);
    sAmp?.addEventListener("input", updateSynth);
    sPhase?.addEventListener("input", updateSynth);
    sNoise?.addEventListener("input", updateSynth);
  }

  private bindNumberInput(selector: string, setter: (val: number) => void) {
    const el = this.container.querySelector(selector) as HTMLInputElement | null;
    if (el) {
      el.addEventListener("change", () => {
        const val = parseFloat(el.value);
        if (!isNaN(val)) {
          setter(val);
          ExperimentStorage.saveSettings({
            ...ExperimentStorage.getSettings(),
            pureToneConfig: this.config
          });
        }
      });
    }
  }
  private updateControlsFromConfig() {
    const setVal = (sel: string, val: number | string) => {
      const el = this.container.querySelector(sel) as HTMLInputElement | null;
      if (el) el.value = val.toString();
    };

    setVal("#input-ref-freq", this.config.refFrequency);
    setVal("#input-ref-amp", this.config.refAmplitude);
    setVal("#input-ref-phase", this.config.refPhase);
    setVal("#input-tol-freq", this.config.tolFrequency);
    setVal("#input-tol-amp", this.config.tolAmplitude);
    setVal("#input-tol-phase", this.config.tolPhase);
    setVal("#input-threshold", this.config.threshold);
    setVal("#slider-wf", this.config.weightFreq);
    setVal("#slider-wa", this.config.weightAmp);
    setVal("#slider-wphi", this.config.weightPhase);

    const lblWf = this.container.querySelector("#lbl-wf");
    const lblWa = this.container.querySelector("#lbl-wa");
    const lblWphi = this.container.querySelector("#lbl-wphi");
    if (lblWf) lblWf.textContent = this.config.weightFreq.toFixed(2);
    if (lblWa) lblWa.textContent = this.config.weightAmp.toFixed(2);
    if (lblWphi) lblWphi.textContent = this.config.weightPhase.toFixed(2);
  }

  private startCalibration() {
    if (!this.audioInput.isActive()) {
      alert("Calibration을 시작하려면 먼저 마이크 또는 테스트 신호를 활성화해 주세요.");
      return;
    }

    this.isCalibrating = true;
    this.calibrationSamples = [];
    const btnCalib = this.container.querySelector("#btn-start-calibration") as HTMLButtonElement | null;
    if (btnCalib) {
      btnCalib.disabled = true;
      btnCalib.textContent = "Calibrating (3.0s)...";
    }

    let remaining = 3.0;
    const interval = setInterval(() => {
      remaining -= 0.5;
      if (btnCalib && remaining > 0) {
        btnCalib.textContent = `Calibrating (${remaining.toFixed(1)}s)...`;
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      this.isCalibrating = false;
      if (btnCalib) {
        btnCalib.disabled = false;
        btnCalib.textContent = "3s Calibration";
      }
      this.finishCalibration();
    }, 3000);
  }

  private finishCalibration() {
    if (this.calibrationSamples.length < 5) {
      alert("Calibration 샘플이 부족합니다. 입력 신호 레벨을 확인해 주세요.");
      return;
    }

    const n = this.calibrationSamples.length;
    const avgFreq = this.calibrationSamples.reduce((a, b) => a + b.freq, 0) / n;
    const sdFreq = Math.sqrt(this.calibrationSamples.reduce((a, b) => a + Math.pow(b.freq - avgFreq, 2), 0) / n);

    const avgAmp = this.calibrationSamples.reduce((a, b) => a + b.amp, 0) / n;
    const sdAmp = Math.sqrt(this.calibrationSamples.reduce((a, b) => a + Math.pow(b.amp - avgAmp, 2), 0) / n);

    const validPhases = this.calibrationSamples.filter(s => s.phase !== null).map(s => s.phase as number);
    let avgPhase: number | null = null;
    let sdPhase: number | null = null;

    if (validPhases.length > 0) {
      const meanP = validPhases.reduce((a, b) => a + b, 0) / validPhases.length;
      avgPhase = meanP;
      sdPhase = Math.sqrt(validPhases.reduce((a, b) => a + Math.pow(b - meanP, 2), 0) / validPhases.length);
    }

    const calibBox = this.container.querySelector("#calib-result-card");
    if (calibBox) {
      calibBox.classList.remove("hidden");
      calibBox.innerHTML = `
        <div class="p-3 border border-lab-black bg-white rounded-sm space-y-2 mt-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-lab-black">CALIBRATION PROFILE (3.0s)</span>
            <button id="btn-close-calib" class="text-xs text-lab-grayDark hover:text-lab-black">✕</button>
          </div>
          <div class="grid grid-cols-3 gap-2 text-[11px] font-mono">
            <div>Freq: <span class="font-bold text-lab-black">${avgFreq.toFixed(2)} ± ${sdFreq.toFixed(2)} Hz</span></div>
            <div>Amp: <span class="font-bold text-lab-black">${avgAmp.toFixed(3)} ± ${sdAmp.toFixed(3)}</span></div>
            <div>Phase: <span class="font-bold text-lab-black">${avgPhase !== null ? `${avgPhase.toFixed(1)} ± ${sdPhase?.toFixed(1) || "0"}°` : "N/A"}</span></div>
          </div>
          <button id="btn-apply-calib" class="w-full lab-btn-primary py-1 text-xs">
            Use as Reference Target
          </button>
        </div>
      `;

      calibBox.querySelector("#btn-close-calib")?.addEventListener("click", () => {
        calibBox.classList.add("hidden");
      });

      calibBox.querySelector("#btn-apply-calib")?.addEventListener("click", () => {
        this.config.refFrequency = parseFloat(avgFreq.toFixed(2));
        this.config.refAmplitude = parseFloat(avgAmp.toFixed(3));
        if (avgPhase !== null) {
          this.config.refPhase = parseFloat(avgPhase.toFixed(1));
        }
        this.updateControlsFromConfig();
        ExperimentStorage.saveSettings({
          ...ExperimentStorage.getSettings(),
          pureToneConfig: this.config
        });
        calibBox.classList.add("hidden");
        alert("Calibration 값이 Reference 기준값으로 설정되었습니다.");
      });
    }
  }

  private recordCurrentTrial() {
    const frame = this.audioInput.getCurrentFrame(this.config.refFrequency, this.config.useSimulatedRefForMono);
    const result = PureToneClassifier.evaluate(frame, this.config);

    const expNameInput = this.container.querySelector("#input-exp-name") as HTMLInputElement | null;
    const condInput = this.container.querySelector("#input-exp-cond") as HTMLInputElement | null;
    if (expNameInput) this.experimentName = expNameInput.value || "Phase Test";
    if (condInput) this.condition = condInput.value || "Default Condition";

    const trialId = `Trial ${String(this.trialCount).padStart(3, "0")}`;

    const trial: ExperimentTrial = {
      trialId,
      experimentName: this.experimentName,
      condition: this.condition,
      timestamp: Date.now(),
      formattedTime: new Date().toLocaleTimeString(),
      refFrequency: this.config.refFrequency,
      measuredFrequency: result.measuredFrequency,
      freqError: result.errorFreq,
      refAmplitude: this.config.refAmplitude,
      measuredAmplitude: result.measuredAmplitude,
      ampError: result.errorAmp,
      refPhase: this.config.refPhase,
      measuredPhase: result.measuredPhase,
      phaseError: result.errorPhase,
      wf: result.normalizedWf,
      wA: result.normalizedWa,
      wPhase: result.normalizedWphi,
      Tf: this.config.tolFrequency,
      TA: this.config.tolAmplitude,
      TPhase: this.config.tolPhase,
      score: result.score,
      pass: result.pass,
      mode: this.audioInput.getMode(),
      quality: frame ? frame.quality : "NO_SIGNAL"
    };

    ExperimentStorage.saveTrial(trial);
    this.trialCount = ExperimentStorage.getNextTrialNumber();
    
    const trialCounter = this.container.querySelector("#lbl-next-trial");
    if (trialCounter) trialCounter.textContent = `Trial ${String(this.trialCount).padStart(3, "0")}`;

    const btnRecord = this.container.querySelector("#btn-record-trial") as HTMLButtonElement | null;
    if (btnRecord) {
      const orig = btnRecord.innerHTML;
      btnRecord.innerHTML = "✓ Recorded!";
      setTimeout(() => { btnRecord.innerHTML = orig; }, 800);
    }
  }

  private render() {
    this.container.innerHTML = `
      <div class="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1700px] mx-auto w-full">
        <!-- Left: Real-time Graphs (68%) -->
        <div class="lg:col-span-8 flex flex-col gap-5">
          
          <!-- Graph A: Time-Domain Waveform -->
          <div class="lab-card flex flex-col">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-lab-light">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-lab-black rounded-full"></span>
                <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                  A. Time-Domain Waveform (Oscilloscope)
                </h2>
              </div>
              <span class="text-[11px] font-mono text-lab-grayDark">Scale: [-1.0, +1.0] Normalized PCM</span>
            </div>
            <div class="relative w-full h-44 bg-white border border-lab-gray rounded-sm overflow-hidden">
              <canvas id="canvas-waveform" class="w-full h-full block"></canvas>
            </div>
          </div>

          <!-- Graph B & C: Frequency Spectrum & Lissajous Figure -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
            <!-- FFT Spectrum (7 cols) -->
            <div class="md:col-span-7 lab-card flex flex-col">
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-lab-light">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 bg-lab-black rounded-full"></span>
                  <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                    B. Frequency Spectrum (FFT)
                  </h2>
                </div>
                <span class="text-[11px] font-mono text-lab-grayDark">0 ~ 5000 Hz</span>
              </div>
              <div class="relative w-full h-56 bg-white border border-lab-gray rounded-sm overflow-hidden">
                <canvas id="canvas-spectrum" class="w-full h-full block"></canvas>
              </div>
            </div>

            <!-- Lissajous Figure (5 cols) -->
            <div class="md:col-span-5 lab-card flex flex-col">
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-lab-light">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 bg-lab-red rounded-full"></span>
                  <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                    C. Lissajous Figure (XY)
                  </h2>
                </div>
              </div>
              <div class="relative w-full h-56 bg-white border border-lab-gray rounded-sm overflow-hidden">
                <canvas id="canvas-lissajous" class="w-full h-full block"></canvas>
              </div>
            </div>
          </div>

          <!-- Test Signal Generator Bar -->
          <div class="lab-card-compact border-dashed bg-white/60 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-lab-dark flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                SYNTHETIC TEST SIGNAL GENERATOR (Hardware-Free Verification)
              </span>
              <span class="text-[10px] font-mono text-lab-grayDark">Direct PCM Synthesis</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <div class="flex justify-between text-[11px] mb-1">
                  <span class="text-lab-grayDark">Freq:</span>
                  <span id="lbl-synth-freq" class="font-bold">${this.synthFreq} Hz</span>
                </div>
                <input id="synth-freq" type="range" min="100" max="2000" step="1" value="${this.synthFreq}" class="w-full">
              </div>
              <div>
                <div class="flex justify-between text-[11px] mb-1">
                  <span class="text-lab-grayDark">Amp:</span>
                  <span id="lbl-synth-amp" class="font-bold">${this.synthAmp.toFixed(2)}</span>
                </div>
                <input id="synth-amp" type="range" min="0.0" max="1.0" step="0.01" value="${this.synthAmp}" class="w-full">
              </div>
              <div>
                <div class="flex justify-between text-[11px] mb-1">
                  <span class="text-lab-grayDark">Phase:</span>
                  <span id="lbl-synth-phase" class="font-bold">${this.synthPhase}°</span>
                </div>
                <input id="synth-phase" type="range" min="0" max="360" step="1" value="${this.synthPhase}" class="w-full">
              </div>
              <div>
                <div class="flex justify-between text-[11px] mb-1">
                  <span class="text-lab-grayDark">Noise:</span>
                  <span id="lbl-synth-noise" class="font-bold">${this.synthNoise.toFixed(3)}</span>
                </div>
                <input id="synth-noise" type="range" min="0.0" max="0.05" step="0.001" value="${this.synthNoise}" class="w-full">
              </div>
            </div>
          </div>

        </div>

        <!-- Right: Measurements & Decision Panel (32%) -->
        <div class="lg:col-span-4 flex flex-col gap-4">
          
          <!-- Master Action Bar -->
          <div class="lab-card space-y-3">
            <div class="flex items-center justify-between pb-1 border-b border-lab-light">
              <span class="text-xs font-mono font-bold text-lab-black">AUDIO CONTROL</span>
              <span id="lbl-next-trial" class="text-xs font-mono text-lab-red font-bold">Trial ${String(this.trialCount).padStart(3, "0")}</span>
            </div>
            
            <div class="grid grid-cols-3 gap-2">
              <button id="btn-mic-toggle" class="lab-btn-primary">
                🎙️ Mic Input
              </button>
              <button id="btn-synth-toggle" class="lab-btn">
                ⚡ Test Signal
              </button>
              <button id="btn-stop-audio" class="lab-btn hover:bg-red-50 hover:text-lab-red">
                ⏹ Stop
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button id="btn-record-trial" class="lab-btn-accent text-xs py-2 font-bold">
                💾 Record Trial
              </button>
              <button id="btn-start-calibration" class="lab-btn text-xs py-2">
                ⚙️ 3s Calibration
              </button>
            </div>

            <div id="calib-result-card" class="hidden"></div>
          </div>

          <!-- Experiment Info Card -->
          <div class="lab-card space-y-2 text-xs font-mono">
            <div class="text-[11px] font-bold text-lab-grayDark uppercase tracking-wider">Active Experiment Metadata</div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-lab-grayDark">Experiment Label</label>
                <input id="input-exp-name" type="text" value="${this.experimentName}" class="w-full lab-input">
              </div>
              <div>
                <label class="text-[10px] text-lab-grayDark">Condition</label>
                <input id="input-exp-cond" type="text" value="${this.condition}" class="w-full lab-input">
              </div>
            </div>
          </div>

          <!-- Decision PASS/FAIL Box -->
          <div id="box-decision" class="p-4 rounded-sm border border-lab-gray bg-lab-light/40 text-center">
            <div id="badge-decision" class="text-xl font-mono font-bold text-lab-grayDark">STANDBY</div>
            <div id="text-decision-desc" class="text-[11px] font-mono text-lab-dark mt-1">Awaiting continuous acoustic input...</div>
          </div>

          <!-- Real-Time Measured Cards -->
          <div class="lab-card space-y-3">
            <div class="flex items-center justify-between border-b border-lab-light pb-1">
              <span class="text-xs font-mono font-bold text-lab-black">MEASUREMENTS VS REFERENCE</span>
              <span class="text-[10px] font-mono text-lab-grayDark">Smoothed (N=7)</span>
            </div>

            <!-- Frequency Row -->
            <div class="p-2.5 bg-lab-bg rounded-sm border border-lab-light flex items-center justify-between">
              <div>
                <div class="text-[10px] font-mono text-lab-grayDark">FREQUENCY (f)</div>
                <div id="val-meas-freq" class="text-base font-mono font-bold text-lab-black">--- Hz</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-mono text-lab-grayDark">Ref: ${this.config.refFrequency.toFixed(1)} Hz (Tf: ${this.config.tolFrequency}Hz)</div>
                <div id="val-err-freq" class="text-xs font-mono font-bold text-lab-dark">Δ 0.00 Hz</div>
              </div>
            </div>

            <!-- Amplitude Row -->
            <div class="p-2.5 bg-lab-bg rounded-sm border border-lab-light flex items-center justify-between">
              <div>
                <div class="text-[10px] font-mono text-lab-grayDark">AMPLITUDE (A)</div>
                <div id="val-meas-amp" class="text-base font-mono font-bold text-lab-black">0.000</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-mono text-lab-grayDark">Ref: ${this.config.refAmplitude.toFixed(2)} (TA: ${this.config.tolAmplitude})</div>
                <div id="val-err-amp" class="text-xs font-mono font-bold text-lab-dark">Δ 0.000</div>
              </div>
            </div>

            <!-- Phase Row -->
            <div class="p-2.5 bg-lab-bg rounded-sm border border-lab-light flex items-center justify-between">
              <div>
                <div class="text-[10px] font-mono text-lab-grayDark">PHASE DIFFERENCE (Δφ)</div>
                <div id="val-meas-phase" class="text-base font-mono font-bold text-lab-black">---°</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-mono text-lab-grayDark">Ref: ${this.config.refPhase.toFixed(0)}° (Tφ: ${this.config.tolPhase}°)</div>
                <div id="val-err-phase" class="text-xs font-mono font-bold text-lab-dark">Δ 0.0°</div>
              </div>
            </div>
          </div>

          <!-- Normalized Error Meters & Weighted Score -->
          <div class="lab-card space-y-3">
            <div class="flex items-center justify-between border-b border-lab-light pb-1">
              <span class="text-xs font-mono font-bold text-lab-black">NORMALIZED ERROR METRICS</span>
              <span class="text-[10px] font-mono text-lab-grayDark">D = Σ (w_i · D_i)</span>
            </div>

            <!-- Df -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] font-mono">
                <span class="text-lab-dark">Df = |f - f0| / Tf</span>
                <div class="flex gap-2">
                  <span id="val-contrib-df" class="text-lab-grayDark">+0.000</span>
                  <span id="val-df" class="font-bold text-lab-black">0.000</span>
                </div>
              </div>
              <div class="w-full bg-lab-light h-1.5 rounded-full overflow-hidden">
                <div id="bar-df" class="bg-lab-black h-full transition-all duration-75" style="width: 0%"></div>
              </div>
            </div>

            <!-- DA -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] font-mono">
                <span class="text-lab-dark">DA = |A - A0| / TA</span>
                <div class="flex gap-2">
                  <span id="val-contrib-da" class="text-lab-grayDark">+0.000</span>
                  <span id="val-da" class="font-bold text-lab-black">0.000</span>
                </div>
              </div>
              <div class="w-full bg-lab-light h-1.5 rounded-full overflow-hidden">
                <div id="bar-da" class="bg-lab-black h-full transition-all duration-75" style="width: 0%"></div>
              </div>
            </div>

            <!-- Dphi -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] font-mono">
                <span class="text-lab-dark">Dφ = circularError / Tφ</span>
                <div class="flex gap-2">
                  <span id="val-contrib-dphi" class="text-lab-grayDark">+0.000</span>
                  <span id="val-dphi" class="font-bold text-lab-black">0.000</span>
                </div>
              </div>
              <div class="w-full bg-lab-light h-1.5 rounded-full overflow-hidden">
                <div id="bar-dphi" class="bg-lab-black h-full transition-all duration-75" style="width: 0%"></div>
              </div>
            </div>

            <!-- Final D Score Banner -->
            <div class="pt-2 border-t border-lab-light flex items-center justify-between">
              <div>
                <div class="text-[10px] font-mono font-bold text-lab-grayDark uppercase">Final Weighted Score</div>
                <div class="text-[11px] font-mono text-lab-dark">Threshold: ${this.config.threshold.toFixed(2)}</div>
              </div>
              <div class="text-right">
                <div id="val-final-score" class="text-3xl font-mono font-bold text-lab-black">0.000</div>
              </div>
            </div>

            <!-- Weight Sliders Configuration Accordion -->
            <div class="pt-2 border-t border-lab-light space-y-2">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="font-bold text-lab-black">WEIGHT COEFFICIENTS</span>
                <label class="flex items-center gap-1.5 text-[11px] text-lab-grayDark cursor-pointer">
                  <input id="chk-autonorm" type="checkbox" ${this.config.autoNormalize ? "checked" : ""} class="accent-lab-black">
                  Auto Normalize
                </label>
              </div>

              <div class="grid grid-cols-3 gap-3 text-[11px] font-mono">
                <div>
                  <div class="flex justify-between mb-0.5">
                    <span class="text-lab-grayDark">wf:</span>
                    <span id="lbl-wf" class="font-bold">${this.config.weightFreq.toFixed(2)}</span>
                  </div>
                  <input id="slider-wf" type="range" min="0" max="1" step="0.05" value="${this.config.weightFreq}" class="w-full">
                </div>
                <div>
                  <div class="flex justify-between mb-0.5">
                    <span class="text-lab-grayDark">wA:</span>
                    <span id="lbl-wa" class="font-bold">${this.config.weightAmp.toFixed(2)}</span>
                  </div>
                  <input id="slider-wa" type="range" min="0" max="1" step="0.05" value="${this.config.weightAmp}" class="w-full">
                </div>
                <div>
                  <div class="flex justify-between mb-0.5">
                    <span class="text-lab-grayDark">wφ:</span>
                    <span id="lbl-wphi" class="font-bold">${this.config.weightPhase.toFixed(2)}</span>
                  </div>
                  <input id="slider-wphi" type="range" min="0" max="1" step="0.05" value="${this.config.weightPhase}" class="w-full">
                </div>
              </div>
            </div>

          </div>

          <!-- Reference & Tolerances Settings Box -->
          <div class="lab-card space-y-2 text-xs font-mono">
            <span class="text-[11px] font-bold text-lab-black uppercase tracking-wider">Reference & Tolerance Targets</span>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="text-[10px] text-lab-grayDark">f0 (Hz)</label>
                <input id="input-ref-freq" type="number" step="1" value="${this.config.refFrequency}" class="w-full lab-input">
              </div>
              <div>
                <label class="text-[10px] text-lab-grayDark">A0 (Norm)</label>
                <input id="input-ref-amp" type="number" step="0.01" value="${this.config.refAmplitude}" class="w-full lab-input">
              </div>
              <div>
                <label class="text-[10px] text-lab-grayDark">φ0 (Deg)</label>
                <input id="input-ref-phase" type="number" step="1" value="${this.config.refPhase}" class="w-full lab-input">
              </div>
              <div>
                <label class="text-[10px] text-lab-grayDark">Tf (Hz)</label>
                <input id="input-tol-freq" type="number" step="0.5" value="${this.config.tolFrequency}" class="w-full lab-input">
              </div>
              <div>
                <label class="text-[10px] text-lab-grayDark">TA (Norm)</label>
                <input id="input-tol-amp" type="number" step="0.01" value="${this.config.tolAmplitude}" class="w-full lab-input">
              </div>
              <div>
                <label class="text-[10px] text-lab-grayDark">Tφ (Deg)</label>
                <input id="input-tol-phase" type="number" step="1" value="${this.config.tolPhase}" class="w-full lab-input">
              </div>
            </div>
            <div class="pt-1 flex items-center justify-between text-[11px]">
              <span class="text-lab-grayDark">Decision Threshold (D_th):</span>
              <input id="input-threshold" type="number" step="0.1" value="${this.config.threshold}" class="w-20 lab-input text-right">
            </div>
          </div>

        </div>
      </div>
    `;
  }
}
