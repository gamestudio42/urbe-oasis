export interface ChartSeries {
  label: string;
  color: string;
  values: readonly number[];
}

export interface ChartOptions {
  format(value: number): string;
  /** Label for the sample at index `i` (shown on a few ticks along the x axis). */
  xLabel(i: number): string;
  /** Force the y range to include zero (default true). */
  includeZero?: boolean;
}

const PAD = { left: 64, right: 12, top: 12, bottom: 24 };
const GRID_LINES = 4;

/** Draws a multi-series line chart sized to the canvas' CSS box. */
export function drawLineChart(
  canvas: HTMLCanvasElement,
  series: ChartSeries[],
  options: ChartOptions,
): void {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const count = Math.max(0, ...series.map((s) => s.values.length));
  if (count === 0) return;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of series) {
    for (const v of s.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (options.includeZero !== false) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max - min < 1e-9) {
    max += 1;
    min -= max === 1 ? 0 : 1;
  }
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (count === 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const yAt = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = '#94a3b8';
  ctx.lineWidth = 1;
  for (let g = 0; g <= GRID_LINES; g++) {
    const v = min + ((max - min) * g) / GRID_LINES;
    const y = Math.round(yAt(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(width - PAD.right, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(options.format(v), PAD.left - 6, y);
  }
  if (min < 0 && max > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    const y = Math.round(yAt(0)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(width - PAD.right, y);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const ticks = Math.min(count, 6);
  for (let k = 0; k < ticks; k++) {
    const i = ticks === 1 ? 0 : Math.round((k / (ticks - 1)) * (count - 1));
    ctx.fillText(options.xLabel(i), xAt(i), height - PAD.bottom + 6);
  }

  for (const s of series) {
    if (s.values.length === 0) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = xAt(i + count - s.values.length);
      const y = yAt(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}
