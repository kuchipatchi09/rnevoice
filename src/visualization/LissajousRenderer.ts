/**
 * Scientific Lissajous XY-Plot Renderer
 */
export class LissajousRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context not available");
    this.ctx = context;
  }

  public render(
    timeDataX: Float32Array,
    timeDataY: Float32Array,
    modeLabel: string,
    measuredPhaseDeg: number | null = null,
    isSimulated: boolean = false
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.42;

    // Grid & Coordinate Frame
    this.drawFrame(centerX, centerY, radius);

    // Draw XY Lissajous Trajectory
    const len = Math.min(timeDataX.length, timeDataY.length, 1024);
    if (len > 10) {
      ctx.beginPath();
      ctx.strokeStyle = isSimulated ? "#535356" : "#A33A31";
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";

      for (let i = 0; i < len; i++) {
        const xVal = timeDataX[i];
        const yVal = timeDataY[i];

        const plotX = centerX + xVal * radius;
        // Audio Y: inverted for standard mathematical XY plane
        const plotY = centerY - yVal * radius;

        if (i === 0) {
          ctx.moveTo(plotX, plotY);
        } else {
          ctx.lineTo(plotX, plotY);
        }
      }
      ctx.stroke();
    }

    // Top Mode Badge
    this.drawModeBadge(modeLabel, measuredPhaseDeg, isSimulated);
  }

  /**
   * Standalone Mathematical Simulator Render
   */
  public renderMathSimulation(
    ax: number,
    ay: number,
    fx: number,
    fy: number,
    phaseDeg: number,
    numPoints: number = 800
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.42;

    this.drawFrame(centerX, centerY, radius);

    const phaseRad = (phaseDeg * Math.PI) / 180;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const g = gcd(Math.round(fx), Math.round(fy)) || 1;
    const periods = Math.max(1, Math.round(fy) / g);
    const maxT = (2 * Math.PI * periods) / fx;

    ctx.beginPath();
    ctx.strokeStyle = "#2B2B2E";
    ctx.lineWidth = 2.0;

    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * maxT;
      const xVal = ax * Math.sin(2 * Math.PI * fx * (t / (2 * Math.PI)));
      const yVal = ay * Math.sin(2 * Math.PI * fy * (t / (2 * Math.PI)) + phaseRad);

      const plotX = centerX + xVal * radius;
      const plotY = centerY - yVal * radius;

      if (i === 0) {
        ctx.moveTo(plotX, plotY);
      } else {
        ctx.lineTo(plotX, plotY);
      }
    }
    ctx.stroke();

    this.drawModeBadge(`MATH SIMULATOR (${fx}:${fy} @ ${phaseDeg.toFixed(0)}°)`, phaseDeg, true);
  }

  private drawFrame(cx: number, cy: number, r: number) {
    const ctx = this.ctx;

    // Bounding Box
    ctx.strokeStyle = "#E7E6E1";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);

    // Reference Circle (Unit Amplitude = 1.0)
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshair axes (X=0, Y=0)
    ctx.strokeStyle = "#C2C1BB";
    ctx.beginPath();
    ctx.moveTo(cx - r - 10, cy);
    ctx.lineTo(cx + r + 10, cy);
    ctx.moveTo(cx, cy - r - 10);
    ctx.lineTo(cx, cy + r + 10);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = "#888783";
    ctx.font = "9px 'Asta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("X: Ref / CH1", cx, cy + r + 18);
    ctx.save();
    ctx.translate(cx - r - 18, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Y: Input / CH2", 0, 0);
    ctx.restore();

    // Ticks
    ctx.fillText("+1.0", cx + r, cy + 12);
    ctx.fillText("-1.0", cx - r, cy + 12);
    ctx.fillText("+1.0", cx + 14, cy - r + 3);
    ctx.fillText("-1.0", cx + 14, cy + r - 3);
  }

  private drawModeBadge(modeLabel: string, phaseDeg: number | null, isSimulated: boolean) {
    const ctx = this.ctx;
    ctx.font = "bold 9px 'Asta Sans', sans-serif";

    const badgeText = modeLabel;
    const textWidth = ctx.measureText(badgeText).width;

    ctx.fillStyle = isSimulated ? "rgba(83, 83, 86, 0.12)" : "rgba(163, 58, 49, 0.12)";
    ctx.strokeStyle = isSimulated ? "#888783" : "#A33A31";
    ctx.lineWidth = 1;

    ctx.fillRect(8, 8, textWidth + 14, 18);
    ctx.strokeRect(8, 8, textWidth + 14, 18);

    ctx.fillStyle = isSimulated ? "#535356" : "#A33A31";
    ctx.textAlign = "left";
    ctx.fillText(badgeText, 15, 20);

    if (phaseDeg !== null) {
      ctx.fillStyle = "#2B2B2E";
      ctx.textAlign = "right";
      ctx.fillText(`Δφ: ${phaseDeg.toFixed(1)}°`, this.canvas.width - 10, 20);
    }
  }
}
