import type { ReticleConfig } from './types.ts';

export function drawReticle(ctx: CanvasRenderingContext2D, cfg: ReticleConfig): void {
  const { canvas } = ctx;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  if (cfg.background === 'dark') {
    ctx.fillStyle = '#0c1410';
    ctx.fillRect(0, 0, w, h);
  } else if (cfg.background === 'light') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.strokeStyle = cfg.color;
  ctx.fillStyle = cfg.color;
  ctx.lineCap = 'butt';

  if (cfg.glow > 0) {
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = cfg.glow;
  }

  // Crosshair lines (four arms with a central gap)
  if (cfg.crosshair) {
    ctx.lineWidth = cfg.crosshairThickness;
    const gap = cfg.crosshairGap;
    const len = cfg.crosshairLength;
    line(ctx, cx, cy - gap, cx, cy - gap - len); // up
    line(ctx, cx, cy + gap, cx, cy + gap + len); // down
    line(ctx, cx - gap, cy, cx - gap - len, cy); // left
    line(ctx, cx + gap, cy, cx + gap + len, cy); // right
  }

  // Ticks along the lower vertical arm (mil-dot style ranging marks)
  if (cfg.ticks && cfg.tickCount > 0) {
    ctx.lineWidth = cfg.crosshairThickness;
    const start = cy + cfg.crosshairGap;
    for (let i = 1; i <= cfg.tickCount; i++) {
      const y = start + i * cfg.tickSpacing;
      line(ctx, cx - cfg.tickLength / 2, y, cx + cfg.tickLength / 2, y);
    }
  }

  // Outer circle
  if (cfg.circle) {
    ctx.lineWidth = cfg.circleThickness;
    ctx.beginPath();
    ctx.arc(cx, cy, cfg.circleRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Center dot
  if (cfg.centerDot) {
    ctx.beginPath();
    ctx.arc(cx, cy, cfg.centerDotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
