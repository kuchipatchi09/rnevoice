import { VoiceFeatures } from "../types/index.ts";
import { VoiceFeatureExtractor } from "../algorithms/VoiceFeatureExtractor.ts";
import { SpectrogramRenderer } from "../visualization/SpectrogramRenderer.ts";
import { WaveformRenderer } from "../visualization/WaveformRenderer.ts";
import { SpectrumRenderer } from "../visualization/SpectrumRenderer.ts";

export class VoiceSpectrumTab {
  private container: HTMLElement;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  
  // Recording State
  private isRecording = false;
  private recordedSamples: Float32Array[] = [];
  private totalRecordedLength = 0;
    private recordingDurationSec = 0;
  private maxRecordSec = 15;
  private timerInterval: number | null = null;

  // Features & Templates
  private currentFeatures: VoiceFeatures | null = null;
  private baselineFeatures: VoiceFeatures | null = null;
  private audioBufferSource: AudioBufferSourceNode | null = null;

  // Renderers
  private waveRenderer: WaveformRenderer | null = null;
  private specRenderer: SpectrumRenderer | null = null;
  private spectrogramRenderer: SpectrogramRenderer | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.initCanvases();
    this.bindEvents();
  }
  private initCanvases() {
    const waveCanvas = this.container.querySelector("#canvas-voice-waveform") as HTMLCanvasElement | null;
    const specCanvas = this.container.querySelector("#canvas-voice-spectrum") as HTMLCanvasElement | null;
    const stftCanvas = this.container.querySelector("#canvas-voice-spectrogram") as HTMLCanvasElement | null;

    if (waveCanvas) {
      waveCanvas.width = waveCanvas.clientWidth * window.devicePixelRatio || 700;
      waveCanvas.height = waveCanvas.clientHeight * window.devicePixelRatio || 140;
      this.waveRenderer = new WaveformRenderer(waveCanvas);
    }

    if (specCanvas) {
      specCanvas.width = specCanvas.clientWidth * window.devicePixelRatio || 700;
      specCanvas.height = specCanvas.clientHeight * window.devicePixelRatio || 140;
      this.specRenderer = new SpectrumRenderer(specCanvas);
    }

    if (stftCanvas) {
      stftCanvas.width = stftCanvas.clientWidth * window.devicePixelRatio || 700;
      stftCanvas.height = stftCanvas.clientHeight * window.devicePixelRatio || 220;
      this.spectrogramRenderer = new SpectrogramRenderer(stftCanvas);
    }
  }

  private async startRecording() {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.recordedSamples = [];
      this.totalRecordedLength = 0;
      this.isRecording = true;
      this.recordingDurationSec = 0;

      processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(inputData);
        this.recordedSamples.push(copy);
        this.totalRecordedLength += copy.length;

        // Auto stop if exceeding max duration
        if (this.audioContext && this.totalRecordedLength / this.audioContext.sampleRate >= this.maxRecordSec) {
          this.stopRecording();
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      const btnRecord = this.container.querySelector("#btn-voice-record") as HTMLButtonElement | null;
      const btnStop = this.container.querySelector("#btn-voice-stop") as HTMLButtonElement | null;
      if (btnRecord) btnRecord.disabled = true;
      if (btnStop) btnStop.disabled = false;

      const timerEl = this.container.querySelector("#lbl-voice-timer");
      this.timerInterval = window.setInterval(() => {
        this.recordingDurationSec += 0.1;
        if (timerEl) timerEl.textContent = `${this.recordingDurationSec.toFixed(1)}s / ${this.maxRecordSec}s`;
      }, 100);

    } catch (err) {
      alert(`마이크 녹음 권한 오류: ${(err as Error).message}`);
    }
  }

  private stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    const btnRecord = this.container.querySelector("#btn-voice-record") as HTMLButtonElement | null;
    const btnStop = this.container.querySelector("#btn-voice-stop") as HTMLButtonElement | null;
    const btnPlay = this.container.querySelector("#btn-voice-play") as HTMLButtonElement | null;
    if (btnRecord) btnRecord.disabled = false;
    if (btnStop) btnStop.disabled = true;
    if (btnPlay) btnPlay.disabled = false;

    // Concatenate PCM
    const fullPcm = new Float32Array(this.totalRecordedLength);
    let offset = 0;
    for (const chunk of this.recordedSamples) {
      fullPcm.set(chunk, offset);
      offset += chunk.length;
    }

    const sampleRate = this.audioContext ? this.audioContext.sampleRate : 48000;
    this.analyzePcm(fullPcm, sampleRate);
  }
  private analyzePcm(pcm: Float32Array, sampleRate: number) {
    if (pcm.length < 1000) return;

    this.currentFeatures = VoiceFeatureExtractor.extractFeatures(pcm, sampleRate);
    const feat = this.currentFeatures;

    // Render Waveform with Envelope
    if (this.waveRenderer) {
      this.waveRenderer.render(pcm.slice(0, Math.min(pcm.length, 2048)));
    }

    // Render Spectrogram
    if (this.spectrogramRenderer && feat.stftSpectrogram) {
      this.spectrogramRenderer.render(feat.stftSpectrogram);
    }

    // Render Global Spectrum
    if (this.specRenderer && feat.stftSpectrogram.matrix.length > 0) {
      const avgSpec = feat.stftSpectrogram.matrix[Math.floor(feat.stftSpectrogram.matrix.length / 2)];
      this.specRenderer.render(
        avgSpec,
        sampleRate,
        feat.dominantBands.length > 0 ? feat.dominantBands[0] : 0,
        feat.peakRms > 0 ? 20 * Math.log10(feat.peakRms) : -60,
        5000
      );
    }

    // Update Features UI
    this.updateFeatureCards(feat);

    // If baseline exists, compute comparison distance
    if (this.baselineFeatures) {
      this.updateDistanceComparison(this.baselineFeatures, feat);
    }
  }

  private updateFeatureCards(feat: VoiceFeatures) {
    const setTxt = (id: string, txt: string) => {
      const el = this.container.querySelector(id);
      if (el) el.textContent = txt;
    };

    setTxt("#feat-duration", `${feat.durationSec.toFixed(2)} s`);
    setTxt("#feat-avg-rms", feat.avgRms.toFixed(3));
    setTxt("#feat-peak-rms", feat.peakRms.toFixed(3));
    setTxt("#feat-pitch", feat.meanPitchHz ? `${feat.meanPitchHz.toFixed(1)} Hz` : "N/A (Unvoiced)");
    setTxt("#feat-centroid", `${feat.spectralCentroid.toFixed(1)} Hz`);
    setTxt("#feat-rolloff", `${feat.spectralRolloff.toFixed(1)} Hz`);
    setTxt("#feat-bandwidth", `${feat.spectralBandwidth.toFixed(1)} Hz`);
    setTxt("#feat-zcr", `${(feat.zeroCrossingRate * 100).toFixed(2)}%`);
    setTxt("#feat-formants", feat.dominantBands.length > 0 ? feat.dominantBands.map(b => `${b}Hz`).join(", ") : "N/A");
  }

  private updateDistanceComparison(base: VoiceFeatures, test: VoiceFeatures) {
    const dist = VoiceFeatureExtractor.computeVoiceDistance(base, test);
    
    const elBox = this.container.querySelector("#voice-match-card");
    if (elBox) {
      elBox.classList.remove("hidden");
      elBox.innerHTML = `
        <div class="p-3 border border-lab-black bg-white rounded-sm space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-lab-black">MULTI-FEATURE DISTANCE TO BASELINE (D_voice)</span>
            <span class="text-xs font-mono font-bold text-lab-red">D = ${dist.totalDistance.toFixed(3)}</span>
          </div>
          <div class="grid grid-cols-5 gap-2 text-[10px] font-mono">
            <div>D_spec: <span class="font-bold">${dist.dSpectrum.toFixed(3)}</span></div>
            <div>D_env: <span class="font-bold">${dist.dEnvelope.toFixed(3)}</span></div>
            <div>D_pitch: <span class="font-bold">${dist.dPitch.toFixed(3)}</span></div>
            <div>D_dur: <span class="font-bold">${dist.dDuration.toFixed(3)}</span></div>
            <div>D_rhythm: <span class="font-bold">${dist.dRhythm.toFixed(3)}</span></div>
          </div>
          <div class="text-[10px] font-mono text-lab-grayDark italic">
            * Research Extension Module: Quantified acoustic feature distances ready for multi-parameter authentication.
          </div>
        </div>
      `;
    }
  }

  private playRecordedAudio() {
    if (!this.currentFeatures || !this.audioContext) return;
    if (this.audioContext.state === "suspended") this.audioContext.resume();

    if (this.audioBufferSource) {
      try { this.audioBufferSource.stop(); } catch {}
    }

    const pcm = this.currentFeatures.pcmData;
    const buffer = this.audioContext.createBuffer(1, pcm.length, this.currentFeatures.sampleRate);
    (buffer as any).copyToChannel(pcm, 0);

    const src = this.audioContext.createBufferSource();
    src.buffer = buffer;
    src.connect(this.audioContext.destination);
    src.start();
    this.audioBufferSource = src;
  }
  private bindEvents() {
    const btnRec = this.container.querySelector("#btn-voice-record");
    const btnStop = this.container.querySelector("#btn-voice-stop");
    const btnPlay = this.container.querySelector("#btn-voice-play");
    const btnSaveBase = this.container.querySelector("#btn-save-baseline");

    btnRec?.addEventListener("click", () => this.startRecording());
    btnStop?.addEventListener("click", () => this.stopRecording());
    btnPlay?.addEventListener("click", () => this.playRecordedAudio());

    btnSaveBase?.addEventListener("click", () => {
      if (this.currentFeatures) {
        this.baselineFeatures = this.currentFeatures;
        alert("현재 녹음된 음성 특징이 Baseline Reference로 저장되었습니다. 새 샘플을 녹음하여 Feature Distance를 비교할 수 있습니다.");
        if (this.baselineFeatures) {
          this.updateDistanceComparison(this.baselineFeatures, this.baselineFeatures);
        }
      } else {
        alert("먼저 음성을 녹음해 주세요.");
      }
    });
  }

  private render() {
    this.container.innerHTML = `
      <div class="flex-1 p-6 max-w-[1700px] mx-auto w-full space-y-5">
        <!-- Top Toolbar Card -->
        <div class="lab-card flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-2.5 h-2.5 bg-lab-red rounded-full"></div>
            <div>
              <h2 class="text-xs font-mono font-bold text-lab-black uppercase tracking-wider">
                Voice Spectrum & STFT Analysis Module
              </h2>
              <p class="text-[11px] font-mono text-lab-grayDark">
                Vowel & Speech Recording, STFT Spectrogram, Acoustic Feature Extraction
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span id="lbl-voice-timer" class="text-xs font-mono font-bold text-lab-black px-3 py-1 bg-lab-light rounded-sm">
              0.0s / 15.0s
            </span>
            <button id="btn-voice-record" class="lab-btn-accent px-4 py-2">
              ● Record Voice
            </button>
            <button id="btn-voice-stop" class="lab-btn px-4 py-2" disabled>
              ⏹ Stop
            </button>
            <button id="btn-voice-play" class="lab-btn px-3 py-2" disabled>
              ▶ Play Audio
            </button>
            <button id="btn-save-baseline" class="lab-btn px-3 py-2">
              ⭐ Save Baseline Template
            </button>
          </div>
        </div>

        <div id="voice-match-card" class="hidden"></div>

        <!-- Graphs Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <!-- Left: STFT Spectrogram & Waveform (7 cols) -->
          <div class="lg:col-span-7 space-y-5">
            <!-- STFT Spectrogram -->
            <div class="lab-card flex flex-col">
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-lab-light">
                <span class="text-xs font-mono font-bold text-lab-black">
                  C. High-Resolution STFT Spectrogram (2048 FFT / Hann / 512 Hop)
                </span>
                <span class="text-[10px] font-mono text-lab-grayDark">Time vs Frequency (0~5kHz)</span>
              </div>
              <div class="relative w-full h-64 bg-white border border-lab-gray rounded-sm overflow-hidden">
                <canvas id="canvas-voice-spectrogram" class="w-full h-full block"></canvas>
              </div>
            </div>

            <!-- Waveform & Envelope -->
            <div class="lab-card flex flex-col">
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-lab-light">
                <span class="text-xs font-mono font-bold text-lab-black">
                  A. Time-Domain Waveform Sample
                </span>
                <span class="text-[10px] font-mono text-lab-grayDark">Initial PCM Buffer</span>
              </div>
              <div class="relative w-full h-36 bg-white border border-lab-gray rounded-sm overflow-hidden">
                <canvas id="canvas-voice-waveform" class="w-full h-full block"></canvas>
              </div>
            </div>
          </div>

          <!-- Right: Global Spectrum & Features (5 cols) -->
          <div class="lg:col-span-5 space-y-5">
            <!-- Global Spectrum -->
            <div class="lab-card flex flex-col">
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-lab-light">
                <span class="text-xs font-mono font-bold text-lab-black">
                  B. Average Frequency Spectrum
                </span>
                <span class="text-[10px] font-mono text-lab-grayDark">Mid-Frame Power</span>
              </div>
              <div class="relative w-full h-44 bg-white border border-lab-gray rounded-sm overflow-hidden">
                <canvas id="canvas-voice-spectrum" class="w-full h-full block"></canvas>
              </div>
            </div>

            <!-- Extracted Acoustic Features Table -->
            <div class="lab-card space-y-3">
              <div class="flex items-center justify-between pb-1 border-b border-lab-light">
                <span class="text-xs font-mono font-bold text-lab-black">EXTRACTED ACOUSTIC FEATURES</span>
                <span class="text-[10px] font-mono text-lab-grayDark">Direct DSP Calculation</span>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs font-mono">
                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">DURATION</div>
                  <div id="feat-duration" class="font-bold text-lab-black text-sm">---</div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">ESTIMATED PITCH (F0)</div>
                  <div id="feat-pitch" class="font-bold text-lab-black text-sm">---</div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">AVG / PEAK RMS</div>
                  <div class="font-bold text-lab-black text-sm">
                    <span id="feat-avg-rms">---</span> / <span id="feat-peak-rms">---</span>
                  </div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">SPECTRAL CENTROID</div>
                  <div id="feat-centroid" class="font-bold text-lab-black text-sm">---</div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">SPECTRAL ROLLOFF (85%)</div>
                  <div id="feat-rolloff" class="font-bold text-lab-black text-sm">---</div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">SPECTRAL BANDWIDTH</div>
                  <div id="feat-bandwidth" class="font-bold text-lab-black text-sm">---</div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">ZERO CROSSING RATE (ZCR)</div>
                  <div id="feat-zcr" class="font-bold text-lab-black text-sm">---</div>
                </div>

                <div class="p-2 bg-lab-bg rounded-sm border border-lab-light">
                  <div class="text-[10px] text-lab-grayDark">DOMINANT PEAK BANDS</div>
                  <div id="feat-formants" class="font-bold text-lab-black text-sm">---</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;
  }
}
