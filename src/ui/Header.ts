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
        micBadge.textContent = "측정 중";
      } else {
        micBadge.className = "lab-badge lab-badge-neutral";
        micBadge.textContent = "대기 중";
      }
    }

    if (rateBadge) {
      rateBadge.textContent = `${(sampleRate / 1000).toFixed(1)} kHz`;
    }

    if (modeBadge) {
      if (mode === "live-stereo") {
        modeBadge.className = "lab-badge lab-badge-good";
        modeBadge.textContent = "스테레오 입력";
      } else if (mode === "synthetic") {
        modeBadge.className = "lab-badge lab-badge-warn";
        modeBadge.textContent = "테스트 신호";
      } else {
        modeBadge.className = "lab-badge lab-badge-neutral";
        modeBadge.textContent = "모노 입력";
      }
    }

    if (qualityBadge) {
      if (quality === "GOOD") {
        qualityBadge.className = "lab-badge lab-badge-good";
        qualityBadge.textContent = "신호 양호";
      } else if (quality === "LOW_LEVEL") {
        qualityBadge.className = "lab-badge lab-badge-warn";
        qualityBadge.textContent = "신호 미약";
      } else if (quality === "CLIPPING") {
        qualityBadge.className = "lab-badge lab-badge-danger";
        qualityBadge.textContent = "클리핑";
      } else if (quality === "UNSTABLE") {
        qualityBadge.className = "lab-badge lab-badge-warn";
        qualityBadge.textContent = "주파수 불안정";
      } else {
        qualityBadge.className = "lab-badge lab-badge-neutral";
        qualityBadge.textContent = "신호 없음";
      }
    }
  }

  private render() {
    this.container.innerHTML = `
      <header class="border-b border-lab-gray bg-white/90 sticky top-0 z-30 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <!-- Left Title -->
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-sm bg-lab-black text-white flex items-center justify-center font-mono font-bold text-xs border border-lab-black">
            L
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-tight text-lab-black leading-tight">
              리사주 신호 분석 연구 시스템
            </h1>
            <p class="text-[11px] font-mono text-lab-grayDark tracking-wide">
              Lissajous Signal Lab · R&E Experimental Analysis
            </p>
          </div>
        </div>

        <!-- Center Tabs -->
        <nav class="flex items-center gap-1 bg-lab-light/50 p-1 rounded-sm border border-lab-light">
          <button data-tab="pure-tone" class="lab-tab ${this.currentTab === "pure-tone" ? "lab-tab-active" : ""}">
            순음 분석
          </button>
          <button data-tab="voice-spectrum" class="lab-tab ${this.currentTab === "voice-spectrum" ? "lab-tab-active" : ""}">
            음성 스펙트럼
          </button>
          <button data-tab="lissajous-sim" class="lab-tab ${this.currentTab === "lissajous-sim" ? "lab-tab-active" : ""}">
            리사주 시뮬레이터
          </button>
          <button data-tab="records" class="lab-tab ${this.currentTab === "records" ? "lab-tab-active" : ""}">
            실험 기록
          </button>
          <button data-tab="settings" class="lab-tab ${this.currentTab === "settings" ? "lab-tab-active" : ""}">
            환경 설정
          </button>
        </nav>

        <!-- Right System Indicators -->
        <div class="flex items-center gap-2 text-xs">
          <span id="header-quality-status" class="lab-badge lab-badge-neutral">신호 없음</span>
          <span id="header-mode-status" class="lab-badge lab-badge-neutral">모노 입력</span>
          <span id="header-sample-rate" class="lab-badge lab-badge-neutral">48.0 kHz</span>
          <span id="header-mic-status" class="lab-badge lab-badge-neutral">대기 중</span>
        </div>
      </header>
    `;

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
