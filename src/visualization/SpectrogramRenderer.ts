/**
 * High-Performance Scientific Spectrogram Renderer for STFT
 */
export class SpectrogramRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context not available");
    this.ctx = context;
  }

  public render(stft: {
    times: number[];
    freqs: number[];
    matrix: Float32Array[];
    maxDb: number;
    minDb: number;
  }) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    const numFrames = stft.matrix.length;
    if (numFrames === 0) return;

    const numBins = stft.freqs.length;
    const plotMarginLeft = 45;
    const plotMarginBottom = 22;
    const plotWidth = width - plotMarginLeft - 10;
    const plotHeight = height - plotMarginBottom - 10;

    // Offscreen ImageData
    const imgData = ctx.createImageData(Math.floor(plotWidth), Math.floor(plotHeight));
    const data = imgData.data;

    const minDb = stft.minDb;
    const maxDb = stft.maxDb;
    const dbRange = Math.max(1, maxDb - minDb);

    const pw = Math.floor(plotWidth);
    const ph = Math.floor(plotHeight);

    for (let py = 0; py < ph; py++) {
      // Invert Y: top is high frequency, bottom is low frequency
      const binRatio = 1 - (py / ph);
      const binIdx = Math.min(numBins - 1, Math.floor(binRatio * numBins));

      for (let px = 0; px < pw; px++) {
        const frameRatio = px / pw;
        const frameIdx = Math.min(numFrames - 1, Math.floor(frameRatio * numFrames));

        const db = stft.matrix[frameIdx][binIdx];
        const normalized = Math.max(0, Math.min(1, (db - minDb) / dbRange));

        // Magma / Scientific colormap mapping
        const [r, g, b] = this.colormapMagma(normalized);

        const pixelIdx = (py * pw + px) * 4;
        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, plotMarginLeft, 10);

    // Border around plot area
    ctx.strokeStyle = "#2B2B2E";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotMarginLeft, 10, plotWidth, plotHeight);

    // Axes & Ticks
    this.drawAxes(plotMarginLeft, 10, plotWidth, plotHeight, stft.times, stft.freqs);
  }

  private colormapMagma(t: number): [number, number, number] {
    // Scientific Magma colormap approximation
    // 0: Deep Black/Purple -> 0.35: Dark Red/Magenta -> 0.7: Orange/Gold -> 1.0: Warm White
    if (t < 0.25) {
      const u = t / 0.25;
      return [Math.floor(20 + 60 * u), Math.floor(15 + 10 * u), Math.floor(30 + 70 * u)];
    } else if (t < 0.55) {
      const u = (t - 0.25) / 0.3;
      return [Math.floor(80 + 100 * u), Math.floor(25 + 30 * u), Math.floor(100 - 30 * u)];
    } else if (t < 0.85) {
      const u = (t - 0.55) / 0.3;
      return [Math.floor(180 + 65 * u), Math.floor(55 + 110 * u), Math.floor(70 - 40 * u)];
    } else {
      const u = (t - 0.85) / 0.15;
      return [Math.floor(245 + 10 * u), Math.floor(165 + 85 * u), Math.floor(30 + 215 * u)];
    }
  }

  private drawAxes(
    x: number,
    y: number,
    w: number,
    h: number,
    times: number[],
    freqs: number[]
  ) {
    const ctx = this.ctx;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#535356";

    // Y Axis (Frequency)
    ctx.textAlign = "right";
    const maxFreq = freqs.length > 0 ? freqs[freqs.length - 1] : 5000;
    const freqSteps = [0, 1000, 2000, 3000, 4000, 5000].filter(f => f <= maxFreq);

    for (const f of freqSteps) {
      const fRatio = f / maxFreq;
      const py = y + h - (fRatio * h);
      ctx.fillText(`${f >= 1000 ? (f / 1000) + "k" : f}Hz`, x - 5, py + 3);
      
      ctx.strokeStyle = "#E7E6E1";
      ctx.beginPath();
      ctx.moveTo(x - 3, py);
      ctx.lineTo(x, py);
      ctx.stroke();
    }

    // X Axis (Time)
    ctx.textAlign = "center";
    const maxTime = times.length > 0 ? times[times.length - 1] : 1.0;
    const timeDivs = 5;
    for (let i = 0; i <= timeDivs; i++) {
      const t = (maxTime / timeDivs) * i;
      const px = x + (i / timeDivs) * w;
      ctx.fillText(`${t.toFixed(1)}s`, px, y + h + 14);

      ctx.strokeStyle = "#E7E6E1";
      ctx.beginPath();
      ctx.moveTo(px, y + h);
      ctx.lineTo(px, y + h + 3);
      ctx.stroke();
    }
  }
}
