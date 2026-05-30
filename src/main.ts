import './style.css';
import { DEFAULT_CONFIG, MM_PER_UNIT, type GridConfig } from './types.ts';
import { buildControls } from './controls.ts';
import { buildSVG } from './svg.ts';
import { computeGrid, computeSquareGrid } from './grid.ts';

const preview = document.getElementById('preview')!;
const info = document.getElementById('info')!;
const controlsRoot = document.getElementById('controls')!;

const config: GridConfig = { ...DEFAULT_CONFIG };
let prevUnit = config.unit;

function render(): void {
  preview.innerHTML = buildSVG(config);
  updateInfo();
}

function updateInfo(): void {
  const f = MM_PER_UNIT[config.unit];
  const u = config.unit;
  const fmt = (mm: number) => `${(mm / f).toFixed(u === 'mm' || u === 'px' || u === 'pt' ? 1 : 2)} ${u}`;

  if (config.gridType === 'cuadricula') {
    const sg = computeSquareGrid(config);
    if (!sg.valid) {
      info.textContent = `Página ${fmt(sg.pageW)} × ${fmt(sg.pageH)} — tamaño de celda inválido.`;
      return;
    }
    const cols = Math.max(0, sg.vLines.length - 1);
    const rows = Math.max(0, sg.hLines.length - 1);
    info.textContent =
      `Página ${fmt(sg.pageW)} × ${fmt(sg.pageH)}  ·  ` +
      `Celda ${fmt(sg.cellW)} × ${fmt(sg.cellH)}  ·  ` +
      `${cols}×${rows} celdas`;
    return;
  }

  const g = computeGrid(config);
  if (!g.valid) {
    info.textContent = `Página ${fmt(g.pageW)} × ${fmt(g.pageH)} — los márgenes/medianil no dejan espacio.`;
    return;
  }
  const colW = g.modules[0]?.w ?? 0;
  const rowH = g.modules[0]?.h ?? 0;
  info.textContent =
    `Página ${fmt(g.pageW)} × ${fmt(g.pageH)}  ·  ` +
    `Columna ${fmt(colW)}  ·  Fila ${fmt(rowH)}  ·  ` +
    `${config.columns}×${config.rows} módulos`;
}

// Al cambiar de unidad, convierte todos los valores de medida a la nueva unidad.
function handleChange(changed: keyof GridConfig): void {
  if (changed === 'unit' && config.unit !== prevUnit) {
    const factor = MM_PER_UNIT[prevUnit] / MM_PER_UNIT[config.unit];
    for (const key of ['customW', 'customH', 'gutterColumn', 'gutterRow', 'cellWidth', 'cellHeight', 'marginTop', 'marginBottom', 'marginInner', 'marginOuter'] as const) {
      config[key] = round(config[key] * factor);
    }
    prevUnit = config.unit;
  }
  // Re-sincroniza para reflejar conversiones y mostrar/ocultar campos según
  // el tamaño elegido (Personalizada) o el tipo de grilla (modular/cuadrícula).
  if (changed === 'unit' || changed === 'pageSize' || changed === 'gridType' || changed === 'gridUseMargins') {
    syncControls();
  }
  render();
}

const syncControls = buildControls(controlsRoot, config, handleChange);
render();

// En mobile, los botones de export/guardar van al final (después de los colores).
const exportActions = document.getElementById('export-actions')!;
const topbarActions = document.querySelector('.topbar-actions')!;
const mobileSlot = document.getElementById('mobile-actions-slot')!;
const mobileMq = window.matchMedia('(max-width: 760px)');
function placeExportActions(): void {
  if (mobileMq.matches) mobileSlot.appendChild(exportActions);
  else topbarActions.appendChild(exportActions);
}
placeExportActions();
mobileMq.addEventListener('change', placeExportActions);

document.getElementById('export-svg')!.addEventListener('click', () => {
  const svg = buildSVG(config, { absolute: true });
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'reticula.svg');
});

document.getElementById('export-png')!.addEventListener('click', () => {
  exportPNG().catch(() => alert('No se pudo generar el PNG.'));
});

async function exportPNG(): Promise<void> {
  const DPI = 300;
  const g = computeGrid(config);
  const pxPerMM = DPI / 25.4;
  const w = Math.round(g.pageW * pxPerMM);
  const h = Math.round(g.pageH * pxPerMM);

  const svg = buildSVG(config, { absolute: true });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = 'reticula.png';
    a.href = pngUrl;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = filename;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
