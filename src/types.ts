export interface ReticleConfig {
  background: 'dark' | 'light' | 'transparent';
  color: string;
  glow: number;

  centerDot: boolean;
  centerDotSize: number;

  crosshair: boolean;
  crosshairThickness: number;
  crosshairLength: number;
  crosshairGap: number;

  circle: boolean;
  circleRadius: number;
  circleThickness: number;

  ticks: boolean;
  tickCount: number;
  tickLength: number;
  tickSpacing: number;
}

export const DEFAULT_CONFIG: ReticleConfig = {
  background: 'dark',
  color: '#33ff66',
  glow: 6,

  centerDot: true,
  centerDotSize: 3,

  crosshair: true,
  crosshairThickness: 2,
  crosshairLength: 220,
  crosshairGap: 40,

  circle: true,
  circleRadius: 180,
  circleThickness: 2,

  ticks: true,
  tickCount: 5,
  tickLength: 14,
  tickSpacing: 28,
};
