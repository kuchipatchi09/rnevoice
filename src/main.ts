import "./style.css";
import { AudioInput } from "./audio/AudioInput.ts";
import { ExperimentStorage } from "./storage/ExperimentStorage.ts";
import { Header } from "./ui/Header.ts";
import { PureToneTab } from "./ui/PureToneTab.ts";
import { VoiceSpectrumTab } from "./ui/VoiceSpectrumTab.ts";
import { LissajousSimulatorTab } from "./ui/LissajousSimulatorTab.ts";
import { RecordsTab } from "./ui/RecordsTab.ts";
import { SettingsTab } from "./ui/SettingsTab.ts";
import { AppSettings } from "./types/index.ts";

class App {
  private audioInput: AudioInput;
  private settings: AppSettings;
  private header: Header | null = null;
  private activeTab = "pure-tone";
  
  // Tab Instances
  private pureToneTab: PureToneTab | null = null;
  private lissajousSimTab: LissajousSimulatorTab | null = null;

  private tabContainer: HTMLElement | null = null;
  private isDocumentVisible = true;

  constructor() {
    this.settings = ExperimentStorage.getSettings();
    this.audioInput = new AudioInput();
    this.audioInput.setFftSize(this.settings.fftSize);
    this.audioInput.setSmoothingTimeConstant(this.settings.smoothingTimeConstant);

    this.initDOM();
    this.initVisibilityListener();
    this.startRenderLoop();
  }

  private initDOM() {
    const appEl = document.querySelector<HTMLDivElement>("#app");
    if (!appEl) return;

    // Header container
    const headerContainer = document.createElement("div");
    appEl.appendChild(headerContainer);

    this.header = new Header(headerContainer, (tab) => this.switchTab(tab));

    // Main view container
    this.tabContainer = document.createElement("main");
    this.tabContainer.className = "flex-1 flex flex-col";
    appEl.appendChild(this.tabContainer);

    // Initial Tab Render
    this.switchTab("pure-tone");
  }

  private switchTab(tab: string) {
    if (!this.tabContainer) return;

    if (this.lissajousSimTab) {
      this.lissajousSimTab.destroy();
      this.lissajousSimTab = null;
    }

    this.activeTab = tab;
    this.tabContainer.innerHTML = "";

    if (tab === "pure-tone") {
      this.pureToneTab = new PureToneTab(
        this.tabContainer,
        this.audioInput,
        this.settings.pureToneConfig
      );
    } else if (tab === "voice-spectrum") {
      new VoiceSpectrumTab(this.tabContainer);
    } else if (tab === "lissajous-sim") {
      this.lissajousSimTab = new LissajousSimulatorTab(this.tabContainer);
    } else if (tab === "records") {
      new RecordsTab(this.tabContainer);
    } else if (tab === "settings") {
      new SettingsTab(
        this.tabContainer,
        this.audioInput,
        this.settings,
        (newSettings) => {
          this.settings = newSettings;
          if (this.pureToneTab) {
            this.pureToneTab.updateConfig(newSettings.pureToneConfig);
          }
        }
      );
    }
  }

  private initVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      this.isDocumentVisible = !document.hidden;
    });
  }

  private startRenderLoop() {
    const loop = () => {
      if (this.isDocumentVisible) {
        // Fetch current audio frame
        const frame = this.audioInput.getCurrentFrame(
          this.settings.pureToneConfig.refFrequency,
          this.settings.pureToneConfig.useSimulatedRefForMono
        );

        // Update Header status
        if (this.header) {
          this.header.updateStatus(
            this.audioInput.isActive(),
            this.audioInput.getSampleRate(),
            this.audioInput.getMode(),
            frame ? frame.quality : "NO_SIGNAL"
          );
        }

        // Update Pure Tone Tab if active
        if (this.activeTab === "pure-tone" && this.pureToneTab) {
          this.pureToneTab.updateFrame(frame);
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  new App();
});
