import { DEFAULT_CONFIG, MM_PER_UNIT, type GridConfig } from './types.ts';
import { buildControls } from './controls.ts';
import { buildSVG } from './svg.ts';
import { computeGrid, computeSquareGrid, pageDimsMM } from './grid.ts';

const TEMPLATE = `
  <div class="tool-reticulas">
    <header class="topbar">
      <div class="topbar-left">
        <a class="back-link" href="#/">← Inicio</a>
        <h1>Constructor de Retículas</h1>
      </div>
      <div class="topbar-actions">
        <div class="export-actions" id="export-actions">
          <button id="export-png" type="button">Exportar PNG</button>
          <button id="export-svg" type="button" class="primary">Exportar SVG</button>
        </div>
      </div>
    </header>
    <main class="layout">
      <section class="stage">
        <div id="preview" class="preview"></div>
        <p id="info" class="info"></p>
      </section>
      <aside class="controls" id="controls"></aside>
    </main>
    <div id="mobile-actions-slot"></div>
  </div>`;

export function mountReticulas(app: HTMLElement): () => void {
  app.innerHTML = TEMPLATE;

  const preview = app.querySelector<HTMLElement>('#preview')!;
  const info = app.querySelector<HTMLElement>('#info')!;
  const controlsRoot = app.querySelector<HTMLElement>('#controls')!;

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
    if (changed === 'unit' || changed === 'pageSize' || changed === 'gridType' || changed === 'gridUseMargins') {
      syncControls();
    }
    render();
  }

  const syncControls = buildControls(controlsRoot, config, handleChange);
  render();

  // En mobile, los botones de export van al final (después de los colores).
  const exportActions = app.querySelector<HTMLElement>('#export-actions')!;
  const topbarActions = app.querySelector<HTMLElement>('.topbar-actions')!;
  const mobileSlot = app.querySelector<HTMLElement>('#mobile-actions-slot')!;
  const mobileMq = window.matchMedia('(max-width: 760px)');
  function placeExportActions(): void {
    if (mobileMq.matches) mobileSlot.appendChild(exportActions);
    else topbarActions.appendChild(exportActions);
  }
  placeExportActions();
  mobileMq.addEventListener('change', placeExportActions);

  app.querySelector<HTMLButtonElement>('#export-svg')!.addEventListener('click', () => {
    const svg = buildSVG(config, { absolute: true });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'reticula.svg');
  });

  app.querySelector<HTMLButtonElement>('#export-png')!.addEventListener('click', () => {
    exportPNG().catch(() => alert('No se pudo generar el PNG.'));
  });

  async function exportPNG(): Promise<void> {
    const { w: pageWmm, h: pageHmm } = pageDimsMM(config);
    let w: number;
    let h: number;
    if (config.unit === 'px') {
      // en px: rasterizar 1:1 (el tamaño exacto que puso el usuario)
      w = Math.round(pageWmm / MM_PER_UNIT.px);
      h = Math.round(pageHmm / MM_PER_UNIT.px);
    } else {
      // en unidades físicas: 300 DPI
      const pxPerMM = 300 / 25.4;
      w = Math.round(pageWmm * pxPerMM);
      h = Math.round(pageHmm * pxPerMM);
    }

    const svg = buildSVG(config, { absolute: true });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const a = document.createElement('a');
      a.download = 'reticula.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // cleanup al desmontar la vista
  return () => {
    mobileMq.removeEventListener('change', placeExportActions);
  };
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
