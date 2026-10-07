import { LissajousRenderer } from "../visualization/LissajousRenderer.ts";

export class LissajousSimulatorTab {
  private container: HTMLElement;
  private renderer: LissajousRenderer | null = null;
  private ax = 1.0;
  private ay = 1.0;
  private fx = 1.0;
  private fy = 1.0;
  private phaseDeg = 90;
  private animId: number | null = null;
  private autoPhase = false;
  private phaseSpeed = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.initCanvas();
    this.bindEvents();
    this.startAnimation();
  }

  private initCanvas() {
    const canvas = this.container.querySelector("#canvas-standalone-liss") as HTMLCanvasElement | null;
    if (canvas) {
      canvas.width = canvas.clientWidth * window.devicePixelRatio || 500;
      canvas.height = canvas.clientHeight * window.devicePixelRatio || 500;
      this.renderer = new LissajousRenderer(canvas);
    }
  }

  private startAnimation() {
    const loop = () => {
      if (this.autoPhase) {
        this.phaseDeg = (this.phaseDeg + this.phaseSpeed) % 360;
        const sliderPhase = this.container.querySelector("#sim-phase") as HTMLInputElement | null;
        const lblPhase = this.container.querySelector("#lbl-sim-phase");
        if (sliderPhase) sliderPhase.value = this.phaseDeg.toString();
        if (lblPhase) lblPhase.textContent = `${this.phaseDeg.toFixed(1)}°`;
      }

      if (this.renderer && this.container.isConnected) {
        this.renderer.renderMathSimulation(this.ax, this.ay, this.fx, this.fy, this.phaseDeg, 1000);
      }

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  public destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private setPreset(fx: number, fy: number, phase: number) {
    this.fx = fx;
    this.fy = fy;
    this.phaseDeg = phase;
    this.updateControlsUI();
  }

  private updateControlsUI() {
    const setVal = (id: string, val: string) => {
      const el = this.container.querySelector(id) as HTMLInputElement | null;
      if (el) el.value = val;
    };
    const setTxt = (id: string, txt: string) => {
      const el = this.container.querySelector(id);
      if (el) el.textContent = txt;
    };

    setVal("#sim-fx", this.fx.toString());
    setVal("#sim-fy", this.fy.toString());
    setVal("#sim-ax", this.ax.toString());
    setVal("#sim-ay", this.ay.toString());
    setVal("#sim-phase", this.phaseDeg.toString());

    setTxt("#lbl-sim-fx", `${this.fx.toFixed(1)}`);
    setTxt("#lbl-sim-fy", `${this.fy.toFixed(1)}`);
    setTxt("#lbl-sim-ax", this.ax.toFixed(2));
    setTxt("#lbl-sim-ay", this.ay.toFixed(2));
    setTxt("#lbl-sim-phase", `${this.phaseDeg.toFixed(1)}°`);
    setTxt("#lbl-sim-ratio", `${this.fx}:${this.fy}`);
  }

  private bindEvents() {
    const sFx = this.container.querySelector("#sim-fx") as HTMLInputElement | null;
    const sFy = this.container.querySelector("#sim-fy") as HTMLInputElement | null;
    const sAx = this.container.querySelector("#sim-ax") as HTMLInputElement | null;
    const sAy = this.container.querySelector("#sim-ay") as HTMLInputElement | null;
    const sPhase = this.container.querySelector("#sim-phase") as HTMLInputElement | null;
    const chkAuto = this.container.querySelector("#chk-sim-autophase") as HTMLInputElement | null;

    const onUpdate = () => {
      if (sFx && sFy && sAx && sAy && sPhase) {
        this.fx = parseFloat(sFx.value);
        this.fy = parseFloat(sFy.value);
        this.ax = parseFloat(sAx.value);
        this.ay = parseFloat(sAy.value);
        this.phaseDeg = parseFloat(sPhase.value);
        this.updateControlsUI();
      }
    };

    sFx?.addEventListener("input", onUpdate);
    sFy?.addEventListener("input", onUpdate);
    sAx?.addEventListener("input", onUpdate);
    sAy?.addEventListener("input", onUpdate);
    sPhase?.addEventListener("input", onUpdate);
    chkAuto?.addEventListener("change", () => {
      this.autoPhase = !!chkAuto?.checked;
    });

    // Preset buttons
    this.container.querySelectorAll<HTMLButtonElement>("button[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-preset");
        if (p === "1-1-0") this.setPreset(1, 1, 0);
        else if (p === "1-1-45") this.setPreset(1, 1, 45);
        else if (p === "1-1-90") this.setPreset(1, 1, 90);
        else if (p === "1-1-180") this.setPreset(1, 1, 180);
        else if (p === "1-2-90") this.setPreset(1, 2, 90);
        else if (p === "2-3-90") this.setPreset(2, 3, 90);
        else if (p === "3-4-90") this.setPreset(3, 4, 90);
      });
    });
  }

  private render() {
    this.container.innerHTML = `
      <div class="flex-1 p-6 max-w-[1400px] mx-auto w-full space-y-6">
        <div class="lab-card flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-2.5 h-2.5 bg-lab-black rounded-full"></span>
            <div>
              <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                Lissajous Mathematical Curve Simulator
              </h2>
              <p class="text-[11px] font-mono text-lab-grayDark">
                x(t) = Ax · sin(2π fx t) &nbsp;|&nbsp; y(t) = Ay · sin(2π fy t + φ)
              </p>
            </div>
          </div>
          <div class="text-xs font-mono">
            Ratio: <span id="lbl-sim-ratio" class="font-bold text-lab-black text-sm">1:1</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <!-- Canvas (7 cols) -->
          <div class="md:col-span-7 lab-card flex flex-col items-center justify-center p-6">
            <div class="w-full max-w-[480px] aspect-square bg-white border border-lab-gray rounded-sm overflow-hidden">
              <canvas id="canvas-standalone-liss" class="w-full h-full block"></canvas>
            </div>
          </div>

          <!-- Controls (5 cols) -->
          <div class="md:col-span-5 space-y-4">
            <!-- Preset Buttons -->
            <div class="lab-card space-y-3">
              <span class="text-xs font-mono font-bold text-lab-black uppercase">Standard Presets</span>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button data-preset="1-1-0" class="lab-btn text-xs">1:1 / 0°</button>
                <button data-preset="1-1-45" class="lab-btn text-xs">1:1 / 45°</button>
                <button data-preset="1-1-90" class="lab-btn-primary text-xs">1:1 / 90°</button>
                <button data-preset="1-1-180" class="lab-btn text-xs">1:1 / 180°</button>
                <button data-preset="1-2-90" class="lab-btn text-xs">1:2 / 90°</button>
                <button data-preset="2-3-90" class="lab-btn text-xs">2:3 / 90°</button>
                <button data-preset="3-4-90" class="lab-btn text-xs">3:4 / 90°</button>
              </div>
            </div>

            <!-- Sliders -->
            <div class="lab-card space-y-4 text-xs font-mono">
              <span class="text-xs font-bold text-lab-black uppercase">Signal Parameters</span>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-lab-grayDark">Frequency X (fx):</span>
                  <span id="lbl-sim-fx" class="font-bold">1.0</span>
                </div>
                <input id="sim-fx" type="range" min="1" max="8" step="1" value="1" class="w-full">
              </div>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-lab-grayDark">Frequency Y (fy):</span>
                  <span id="lbl-sim-fy" class="font-bold">1.0</span>
                </div>
                <input id="sim-fy" type="range" min="1" max="8" step="1" value="1" class="w-full">
              </div>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-lab-grayDark">Amplitude X (Ax):</span>
                  <span id="lbl-sim-ax" class="font-bold">1.00</span>
                </div>
                <input id="sim-ax" type="range" min="0.1" max="1.0" step="0.05" value="1.0" class="w-full">
              </div>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-lab-grayDark">Amplitude Y (Ay):</span>
                  <span id="lbl-sim-ay" class="font-bold">1.00</span>
                </div>
                <input id="sim-ay" type="range" min="0.1" max="1.0" step="0.05" value="1.0" class="w-full">
              </div>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-lab-grayDark">Phase Difference (φ):</span>
                  <span id="lbl-sim-phase" class="font-bold">90.0°</span>
                </div>
                <input id="sim-phase" type="range" min="0" max="360" step="1" value="90" class="w-full">
              </div>

              <div class="pt-2 border-t border-lab-light flex items-center justify-between">
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input id="chk-sim-autophase" type="checkbox" class="accent-lab-black">
                  Auto Phase Rotation (Continuous Drift)
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
