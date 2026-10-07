/**
 * Scientific FFT Spectrum Graph Renderer with Quadratic Peak Pin & Grid
 */
export class SpectrumRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context not available");
    this.ctx = context;
  }

  public render(
    freqDataDb: Float32Array,
    sampleRate: number,
    peakFrequency: number,
    peakDb: number,
    maxDisplayFreq: number = 5000,
    minDb: number = -100,
    maxDb: number = 0
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    const binResolution = sampleRate / (freqDataDb.length * 2);
    const maxBin = Math.min(freqDataDb.length - 1, Math.ceil(maxDisplayFreq / binResolution));

    // Draw Scientific Grid
    this.drawGrid(width, height, maxDisplayFreq, minDb, maxDb);

    // Draw Spectrum Curve & Subtle Fill
    ctx.beginPath();
    let peakCanvasX = 0;
    let peakCanvasY = height;

    for (let i = 0; i <= maxBin; i++) {
      const freq = i * binResolution;
      const x = (freq / maxDisplayFreq) * width;
      const db = Math.max(minDb, Math.min(maxDb, freqDataDb[i]));
      // Map [minDb, maxDb] to [height * 0.92, height * 0.08]
      const y = height * 0.92 - ((db - minDb) / (maxDb - minDb)) * (height * 0.84);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = "#2B2B2E";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill under curve
    ctx.lineTo((maxBin * binResolution / maxDisplayFreq) * width, height * 0.92);
    ctx.lineTo(0, height * 0.92);
    ctx.fillStyle = "rgba(43, 43, 46, 0.04)";
    ctx.fill();

    // Draw Peak Indicator Pin
    if (peakFrequency > 20 && peakFrequency <= maxDisplayFreq && peakDb > minDb + 10) {
      peakCanvasX = (peakFrequency / maxDisplayFreq) * width;
      const dbClamped = Math.max(minDb, Math.min(maxDb, peakDb));
      peakCanvasY = height * 0.92 - ((dbClamped - minDb) / (maxDb - minDb)) * (height * 0.84);

      // Vertical marker pin line
      ctx.beginPath();
      ctx.strokeStyle = "#A33A31";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(peakCanvasX, height * 0.92);
      ctx.lineTo(peakCanvasX, peakCanvasY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Peak target circle
      ctx.beginPath();
      ctx.arc(peakCanvasX, peakCanvasY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#A33A31";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Peak badge tooltip
      const labelText = `${peakFrequency.toFixed(1)} Hz (${peakDb.toFixed(1)} dB)`;
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      const textWidth = ctx.measureText(labelText).width;
      
      let badgeX = peakCanvasX - textWidth / 2;
      let badgeY = peakCanvasY - 14;
      if (badgeX + textWidth + 8 > width) badgeX = width - textWidth - 10;
      if (badgeX < 6) badgeX = 6;
      if (badgeY < 16) badgeY = peakCanvasY + 16;

      ctx.fillStyle = "rgba(43, 43, 46, 0.88)";
      ctx.fillRect(badgeX - 4, badgeY - 10, textWidth + 8, 14);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(labelText, badgeX, badgeY);
    }
  }

  private drawGrid(width: number, height: number, maxFreq: number, minDb: number, maxDb: number) {
    const ctx = this.ctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#E7E6E1";

    // Horizontal dB lines (-20, -40, -60, -80, -100 dB)
    const dbSteps = [-20, -40, -60, -80, -100];
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#888783";
    ctx.textAlign = "left";

    for (const db of dbSteps) {
      if (db >= minDb && db <= maxDb) {
        const y = height * 0.92 - ((db - minDb) / (maxDb - minDb)) * (height * 0.84);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(`${db} dB`, 6, y - 2);
      }
    }

    // Vertical Frequency lines (every 500 or 1000 Hz)
    const freqStep = maxFreq <= 2000 ? 500 : 1000;
    ctx.textAlign = "center";

    for (let f = freqStep; f < maxFreq; f += freqStep) {
      const x = (f / maxFreq) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height * 0.92);
      ctx.stroke();
      ctx.fillText(`${f >= 1000 ? (f / 1000) + "k" : f} Hz`, x, height - 3);
    }
  }
}
