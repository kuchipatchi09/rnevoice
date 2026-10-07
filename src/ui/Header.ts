import { SignalQuality, InputSourceMode } from "../types/index.ts";

export class Header {
  private container: HTMLElement;
  private currentTab = "pure-tone";
  private onTabChange: (tab: string) => void;

  constructor(container: HTMLElement, onTabChange: (tab: string) => void) {
    this.container = container;
    this.onTabChange = onTabChange;
    this.render();
  }

  public setTab(tab: string) {
    this.currentTab = tab;
    this.render();
  }

  public updateStatus(
    isMicActive: boolean,
    sampleRate: number,
    mode: InputSourceMode,
    quality: SignalQuality
  ) {
    const micBadge = this.container.querySelector("#header-mic-status");
    const rateBadge = this.container.querySelector("#header-sample-rate");
    const modeBadge = this.container.querySelector("#header-mode-status");
    const qualityBadge = this.container.querySelector("#header-quality-status");

    if (micBadge) {
      if (isMicActive) {
        micBadge.className = "lab-badge lab-badge-good";
        micBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> ACTIVE`;
      } else {
        micBadge.className = "lab-badge lab-badge-neutral";
        micBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-lab-grayDark"></span> STANDBY`;
      }
    }

    if (rateBadge) {
      rateBadge.textContent = `${(sampleRate / 1000).toFixed(1)} kHz`;
    }

    if (modeBadge) {
      if (mode === "live-stereo") {
        modeBadge.className = "lab-badge lab-badge-good";
        modeBadge.textContent = "STEREO INPUT";
      } else if (mode === "synthetic") {
        modeBadge.className = "lab-badge lab-badge-warn";
        modeBadge.textContent = "TEST SIGNAL";
      } else {
        modeBadge.className = "lab-badge lab-badge-neutral";
        modeBadge.textContent = "MONO INPUT";
      }
    }

    if (qualityBadge) {
      if (quality === "GOOD") {
        qualityBadge.className = "lab-badge lab-badge-good";
        qualityBadge.textContent = "SIGNAL: GOOD";
      } else if (quality === "LOW_LEVEL") {
        qualityBadge.className = "lab-badge lab-badge-warn";
        qualityBadge.textContent = "LOW LEVEL";
      } else if (quality === "CLIPPING") {
        qualityBadge.className = "lab-badge lab-badge-danger";
        qualityBadge.textContent = "CLIPPING";
      } else if (quality === "UNSTABLE") {
        qualityBadge.className = "lab-badge lab-badge-warn";
        qualityBadge.textContent = "UNSTABLE FREQ";
      } else {
        qualityBadge.className = "lab-badge lab-badge-neutral";
        qualityBadge.textContent = "NO SIGNAL";
      }
    }
  }

  private render() {
    this.container.innerHTML = `
      <header class="border-b border-lab-gray bg-white/90 sticky top-0 z-30 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <!-- Left Title -->
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-sm bg-lab-black text-white flex items-center justify-center font-mono font-bold text-sm border border-lab-black">
            L
          </div>
          <div>
            <h1 class="text-base font-bold tracking-tight text-lab-black leading-tight">
              Lissajous Signal Lab
            </h1>
            <p class="text-[11px] font-mono text-lab-grayDark tracking-wide">
              R&E Experimental Signal Analysis System
            </p>
          </div>
        </div>

        <!-- Center Tabs -->
        <nav class="flex items-center gap-1 bg-lab-light/50 p-1 rounded-sm border border-lab-light">
          <button data-tab="pure-tone" class="lab-tab ${this.currentTab === "pure-tone" ? "lab-tab-active" : ""}">
            Pure Tone Analysis
          </button>
          <button data-tab="voice-spectrum" class="lab-tab ${this.currentTab === "voice-spectrum" ? "lab-tab-active" : ""}">
            Voice Spectrum
          </button>
          <button data-tab="lissajous-sim" class="lab-tab ${this.currentTab === "lissajous-sim" ? "lab-tab-active" : ""}">
            Lissajous Simulator
          </button>
          <button data-tab="records" class="lab-tab ${this.currentTab === "records" ? "lab-tab-active" : ""}">
            Experiment Records
          </button>
          <button data-tab="settings" class="lab-tab ${this.currentTab === "settings" ? "lab-tab-active" : ""}">
            Settings
          </button>
        </nav>

        <!-- Right System Indicators -->
        <div class="flex items-center gap-2">
          <span id="header-quality-status" class="lab-badge lab-badge-neutral">NO SIGNAL</span>
          <span id="header-mode-status" class="lab-badge lab-badge-neutral">MONO INPUT</span>
          <span id="header-sample-rate" class="lab-badge lab-badge-neutral">48.0 kHz</span>
          <span id="header-mic-status" class="lab-badge lab-badge-neutral">
            <span class="w-1.5 h-1.5 rounded-full bg-lab-grayDark"></span> STANDBY
          </span>
        </div>
      </header>
    `;

    // Attach tab click listeners
    const buttons = this.container.querySelectorAll<HTMLButtonElement>("button[data-tab]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (tab) {
          this.currentTab = tab;
          this.render();
          this.onTabChange(tab);
        }
      });
    });
  }
}
