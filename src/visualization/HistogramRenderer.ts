/**
 * Score Distribution Histogram for Scientific Trial Analysis
 */
export class HistogramRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context not available");
    this.ctx = context;
  }

  public render(scores: number[], threshold: number = 1.0) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    if (scores.length === 0) {
      ctx.fillStyle = "#888783";
      ctx.font = "11px 'Asta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No trial data recorded yet", width / 2, height / 2);
      return;
    }

    const maxScore = Math.max(2.0, Math.ceil(Math.max(...scores) * 1.2));
    const numBins = 15;
    const binWidthVal = maxScore / numBins;
    const bins = new Array(numBins).fill(0);

    for (const score of scores) {
      const b = Math.min(numBins - 1, Math.floor(score / binWidthVal));
      if (b >= 0) bins[b]++;
    }

    const maxCount = Math.max(1, Math.max(...bins));
    const padL = 30;
    const padR = 15;
    const padB = 25;
    const padT = 15;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    // Draw axes
    ctx.strokeStyle = "#C2C1BB";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + chartH);
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.stroke();

    // Bars
    const barW = chartW / numBins;

    for (let i = 0; i < numBins; i++) {
      const count = bins[i];
      const barH = (count / maxCount) * chartH;
      const x = padL + i * barW + 2;
      const y = padT + chartH - barH;
      const w = barW - 4;

      const binMid = (i + 0.5) * binWidthVal;
      const isPass = binMid < threshold;

      ctx.fillStyle = isPass ? "rgba(43, 43, 46, 0.75)" : "rgba(163, 58, 49, 0.75)";
      ctx.fillRect(x, y, w, barH);
      ctx.strokeStyle = isPass ? "#2B2B2E" : "#A33A31";
      ctx.strokeRect(x, y, w, barH);
    }

    // Threshold Marker Line
    if (threshold <= maxScore) {
      const threshX = padL + (threshold / maxScore) * chartW;
      ctx.strokeStyle = "#A33A31";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(threshX, padT);
      ctx.lineTo(threshX, padT + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#A33A31";
      ctx.font = "9px 'Asta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Threshold D=${threshold}`, threshX, padT - 3);
    }

    // Ticks & Labels
    ctx.fillStyle = "#888783";
    ctx.font = "9px 'Asta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${maxCount}`, padL - 5, padT + 8);
    ctx.fillText("0", padL - 5, padT + chartH);

    ctx.textAlign = "center";
    ctx.fillText("0.0", padL, padT + chartH + 14);
    ctx.fillText(`${(maxScore / 2).toFixed(1)}`, padL + chartW / 2, padT + chartH + 14);
    ctx.fillText(`${maxScore.toFixed(1)} (Score D)`, padL + chartW, padT + chartH + 14);
  }
}
