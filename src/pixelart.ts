import { isHex } from './color.ts';
import { createColorPicker } from './colorpicker.ts';
import { PALETTES } from './palettes.ts';
import {
  cornerColor,
  distinctColors,
  drawGrid,
  gridFromImage,
  gridToPNG,
  gridToSVG,
  type Cell,
  type PixelGrid,
} from './pixelize.ts';

const CUSTOM_KEY = 'dt-pixelart-palette';
const CC_PALETTE_KEY = 'dt-palette'; // "Mi paleta" del Conversor de Color

// Lee la paleta guardada en el Conversor de Color (lista de HEX en localStorage).
function loadCCPalette(): string[] {
  try {
    const raw = localStorage.getItem(CC_PALETTE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const SESSION_KEY = 'dt-pixelart-session'; // autosave del trabajo en curso
const SESSION_MAX_DIM = 1200; // tope de la copia de imagen que se guarda

// Copia acotada de la imagen (PNG, conserva transparencia) para persistir sin
// reventar el cupo de localStorage; alcanza para re-pixelar.
function cappedDataURL(img: HTMLImageElement): string {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  let w = iw;
  let h = ih;
  const m = Math.max(iw, ih);
  if (m > SESSION_MAX_DIM) {
    const r = SESSION_MAX_DIM / m;
    w = Math.max(1, Math.round(iw * r));
    h = Math.max(1, Math.round(ih * r));
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/png');
}

// Parsea una lista de HEX pegada (una por línea, o separadas por coma/espacio).
function parseHexList(text: string): string[] {
  const out: string[] = [];
  for (let token of text.split(/[\s,;]+/)) {
    token = token.trim();
    if (!token) continue;
    if (!token.startsWith('#')) token = '#' + token;
    if (isHex(token)) {
      const hex = token.toUpperCase();
      if (!out.includes(hex)) out.push(hex);
    }
  }
  return out;
}

const TEMPLATE = `
  <div class="tool-pixelart">
    <header class="topbar">
      <div class="topbar-left">
        <a class="back-link" href="#/">← Inicio</a>
        <h1>Generador de Pixel Art</h1>
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
        <div id="pa-stage" class="pa-stage">
          <div class="pa-empty" id="pa-empty">
            <p>Subí una imagen o arrastrala acá para empezar.</p>
          </div>
          <div class="pa-canvas-wrap" id="pa-canvas-wrap" hidden>
            <canvas id="pa-canvas" class="pa-canvas"></canvas>
            <div class="pa-grid-overlay" id="pa-grid-overlay"></div>
          </div>
        </div>
        <p id="pa-info" class="info"></p>
      </section>
      <aside class="controls" id="pa-controls"></aside>
    </main>
    <div id="mobile-actions-slot"></div>
  </div>`;

interface State {
  img: HTMLImageElement | null;
  cols: number;
  cellPx: number;
  grayscale: boolean;
  alphaThreshold: number; // 0..1
  removeBg: boolean;
  bgColor: string; // HEX del fondo a quitar
  bgTolerance: number; // 0..1
  paletteId: string; // 'original' | 'custom' | 'p0'..'pN'
  brush: string; // HEX
  brushSize: number; // lado del pincel en celdas (1 = una celda)
  erasing: boolean;
  showGrid: boolean;
  zoom: number; // 1 = ajustar a la vista; >1 = acercar
  isolate: string | null; // color aislado (modo capa)
  grid: PixelGrid | null;
}

const MAX_HISTORY = 60;

export function mountPixelArt(app: HTMLElement): () => void {
  app.innerHTML = TEMPLATE;

  const stage = app.querySelector<HTMLElement>('#pa-stage')!;
  const empty = app.querySelector<HTMLElement>('#pa-empty')!;
  const canvasWrap = app.querySelector<HTMLElement>('#pa-canvas-wrap')!;
  const canvas = app.querySelector<HTMLCanvasElement>('#pa-canvas')!;
  const gridOverlay = app.querySelector<HTMLElement>('#pa-grid-overlay')!;
  const info = app.querySelector<HTMLElement>('#pa-info')!;
  const controls = app.querySelector<HTMLElement>('#pa-controls')!;

  const state: State = {
    img: null,
    cols: 64,
    cellPx: 16,
    grayscale: false,
    alphaThreshold: 0.5,
    removeBg: false,
    bgColor: '#FFFFFF',
    bgTolerance: 0.12,
    paletteId: 'original',
    brush: '#000000',
    brushSize: 1,
    erasing: false,
    showGrid: false,
    zoom: 1,
    isolate: null,
    grid: null,
  };

  let customPalette: string[] = loadCustom();

  // ---- historial (deshacer / rehacer) ----
  let undoStack: Cell[][] = [];
  let redoStack: Cell[][] = [];
  let renderHistory = (): void => {};
  let renderLayers = (): void => {};
  let renderZoom = (): void => {};

  function resetHistory(): void {
    undoStack = [];
    redoStack = [];
    renderHistory();
  }

  // Guarda el estado actual ANTES de una edición, para poder deshacerla.
  function beginEdit(): void {
    if (!state.grid) return;
    undoStack.push(state.grid.cells.slice());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    renderHistory();
  }

  function undo(): void {
    if (!state.grid || !undoStack.length) return;
    redoStack.push(state.grid.cells.slice());
    state.grid.cells = undoStack.pop()!;
    paint();
    renderLayers();
    renderHistory();
    scheduleSave();
  }

  function redo(): void {
    if (!state.grid || !redoStack.length) return;
    undoStack.push(state.grid.cells.slice());
    state.grid.cells = redoStack.pop()!;
    paint();
    renderLayers();
    renderHistory();
    scheduleSave();
  }

  // ---- autosave en localStorage (para no perder el progreso al salir/volver) ----
  let imgDataURL: string | null = null;
  let saveTimer: number | null = null;

  function scheduleSave(): void {
    if (saveTimer != null) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveSession, 500);
  }

  function saveSession(): void {
    if (saveTimer != null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!state.grid) return;
    const snapshot = {
      cols: state.cols,
      cellPx: state.cellPx,
      grayscale: state.grayscale,
      alphaThreshold: state.alphaThreshold,
      removeBg: state.removeBg,
      bgColor: state.bgColor,
      bgTolerance: state.bgTolerance,
      paletteId: state.paletteId,
      brush: state.brush,
      brushSize: state.brushSize,
      showGrid: state.showGrid,
    };
    const base = { v: 1, state: snapshot, grid: state.grid };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...base, img: imgDataURL }));
    } catch {
      // sin lugar para la imagen: guardar al menos la grilla y los ajustes
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...base, img: null }));
      } catch {
        /* localStorage lleno: no se pudo guardar */
      }
    }
  }

  interface Session {
    img: string | null;
    grid: PixelGrid;
    state: Record<string, unknown>;
  }
  function loadSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !o.grid || !o.state || !Array.isArray(o.grid.cells)) return null;
      return o as Session;
    } catch {
      return null;
    }
  }

  // ---- paleta activa (colores a los que se reduce la imagen / del pincel) ----
  function activePalette(): string[] | null {
    if (state.paletteId === 'original') return null;
    if (state.paletteId === 'custom') return customPalette.length ? customPalette : null;
    if (state.paletteId === 'cc') {
      const cc = loadCCPalette();
      return cc.length ? cc : null;
    }
    const p = PALETTES.find((x) => x.id === state.paletteId);
    return p ? p.colors : null;
  }

  // ====================== imagen → grilla ======================
  function regrid(): void {
    if (!state.img) return;
    state.grid = gridFromImage(state.img, state.cols, {
      grayscale: state.grayscale,
      palette: activePalette(),
      alphaThreshold: state.alphaThreshold,
      bg: state.removeBg ? state.bgColor : null,
      bgTolerance: state.bgTolerance,
    });
    state.isolate = null; // la grilla cambió: no tiene sentido mantener la capa
    resetHistory();
    paint();
    fitCanvas();
    updateInfo();
    renderLayers();
    scheduleSave();
  }

  function paint(): void {
    if (state.grid) drawGrid(canvas, state.grid, state.isolate);
  }

  function fitCanvas(): void {
    if (!state.grid) return;
    const availW = stage.clientWidth - 32;
    const availH = stage.clientHeight - 32;
    if (availW <= 0 || availH <= 0) return;
    // escala base = ajustar a la vista; el zoom la multiplica
    const base = Math.max(1, Math.min(availW / state.grid.cols, availH / state.grid.rows));
    const scale = base * state.zoom;
    const w = state.grid.cols * scale;
    const h = state.grid.rows * scale;
    canvasWrap.style.width = `${w}px`;
    canvasWrap.style.height = `${h}px`;
    stage.classList.toggle('pa-zoomed', state.zoom > 1.001);
    // grilla superpuesta: una línea por celda, al tamaño mostrado
    const cell = w / state.grid.cols;
    gridOverlay.style.backgroundSize = `${cell}px ${cell}px`;
    gridOverlay.hidden = !state.showGrid || cell < 4;
  }

  function setZoom(z: number): void {
    state.zoom = Math.min(16, Math.max(1, z));
    fitCanvas();
    renderZoom();
  }

  function updateInfo(): void {
    if (!state.grid) {
      info.textContent = '';
      return;
    }
    const { cols, rows } = state.grid;
    info.textContent =
      `Grilla ${cols} × ${rows} celdas  ·  celda ${state.cellPx} px  ·  ` +
      `salida ${cols * state.cellPx} × ${rows * state.cellPx} px`;
  }

  // ====================== carga de imagen ======================
  function loadFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.img = img;
        imgDataURL = cappedDataURL(img); // copia para autosave
        state.bgColor = cornerColor(img); // candidato de fondo prellenado
        empty.hidden = true;
        canvasWrap.hidden = false;
        buildControls(); // refresca etiqueta y el color de fondo prellenado
        regrid();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // drag & drop sobre el stage
  stage.addEventListener('dragover', (e) => {
    e.preventDefault();
    stage.classList.add('is-dragover');
  });
  stage.addEventListener('dragleave', () => stage.classList.remove('is-dragover'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    stage.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });

  // ====================== edición manual (pincel) ======================
  function cellFromEvent(e: PointerEvent): { x: number; y: number } | null {
    if (!state.grid) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * state.grid.cols);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * state.grid.rows);
    if (x < 0 || y < 0 || x >= state.grid.cols || y >= state.grid.rows) return null;
    return { x, y };
  }

  // Aplica el valor del pincel a una celda. Devuelve true si cambió algo.
  // En modo capa funciona como máscara: sólo toca celdas del color aislado.
  function applyCell(idx: number): boolean {
    if (!state.grid) return false;
    if (state.isolate) {
      const cur = state.grid.cells[idx];
      if (cur == null || cur.toUpperCase() !== state.isolate.toUpperCase()) return false;
    }
    const value = state.erasing ? null : state.brush;
    if (state.grid.cells[idx] === value) return false;
    state.grid.cells[idx] = value;
    if (!state.isolate) {
      // dibujo incremental (rápido durante el arrastre)
      const ctx = canvas.getContext('2d')!;
      const x = idx % state.grid.cols;
      const y = Math.floor(idx / state.grid.cols);
      ctx.clearRect(x, y, 1, 1);
      if (value != null) {
        ctx.fillStyle = value;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return true;
  }

  // Pinta un bloque cuadrado de lado `brushSize` centrado en la celda (cx, cy).
  function paintAt(cx: number, cy: number): void {
    if (!state.grid) return;
    const size = Math.max(1, state.brushSize);
    const half = Math.floor(size / 2);
    let changed = false;
    for (let j = 0; j < size; j++) {
      const y = cy - half + j;
      if (y < 0 || y >= state.grid.rows) continue;
      for (let i = 0; i < size; i++) {
        const x = cx - half + i;
        if (x < 0 || x >= state.grid.cols) continue;
        if (applyCell(y * state.grid.cols + x)) changed = true;
      }
    }
    // en modo capa repintar entero (el velo cubre todo)
    if (changed && state.isolate) paint();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state.grid) return;
    canvas.setPointerCapture(e.pointerId);
    beginEdit(); // una entrada de historial por trazo
    const c = cellFromEvent(e);
    if (c) paintAt(c.x, c.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    const c = cellFromEvent(e);
    if (c) paintAt(c.x, c.y);
  });
  canvas.addEventListener('pointerup', () => {
    renderLayers();
    scheduleSave();
  });

  // reemplaza todas las celdas de un color por otro (o por transparente)
  function bulkReplace(from: string, to: Cell): void {
    if (!state.grid) return;
    const f = from.toUpperCase();
    const cells = state.grid.cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c != null && c.toUpperCase() === f) cells[i] = to;
    }
  }

  // ====================== panel de controles ======================
  const pickers: { destroy: () => void }[] = [];
  let renderBrushes = (): void => {};

  function buildControls(): void {
    // destruir pickers de un render anterior (sus popovers viven en <body>)
    pickers.forEach((p) => p.destroy());
    pickers.length = 0;
    controls.innerHTML = '';

    // --- Imagen ---
    const gImg = group('Imagen');
    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'pa-upload';
    uploadLabel.textContent = state.img ? 'Cambiar imagen' : 'Subir imagen';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f) {
        loadFile(f);
        uploadLabel.textContent = 'Cambiar imagen';
      }
      fileInput.value = ''; // permite volver a elegir el mismo archivo
    });
    uploadLabel.appendChild(fileInput);
    gImg.appendChild(uploadLabel);

    // --- Vista (zoom) ---
    const gView = group('Vista');
    const zoomHead = document.createElement('div');
    zoomHead.className = 'control-label';
    const zoomLbl = document.createElement('span');
    zoomLbl.textContent = 'Zoom';
    const zoomBadge = document.createElement('span');
    zoomBadge.className = 'pa-value';
    zoomHead.append(zoomLbl, zoomBadge);
    gView.appendChild(zoomHead);
    const zoomRow = document.createElement('div');
    zoomRow.className = 'pa-brush-row';
    const zoomOut = document.createElement('button');
    zoomOut.type = 'button';
    zoomOut.textContent = '−';
    zoomOut.addEventListener('click', () => setZoom(state.zoom / 1.25));
    const zoomIn = document.createElement('button');
    zoomIn.type = 'button';
    zoomIn.textContent = '+';
    zoomIn.addEventListener('click', () => setZoom(state.zoom * 1.25));
    const zoomFit = document.createElement('button');
    zoomFit.type = 'button';
    zoomFit.textContent = 'Ajustar';
    zoomFit.addEventListener('click', () => setZoom(1));
    zoomRow.append(zoomOut, zoomIn, zoomFit);
    gView.appendChild(zoomRow);
    const zoomHint = document.createElement('p');
    zoomHint.className = 'pa-hint';
    zoomHint.textContent = 'Ctrl + rueda del mouse sobre la imagen para acercar/alejar.';
    gView.appendChild(zoomHint);
    renderZoom = () => {
      zoomBadge.textContent = `${Math.round(state.zoom * 100)}%`;
      zoomOut.disabled = state.zoom <= 1.001;
    };

    // --- Pixelado ---
    const gPix = group('Pixelado');
    gPix.appendChild(
      rangeRow('Resolución (ancho)', state.cols, 8, 200, 1, (v) => {
        state.cols = v;
        regrid();
      }),
    );
    gPix.appendChild(
      numberRow('Tamaño de celda (px)', state.cellPx, 1, 100, (v) => {
        state.cellPx = v;
        updateInfo();
        scheduleSave();
      }),
    );
    gPix.appendChild(
      rangeRow('Recorte de transparencia %', Math.round(state.alphaThreshold * 100), 0, 100, 1, (v) => {
        state.alphaThreshold = v / 100;
        regrid();
      }),
    );
    const thHint = document.createElement('p');
    thHint.className = 'pa-hint';
    thHint.textContent = 'Más alto = menos borde semitransparente (evita el halo gris de los PNG).';
    gPix.appendChild(thHint);
    gPix.appendChild(
      toggleRow('Escala de grises', state.grayscale, (v) => {
        state.grayscale = v;
        regrid();
      }),
    );
    gPix.appendChild(
      toggleRow('Mostrar grilla', state.showGrid, (v) => {
        state.showGrid = v;
        fitCanvas();
        scheduleSave();
      }),
    );

    // --- Fondo ---
    const gBg = group('Fondo');
    gBg.appendChild(
      toggleRow('Quitar fondo (color sólido)', state.removeBg, (v) => {
        state.removeBg = v;
        regrid();
      }),
    );
    const bgRow = document.createElement('div');
    bgRow.className = 'control-row';
    const bgName = document.createElement('span');
    bgName.className = 'control-label';
    const bgText = document.createElement('span');
    bgText.textContent = 'Color de fondo';
    bgName.appendChild(bgText);
    const bgPicker = createColorPicker({
      getColor: () => state.bgColor,
      getAlpha: () => 1,
      hasAlpha: false,
      onChange: (hex) => {
        state.bgColor = hex.toUpperCase();
        if (state.removeBg) regrid();
      },
    });
    pickers.push(bgPicker);
    bgRow.append(bgName, bgPicker.swatch);
    gBg.appendChild(bgRow);
    gBg.appendChild(
      rangeRow('Tolerancia %', Math.round(state.bgTolerance * 100), 0, 100, 1, (v) => {
        state.bgTolerance = v / 100;
        if (state.removeBg) regrid();
      }),
    );
    const cornerBtn = document.createElement('button');
    cornerBtn.type = 'button';
    cornerBtn.textContent = 'Tomar color de la esquina';
    cornerBtn.addEventListener('click', () => {
      if (!state.img) return;
      state.bgColor = cornerColor(state.img);
      state.removeBg = true;
      bgPicker.sync();
      buildControls(); // refleja el toggle activado
      regrid();
    });
    gBg.appendChild(cornerBtn);
    const bgHint = document.createElement('p');
    bgHint.className = 'pa-hint';
    bgHint.textContent =
      'Para imágenes con fondo blanco/plano: evita el borde marrón que aparece al mezclar el dibujo con el fondo.';
    gBg.appendChild(bgHint);

    // --- Paleta ---
    const gPal = group('Paleta');
    const ccCount = loadCCPalette().length;
    const opts = [
      { value: 'original', label: 'Original (sin paleta)' },
      { value: 'cc', label: `Mi paleta del Conversor${ccCount ? ` · ${ccCount} colores` : ' (vacía)'}` },
      ...PALETTES.map((p) => ({ value: p.id, label: p.name })),
      { value: 'custom', label: 'Personalizada' },
    ];
    gPal.appendChild(
      selectRow('Paleta', state.paletteId, opts, (v) => {
        state.paletteId = v;
        // al elegir una paleta, el pincel arranca en su primer color
        const pal = activePalette();
        if (pal && pal.length) state.brush = pal[0];
        buildControls(); // re-render para mostrar/ocultar editor y swatches
        regrid();
      }),
    );

    // swatches = selector de color de pincel (y editor si es personalizada)
    const swatches = document.createElement('div');
    swatches.className = 'pa-swatches';
    gPal.appendChild(swatches);

    const isCustom = state.paletteId === 'custom';
    let customControls: HTMLElement | null = null;
    if (isCustom) {
      customControls = document.createElement('div');
      customControls.className = 'pa-custom-actions';
      const addPicker = createColorPicker({
        getColor: () => state.brush,
        getAlpha: () => 1,
        hasAlpha: false,
        onChange: (hex) => {
          state.brush = hex.toUpperCase();
        },
      });
      addPicker.swatch.title = 'Elegir color a agregar';
      pickers.push(addPicker);
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = '+ Agregar color';
      addBtn.addEventListener('click', () => {
        const hex = state.brush.toUpperCase();
        if (!customPalette.includes(hex)) {
          customPalette.push(hex);
          saveCustom();
          renderBrushes();
          regrid();
        }
      });
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = 'Vaciar';
      clearBtn.addEventListener('click', () => {
        customPalette = [];
        saveCustom();
        renderBrushes();
        regrid();
      });
      customControls.append(addPicker.swatch, addBtn, clearBtn);
      gPal.appendChild(customControls);

      // importar lista de HEX pegada
      const importWrap = document.createElement('div');
      importWrap.className = 'pa-import';
      const ta = document.createElement('textarea');
      ta.placeholder = 'Pegá colores HEX, uno por línea:\n#1ABC9C\n#E74C3C\n…';
      ta.spellcheck = false;
      ta.rows = 4;
      const importRow = document.createElement('div');
      importRow.className = 'pa-custom-actions';
      const importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.textContent = 'Importar lista';
      importBtn.addEventListener('click', () => {
        const parsed = parseHexList(ta.value);
        if (!parsed.length) {
          ta.placeholder = 'No se encontraron HEX válidos (ej. #1ABC9C).';
          return;
        }
        customPalette = parsed;
        saveCustom();
        ta.value = '';
        const pal = activePalette();
        if (pal && pal.length) state.brush = pal[0];
        renderBrushes();
        regrid();
      });
      const fromCCBtn = document.createElement('button');
      fromCCBtn.type = 'button';
      fromCCBtn.textContent = 'Traer del Conversor';
      fromCCBtn.addEventListener('click', () => {
        const cc = loadCCPalette();
        if (!cc.length) return;
        for (const hex of cc) if (!customPalette.includes(hex)) customPalette.push(hex);
        saveCustom();
        renderBrushes();
        regrid();
      });
      importRow.append(importBtn, fromCCBtn);
      importWrap.append(ta, importRow);
      gPal.appendChild(importWrap);
    }

    // --- Pincel ---
    const gBrush = group('Pincel');
    const brushRow = document.createElement('div');
    brushRow.className = 'pa-brush-row';
    const brushPicker = createColorPicker({
      getColor: () => state.brush,
      getAlpha: () => 1,
      hasAlpha: false,
      onChange: (hex) => {
        state.brush = hex.toUpperCase();
        state.erasing = false;
        renderBrushes();
      },
    });
    brushPicker.swatch.title = 'Color del pincel';
    pickers.push(brushPicker);
    const eraser = document.createElement('button');
    eraser.type = 'button';
    eraser.className = 'pa-eraser';
    eraser.textContent = 'Goma';
    eraser.addEventListener('click', () => {
      state.erasing = !state.erasing;
      renderBrushes();
    });
    brushRow.append(brushPicker.swatch, eraser);
    gBrush.appendChild(brushRow);

    gBrush.appendChild(
      rangeRow('Tamaño del pincel', state.brushSize, 1, 12, 1, (v) => {
        state.brushSize = v;
        scheduleSave();
      }),
    );

    const hint = document.createElement('p');
    hint.className = 'pa-hint';
    hint.textContent = 'Hacé clic (o arrastrá) sobre la imagen para pintar celdas.';
    gBrush.appendChild(hint);

    // deshacer / rehacer
    const histRow = document.createElement('div');
    histRow.className = 'pa-brush-row';
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = '↶ Deshacer';
    undoBtn.title = 'Ctrl+Z';
    undoBtn.addEventListener('click', undo);
    const redoBtn = document.createElement('button');
    redoBtn.type = 'button';
    redoBtn.textContent = '↷ Rehacer';
    redoBtn.title = 'Ctrl+Shift+Z';
    redoBtn.addEventListener('click', redo);
    histRow.append(undoBtn, redoBtn);
    gBrush.appendChild(histRow);
    renderHistory = () => {
      undoBtn.disabled = !undoStack.length;
      redoBtn.disabled = !redoStack.length;
    };

    // --- Editar por color (capas) ---
    const gLayers = group('Editar por color');
    const layersInfo = document.createElement('p');
    layersInfo.className = 'pa-hint';
    layersInfo.textContent =
      'Elegí un color para aislarlo: el resto se atenúa y el pincel sólo pinta ese color. Reemplazá/borrá todo de una con los botones.';
    gLayers.appendChild(layersInfo);
    const layersRoot = document.createElement('div');
    layersRoot.className = 'pa-swatches';
    gLayers.appendChild(layersRoot);
    const layerActions = document.createElement('div');
    layerActions.className = 'pa-custom-actions';
    gLayers.appendChild(layerActions);

    renderLayers = () => {
      layersRoot.innerHTML = '';
      layerActions.innerHTML = '';
      if (!state.grid) {
        const n = document.createElement('p');
        n.className = 'pa-hint';
        n.textContent = 'Subí una imagen.';
        layersRoot.appendChild(n);
        return;
      }
      const colors = distinctColors(state.grid);
      // si el color aislado ya no existe (p. ej. tras reemplazarlo), salir del modo capa
      if (state.isolate && !colors.some((c) => c.hex.toUpperCase() === state.isolate!.toUpperCase())) {
        state.isolate = null;
      }
      colors.forEach(({ hex, count }) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'pa-sw';
        sw.style.background = hex;
        sw.title = `${hex} · ${count} celdas`;
        if (state.isolate && state.isolate.toUpperCase() === hex.toUpperCase()) sw.classList.add('is-active');
        sw.addEventListener('click', () => {
          state.isolate =
            state.isolate && state.isolate.toUpperCase() === hex.toUpperCase() ? null : hex;
          paint();
          renderLayers();
        });
        layersRoot.appendChild(sw);
      });

      if (state.isolate) {
        const replaceBtn = document.createElement('button');
        replaceBtn.type = 'button';
        replaceBtn.textContent = 'Reemplazar por el pincel';
        replaceBtn.addEventListener('click', () => {
          const from = state.isolate!;
          beginEdit();
          bulkReplace(from, state.brush);
          state.isolate = state.brush;
          paint();
          renderLayers();
          scheduleSave();
        });
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = 'Borrar este color';
        delBtn.addEventListener('click', () => {
          const from = state.isolate!;
          beginEdit();
          bulkReplace(from, null);
          state.isolate = null;
          paint();
          renderLayers();
          scheduleSave();
        });
        const clearSel = document.createElement('button');
        clearSel.type = 'button';
        clearSel.textContent = 'Quitar selección';
        clearSel.addEventListener('click', () => {
          state.isolate = null;
          paint();
          renderLayers();
        });
        layerActions.append(replaceBtn, delBtn, clearSel);
      }
    };

    // pinta/actualiza el estado visual de los swatches, goma y pickers
    renderBrushes = () => {
      const pal = isCustom ? customPalette : activePalette() ?? [];
      swatches.innerHTML = '';
      if (!pal.length && !isCustom) {
        const note = document.createElement('p');
        note.className = 'pa-hint';
        note.textContent = 'Elegí el color del pincel abajo.';
        swatches.appendChild(note);
      }
      pal.forEach((hex) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'pa-sw';
        sw.style.background = hex;
        sw.title = hex;
        if (!state.erasing && state.brush.toUpperCase() === hex.toUpperCase()) {
          sw.classList.add('is-active');
        }
        sw.addEventListener('click', () => {
          state.brush = hex.toUpperCase();
          state.erasing = false;
          renderBrushes();
        });
        if (isCustom) {
          const del = document.createElement('span');
          del.className = 'pa-sw-del';
          del.textContent = '×';
          del.title = 'Quitar';
          del.addEventListener('click', (ev) => {
            ev.stopPropagation();
            customPalette = customPalette.filter((c) => c !== hex);
            saveCustom();
            renderBrushes();
            regrid();
          });
          sw.appendChild(del);
        }
        swatches.appendChild(sw);
      });
      eraser.classList.toggle('is-active', state.erasing);
      brushPicker.sync();
    };
    renderBrushes();
    renderHistory();
    renderLayers();
    renderZoom();
  }

  function group(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'control-group';
    const h = document.createElement('h2');
    h.textContent = title;
    section.appendChild(h);
    controls.appendChild(section);
    return section;
  }

  // ---- fábricas de filas (reusan las clases del panel existente) ----
  function labelRow(text: string, stack = false): [HTMLElement, HTMLElement] {
    const row = document.createElement('label');
    row.className = stack ? 'control-row control-row--stack' : 'control-row';
    const name = document.createElement('span');
    name.className = 'control-label';
    const t = document.createElement('span');
    t.textContent = text;
    name.appendChild(t);
    row.appendChild(name);
    return [row, name];
  }

  function numberRow(text: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
    const [row] = labelRow(text);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = Math.round(Number(input.value));
      if (!Number.isNaN(v) && v >= min && v <= max) onChange(v);
    });
    row.appendChild(input);
    return row;
  }

  function rangeRow(text: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLElement {
    const [row, name] = labelRow(text, true);
    const badge = document.createElement('span');
    badge.className = 'pa-value';
    badge.textContent = String(value);
    name.appendChild(badge);
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'pa-range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      badge.textContent = String(v);
      onChange(v);
    });
    row.appendChild(input);
    return row;
  }

  function toggleRow(text: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const [row] = labelRow(text);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'toggle-input';
    input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
    row.appendChild(input);
    return row;
  }

  function selectRow(text: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void): HTMLElement {
    const [row] = labelRow(text, true);
    const select = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    }
    select.value = value;
    select.addEventListener('change', () => onChange(select.value));
    row.appendChild(select);
    return row;
  }

  buildControls();

  // ====================== restaurar sesión guardada ======================
  (function restoreSession(): void {
    const session = loadSession();
    if (!session) return;
    const s = session.state;
    const num = (k: string, def: number) => (typeof s[k] === 'number' ? (s[k] as number) : def);
    const bool = (k: string, def: boolean) => (typeof s[k] === 'boolean' ? (s[k] as boolean) : def);
    const str = (k: string, def: string) => (typeof s[k] === 'string' ? (s[k] as string) : def);
    state.cols = num('cols', state.cols);
    state.cellPx = num('cellPx', state.cellPx);
    state.grayscale = bool('grayscale', state.grayscale);
    state.alphaThreshold = num('alphaThreshold', state.alphaThreshold);
    state.removeBg = bool('removeBg', state.removeBg);
    state.bgColor = str('bgColor', state.bgColor);
    state.bgTolerance = num('bgTolerance', state.bgTolerance);
    state.paletteId = str('paletteId', state.paletteId);
    state.brush = str('brush', state.brush);
    state.brushSize = num('brushSize', state.brushSize);
    state.showGrid = bool('showGrid', state.showGrid);

    const finalize = (): void => {
      state.grid = {
        cols: session.grid.cols,
        rows: session.grid.rows,
        cells: session.grid.cells,
      };
      state.isolate = null;
      empty.hidden = true;
      canvasWrap.hidden = false;
      buildControls();
      resetHistory();
      paint();
      fitCanvas();
      updateInfo();
      renderLayers();
    };

    if (session.img) {
      imgDataURL = session.img;
      const img = new Image();
      img.onload = () => {
        state.img = img;
        finalize();
      };
      img.onerror = () => finalize(); // sin imagen: igual mostramos el progreso
      img.src = session.img;
    } else {
      finalize();
    }
  })();

  // ====================== exportación ======================
  function guard(): PixelGrid | null {
    if (!state.grid) {
      alert('Primero subí una imagen.');
      return null;
    }
    return state.grid;
  }

  app.querySelector<HTMLButtonElement>('#export-svg')!.addEventListener('click', () => {
    const g = guard();
    if (!g) return;
    const svg = gridToSVG(g, state.cellPx);
    download(new Blob([svg], { type: 'image/svg+xml' }), 'pixel-art.svg');
  });

  app.querySelector<HTMLButtonElement>('#export-png')!.addEventListener('click', () => {
    const g = guard();
    if (!g) return;
    const a = document.createElement('a');
    a.download = 'pixel-art.png';
    a.href = gridToPNG(g, state.cellPx);
    a.click();
  });

  // ====================== responsive / layout ======================
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

  const onResize = () => fitCanvas();
  window.addEventListener('resize', onResize);

  // Ctrl/⌘ + rueda = zoom; sin modificador el stage hace scroll normal
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey) || !state.grid) return;
    e.preventDefault();
    setZoom(state.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  };
  stage.addEventListener('wheel', onWheel, { passive: false });

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    }
  };
  window.addEventListener('keydown', onKey);

  // cleanup al desmontar la vista
  return () => {
    saveSession(); // flush: asegura guardar lo último antes de salir
    mobileMq.removeEventListener('change', placeExportActions);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    stage.removeEventListener('wheel', onWheel);
    pickers.forEach((p) => p.destroy());
  };

  // ---- persistencia de la paleta personalizada ----
  function saveCustom(): void {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(customPalette));
    } catch {
      /* almacenamiento no disponible */
    }
  }
  function loadCustom(): string[] {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = filename;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
