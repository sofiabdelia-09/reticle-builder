import './style.css';
import { DEFAULT_CONFIG, type ReticleConfig } from './types.ts';
import { drawReticle } from './reticle.ts';
import { buildControls } from './controls.ts';

const canvas = document.getElementById('reticle') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const controlsRoot = document.getElementById('controls')!;

const config: ReticleConfig = { ...DEFAULT_CONFIG };

function render(): void {
  drawReticle(ctx, config);
}

const syncControls = buildControls(controlsRoot, config, render);
render();

document.getElementById('reset')!.addEventListener('click', () => {
  Object.assign(config, DEFAULT_CONFIG);
  syncControls();
  render();
});

document.getElementById('randomize')!.addEventListener('click', () => {
  const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
  config.color = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  config.glow = rand(0, 20);
  config.centerDot = Math.random() > 0.2;
  config.centerDotSize = rand(1, 10);
  config.crosshair = Math.random() > 0.1;
  config.crosshairThickness = rand(1, 6);
  config.crosshairLength = rand(80, 320);
  config.crosshairGap = rand(0, 120);
  config.circle = Math.random() > 0.4;
  config.circleRadius = rand(60, 320);
  config.circleThickness = rand(1, 6);
  config.ticks = Math.random() > 0.4;
  config.tickCount = rand(0, 10);
  config.tickLength = rand(6, 40);
  config.tickSpacing = rand(12, 50);
  syncControls();
  render();
});

document.getElementById('export-png')!.addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'reticle.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});

document.getElementById('export-json')!.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = 'reticle.json';
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
});

const importInput = document.getElementById('import-json') as HTMLInputElement;
importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    const loaded = JSON.parse(await file.text()) as Partial<ReticleConfig>;
    Object.assign(config, DEFAULT_CONFIG, loaded);
    syncControls();
    render();
  } catch {
    alert('Could not read that config file.');
  }
  importInput.value = '';
});
