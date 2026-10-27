import { hexToRgb, rgbToHex } from './color.ts';

// Una celda es un color HEX o null (transparente). El modelo es una grilla
// row-major de cols*rows celdas: cada celda es un "píxel" y, al exportar, un <rect>.
export type Cell = string | null;

export interface PixelGrid {
  cols: number;
  rows: number;
  cells: Cell[]; // length = cols * rows
}

// distancia euclídea al cuadrado (sin la raíz: sólo se usa para comparar)
function colorDist(r1: number, g1: number, b1: number, c: [number, number, number]): number {
  const dr = r1 - c[0];
  const dg = g1 - c[1];
  const db = b1 - c[2];
  return dr * dr + dg * dg + db * db;
}

function nearest(pal: [number, number, number][], r: number, g: number, b: number): [number, number, number] {
  let best = pal[0];
  let bestD = colorDist(r, g, b, best);
  for (let i = 1; i < pal.length; i++) {
    const d = colorDist(r, g, b, pal[i]);
    if (d <= bestD) {
      best = pal[i];
      bestD = d;
    }
  }
  return best;
}

export interface GridOpts {
  grayscale: boolean;
  palette: string[] | null; // HEX[]; null => sin reducción de color (color promedio del bloque)
  alphaThreshold: number; // 0..1: cobertura mínima de un bloque para contar como píxel
  bg: string | null; // HEX del color de fondo a quitar (null => no quitar nada)
  bgTolerance: number; // 0..1: qué tan parecido a `bg` cuenta como fondo
}

// distancia máxima posible entre dos colores RGB (sqrt(255^2 * 3))
const MAX_RGB_DIST = 441.6729559300637;

// límite del canvas de trabajo: acota memoria/costo del promediado manual
const MAX_WORK_DIM = 1200;

/**
 * Submuestrea una imagen a una grilla de `cols` de ancho (alto por proporción).
 *
 * Promedia cada bloque **ponderando por alfa**: los píxeles transparentes no
 * aportan color, así el contorno de un PNG no se ensucia con gris (el fondo
 * transparente no cuenta). Un bloque con cobertura menor a `alphaThreshold`
 * se vuelve transparente. Luego, opcionalmente, pasa a gris y/o ajusta cada
 * celda al color más cercano de la paleta (misma idea que convertPalette de pixelit).
 */
export function gridFromImage(img: HTMLImageElement, cols: number, opts: GridOpts): PixelGrid {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  // canvas de trabajo a resolución nativa (acotada) para promediar nosotros
  let sw = iw;
  let sh = ih;
  const biggest = Math.max(iw, ih);
  if (biggest > MAX_WORK_DIM) {
    const r = MAX_WORK_DIM / biggest;
    sw = Math.max(1, Math.round(iw * r));
    sh = Math.max(1, Math.round(ih * r));
  }
  const rows = Math.max(1, Math.round(cols * (sh / sw || 1)));

  const tmp = document.createElement('canvas');
  tmp.width = sw;
  tmp.height = sh;
  const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;

  const pal = opts.palette
    ? opts.palette.map((hex) => {
        const { r, g, b } = hexToRgb(hex);
        return [r, g, b] as [number, number, number];
      })
    : null;

  // fondo a quitar: los píxeles dentro de la tolerancia pasan a contar como transparentes
  let bgRgb: [number, number, number] | null = null;
  let bgMaxDist2 = 0;
  if (opts.bg) {
    const { r, g, b } = hexToRgb(opts.bg);
    bgRgb = [r, g, b];
    const maxDist = MAX_RGB_DIST * opts.bgTolerance;
    bgMaxDist2 = maxDist * maxDist;
  }

  const cells: Cell[] = new Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor((cy * sh) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * sh) / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * sw) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * sw) / cols));

      // promedio del bloque ponderado por alfa
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        let p = (y * sw + x0) * 4;
        for (let x = x0; x < x1; x++, p += 4) {
          let a = data[p + 3];
          // tratar los píxeles parecidos al color de fondo como transparentes
          if (bgRgb && a > 0 && colorDist(data[p], data[p + 1], data[p + 2], bgRgb) <= bgMaxDist2) {
            a = 0;
          }
          sumR += data[p] * a;
          sumG += data[p + 1] * a;
          sumB += data[p + 2] * a;
          sumA += a;
          n++;
        }
      }

      const coverage = n ? sumA / (n * 255) : 0;
      if (sumA === 0 || coverage < opts.alphaThreshold) {
        cells[cy * cols + cx] = null; // transparente
        continue;
      }
      let r = Math.round(sumR / sumA);
      let g = Math.round(sumG / sumA);
      let b = Math.round(sumB / sumA);
      if (opts.grayscale) {
        const avg = Math.round((r + g + b) / 3);
        r = g = b = avg;
      }
      if (pal) {
        const c = nearest(pal, r, g, b);
        r = c[0];
        g = c[1];
        b = c[2];
      }
      cells[cy * cols + cx] = rgbToHex(r, g, b).toUpperCase();
    }
  }
  return { cols, rows, cells };
}

/** Color del píxel de la esquina superior izquierda (buen candidato a "fondo"). */
export function cornerColor(img: HTMLImageElement): string {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(d[0], d[1], d[2]).toUpperCase();
}

/** Colores distintos presentes en la grilla, con su cantidad de celdas, de mayor a menor. */
export function distinctColors(grid: PixelGrid): { hex: string; count: number }[] {
  const map = new Map<string, number>();
  for (const c of grid.cells) {
    if (c == null) continue;
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Pinta la grilla 1px por celda en el canvas (que queda en resolución cols×rows).
 * Si `isolate` es un color, atenúa todo salvo las celdas de ese color (modo "capa").
 */
export function drawGrid(canvas: HTMLCanvasElement, grid: PixelGrid, isolate?: string | null): void {
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, grid.cols, grid.rows);
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const c = grid.cells[y * grid.cols + x];
      if (c == null) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (isolate) {
    // velo oscuro sobre todo y luego se repinta el color aislado por encima
    ctx.fillStyle = 'rgba(8, 10, 12, 0.72)';
    ctx.fillRect(0, 0, grid.cols, grid.rows);
    const target = isolate.toUpperCase();
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const c = grid.cells[y * grid.cols + x];
        if (c == null || c.toUpperCase() !== target) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * Genera el SVG a mano: **un <rect> cuadrado de 1×1 por celda** (sin fusionar),
 * incluyendo el fondo (celdas transparentes también son un rect, con fill
 * transparente). El viewBox está en unidades de celda y width/height escalan
 * parejo por `cellPx`, así cada rect queda siempre cuadrado.
 */
export function gridToSVG(grid: PixelGrid, cellPx: number): string {
  const { cols, rows, cells } = grid;
  const w = cols * cellPx;
  const h = rows * cellPx;
  const rects: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = cells[y * cols + x];
      const fill = c ?? 'transparent';
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges">\n` +
    rects.join('\n') +
    `\n</svg>`
  );
}

/** Rasteriza la grilla a PNG con celdas nítidas de `cellPx` px. */
export function gridToPNG(grid: PixelGrid, cellPx: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * cellPx;
  canvas.height = grid.rows * cellPx;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const c = grid.cells[y * grid.cols + x];
      if (c == null) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
    }
  }
  return canvas.toDataURL('image/png');
}
