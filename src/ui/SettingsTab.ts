import { AudioInput } from "../audio/AudioInput.ts";
import { AppSettings } from "../types/index.ts";
import { ExperimentStorage, DEFAULT_SETTINGS } from "../storage/ExperimentStorage.ts";

export class SettingsTab {
  private container: HTMLElement;
  private audioInput: AudioInput;
  private settings: AppSettings;
  private onSettingsChange: (newSettings: AppSettings) => void;

  constructor(
    container: HTMLElement,
    audioInput: AudioInput,
    settings: AppSettings,
    onSettingsChange: (newSettings: AppSettings) => void
  ) {
    this.container = container;
    this.audioInput = audioInput;
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.render();
    this.populateAudioDevices();
    this.bindEvents();
  }

  private async populateAudioDevices() {
    const select = this.container.querySelector("#select-audio-device") as HTMLSelectElement | null;
    if (!select) return;

    try {
      const devices = await this.audioInput.getAvailableDevices();
      select.innerHTML = `<option value="">-- Default System Audio Device --</option>` +
        devices.map((d, idx) => `
          <option value="${d.deviceId}" ${d.deviceId === this.settings.selectedDeviceId ? "selected" : ""}>
            ${d.label || `Microphone ${idx + 1}`}
          </option>
        `).join("");
    } catch {
      select.innerHTML = `<option value="">-- Default System Audio Device --</option>`;
    }
  }

  private bindEvents() {
    const selDevice = this.container.querySelector("#select-audio-device") as HTMLSelectElement | null;
    const selFft = this.container.querySelector("#select-fft-size") as HTMLSelectElement | null;
    const selSmooth = this.container.querySelector("#input-smooth-const") as HTMLInputElement | null;
    const selMovAvg = this.container.querySelector("#input-mov-avg") as HTMLInputElement | null;
    const chkSimRef = this.container.querySelector("#chk-sim-ref") as HTMLInputElement | null;
    const btnSave = this.container.querySelector("#btn-save-settings");
    const btnReset = this.container.querySelector("#btn-reset-settings");

    const save = () => {
      if (selDevice) this.settings.selectedDeviceId = selDevice.value;
      if (selFft) this.settings.fftSize = parseInt(selFft.value, 10);
      if (selSmooth) this.settings.smoothingTimeConstant = parseFloat(selSmooth.value);
      if (selMovAvg) this.settings.movingAverageFrames = parseInt(selMovAvg.value, 10);
      if (chkSimRef) this.settings.pureToneConfig.useSimulatedRefForMono = chkSimRef.checked;

      this.audioInput.setFftSize(this.settings.fftSize);
      this.audioInput.setSmoothingTimeConstant(this.settings.smoothingTimeConstant);

      ExperimentStorage.saveSettings(this.settings);
      this.onSettingsChange(this.settings);
    };

    selDevice?.addEventListener("change", save);
    selFft?.addEventListener("change", save);
    selSmooth?.addEventListener("input", save);
    selMovAvg?.addEventListener("input", save);
    chkSimRef?.addEventListener("change", save);

    btnSave?.addEventListener("click", () => {
      save();
      alert("설정이 정상적으로 저장되었습니다.");
    });

    btnReset?.addEventListener("click", () => {
      if (confirm("모든 설정을 기본값으로 초기화하시겠습니까?")) {
        this.settings = { ...DEFAULT_SETTINGS };
        ExperimentStorage.saveSettings(this.settings);
        this.onSettingsChange(this.settings);
        this.render();
        this.populateAudioDevices();
        this.bindEvents();
      }
    });
  }

  private render() {
    this.container.innerHTML = `
      <div class="flex-1 p-6 max-w-[1000px] mx-auto w-full space-y-6">
        
        <div class="lab-card flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-2.5 h-2.5 bg-lab-black rounded-full"></span>
            <div>
              <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                System & Hardware Configuration
              </h2>
              <p class="text-[11px] font-mono text-lab-grayDark">
                Audio Input Hardware, Web Audio DSP Parameters, Default Targets
              </p>
            </div>
          </div>
          <button id="btn-reset-settings" class="lab-btn text-xs">
            Reset to Defaults
          </button>
        </div>

        <div class="space-y-4">
          <!-- Audio Device Settings -->
          <div class="lab-card space-y-3">
            <span class="text-xs font-mono font-bold text-lab-black uppercase">1. Audio Hardware Input</span>
            <div class="space-y-2 text-xs font-mono">
              <label class="text-lab-grayDark">Select Input Device / USB Audio Interface:</label>
              <select id="select-audio-device" class="w-full lab-input py-2">
                <option value="">Loading audio devices...</option>
              </select>
              <p class="text-[11px] text-lab-grayDark">
                * Stereo Audio Interface (e.g. Focusrite Scarlett, Behringer UMC) 연결 시 CH1(Left)은 기준 신호, CH2(Right)는 측정 신호로 자동 분리됩니다.
              </p>
            </div>
          </div>

          <!-- DSP Parameters -->
          <div class="lab-card space-y-3">
            <span class="text-xs font-mono font-bold text-lab-black uppercase">2. DSP & Real-Time Filtering</span>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label class="text-lab-grayDark block mb-1">FFT Size / Buffer Resolution:</label>
                <select id="select-fft-size" class="w-full lab-input">
                  <option value="1024" ${this.settings.fftSize === 1024 ? "selected" : ""}>1024 (Δf ≈ 46.9 Hz, Low Latency)</option>
                  <option value="2048" ${this.settings.fftSize === 2048 ? "selected" : ""}>2048 (Δf ≈ 23.4 Hz, Standard Lab)</option>
                  <option value="4096" ${this.settings.fftSize === 4096 ? "selected" : ""}>4096 (Δf ≈ 11.7 Hz, High Resolution)</option>
                </select>
              </div>

              <div>
                <label class="text-lab-grayDark block mb-1">Moving Average Window (Frames):</label>
                <input id="input-mov-avg" type="number" min="1" max="30" value="${this.settings.movingAverageFrames}" class="w-full lab-input">
              </div>

              <div class="md:col-span-2">
                <label class="text-lab-grayDark block mb-1">AnalyserNode Smoothing Time Constant (0.0 ~ 0.9):</label>
                <input id="input-smooth-const" type="range" min="0.0" max="0.9" step="0.05" value="${this.settings.smoothingTimeConstant}" class="w-full">
              </div>

              <div class="md:col-span-2 pt-2 border-t border-lab-light">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input id="chk-sim-ref" type="checkbox" ${this.settings.pureToneConfig.useSimulatedRefForMono ? "checked" : ""} class="accent-lab-black">
                  <span>단일 마이크(Mono) 모드에서 가상 440Hz 기준파(Simulated Ref)와 위상차 비교 허용</span>
                </label>
                <p class="text-[10px] text-lab-grayDark mt-1 ml-5">
                  (단일 마이크인 경우 화면에 SIMULATED REFERENCE 뱃지가 명확히 표시되어 실제 스테레오 측정과 구분됩니다.)
                </p>
              </div>
            </div>
          </div>

          <!-- Save Button -->
          <div class="flex justify-end">
            <button id="btn-save-settings" class="lab-btn-primary px-6 py-2">
              ✓ Save Settings
            </button>
          </div>
        </div>

      </div>
    `;
  }
}
