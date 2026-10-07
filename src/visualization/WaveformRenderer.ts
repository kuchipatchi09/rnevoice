/**
 * Scientific Oscilloscope Time-Domain Waveform Renderer
 */
export class WaveformRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context not available");
    this.ctx = context;
  }

  public render(
    timeDataLeft: Float32Array,
    timeDataRight?: Float32Array,
    isStereo: boolean = false
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    // Draw Scientific Grid
    this.drawGrid(width, height);

    // Triggering: find zero-crossing with positive slope for stable display
    const triggerOffset = this.findZeroCrossingTrigger(timeDataLeft);

    // Draw Left Channel (Reference or Main Input)
    this.drawChannel(timeDataLeft, triggerOffset, width, height, isStereo ? "#2B2B2E" : "#2B2B2E", 1.8);

    // Draw Right Channel (if Stereo input is active)
    if (isStereo && timeDataRight) {
      this.drawChannel(timeDataRight, triggerOffset, width, height, "#A33A31", 1.8);
    }

    // Legend & Scales
    this.drawLegend(isStereo);
  }

  private drawGrid(width: number, height: number) {
    const ctx = this.ctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#E7E6E1";

    // Horizontal grid lines (Amplitude: +1.0, +0.5, 0, -0.5, -1.0)
    const yLines = [0.1, 0.3, 0.5, 0.7, 0.9];
    for (const ratio of yLines) {
      ctx.beginPath();
      ctx.moveTo(0, height * ratio);
      ctx.lineTo(width, height * ratio);
      ctx.stroke();
    }

    // Center zero line (accented)
    ctx.strokeStyle = "#C2C1BB";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    // Vertical time division lines
    ctx.strokeStyle = "#E7E6E1";
    const xDivs = 8;
    for (let i = 1; i < xDivs; i++) {
      ctx.beginPath();
      ctx.moveTo((width / xDivs) * i, 0);
      ctx.lineTo((width / xDivs) * i, height);
      ctx.stroke();
    }

    // Scale Ticks Text
    ctx.fillStyle = "#888783";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("+1.0", 6, 14);
    ctx.fillText(" 0.0", 6, height * 0.5 - 3);
    ctx.fillText("-1.0", 6, height - 6);
  }

  private drawChannel(
    data: Float32Array,
    offset: number,
    width: number,
    height: number,
    color: string,
    lineWidth: number
  ) {
    const ctx = this.ctx;
    const len = data.length;
    const visibleSamples = Math.min(len - offset, 1024);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";

    for (let i = 0; i < visibleSamples; i++) {
      const sample = data[offset + i];
      const x = (i / visibleSamples) * width;
      // Map [-1.0, 1.0] to [height * 0.9, height * 0.1]
      const y = (height * 0.5) - (sample * height * 0.4);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  private findZeroCrossingTrigger(data: Float32Array): number {
    const searchLimit = Math.min(data.length - 512, 256);
    for (let i = 1; i < searchLimit; i++) {
      if (data[i - 1] < 0 && data[i] >= 0) {
        return i;
      }
    }
    return 0;
  }

  private drawLegend(isStereo: boolean) {
    const ctx = this.ctx;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";

    if (isStereo) {
      // Left channel indicator
      ctx.fillStyle = "#2B2B2E";
      ctx.fillText("CH1 (L / Ref)", this.canvas.width - 90, 14);
      // Right channel indicator
      ctx.fillStyle = "#A33A31";
      ctx.fillText("CH2 (R / In)", this.canvas.width - 12, 14);
    } else {
      ctx.fillStyle = "#535356";
      ctx.fillText("CH1 (MONO INPUT)", this.canvas.width - 12, 14);
    }
  }
}
