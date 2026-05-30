import { MM_PER_UNIT, PAGE_SIZES_MM, type GridConfig } from './types.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridGeometry {
  pageW: number; // mm
  pageH: number; // mm
  margin: Rect; // área de contenido (dentro de los márgenes), en mm
  modules: Rect[]; // cada módulo columna×fila, en mm
  columnGuides: number[]; // posiciones x de los bordes de columna (mm)
  rowGuides: number[]; // posiciones y de los bordes de fila (mm)
  valid: boolean; // false si los márgenes/medianiles no caben
}

/** Dimensiones de página en mm, ya considerando orientación. */
export function pageDimsMM(cfg: GridConfig): { w: number; h: number } {
  let w: number;
  let h: number;
  if (cfg.pageSize === 'Personalizada') {
    const f = MM_PER_UNIT[cfg.unit];
    w = cfg.customW * f;
    h = cfg.customH * f;
  } else {
    ({ w, h } = PAGE_SIZES_MM[cfg.pageSize]);
  }
  if (cfg.orientation === 'horizontal') {
    return { w: h, h: w };
  }
  return { w, h };
}

export function computeGrid(cfg: GridConfig): GridGeometry {
  const f = MM_PER_UNIT[cfg.unit];
  const { w: pageW, h: pageH } = pageDimsMM(cfg);

  const top = cfg.marginTop * f;
  const bottom = cfg.marginBottom * f;
  const inner = cfg.marginInner * f;
  const outer = cfg.marginOuter * f;
  const gutterCol = cfg.gutterColumn * f;
  const gutterRow = cfg.gutterRow * f;

  // En página derecha el lomo (interno) queda a la izquierda; en izquierda, a la derecha.
  const left = cfg.side === 'derecha' ? inner : outer;
  const right = cfg.side === 'derecha' ? outer : inner;

  const contentX = left;
  const contentY = top;
  const contentW = pageW - left - right;
  const contentH = pageH - top - bottom;

  const cols = Math.max(1, Math.floor(cfg.columns));
  const rows = Math.max(1, Math.floor(cfg.rows));

  const colW = (contentW - (cols - 1) * gutterCol) / cols;
  const rowH = (contentH - (rows - 1) * gutterRow) / rows;

  const valid = contentW > 0 && contentH > 0 && colW > 0 && rowH > 0;

  const modules: Rect[] = [];
  const columnGuides: number[] = [];
  const rowGuides: number[] = [];

  if (valid) {
    for (let c = 0; c < cols; c++) {
      const x = contentX + c * (colW + gutterCol);
      columnGuides.push(x, x + colW);
      for (let r = 0; r < rows; r++) {
        const y = contentY + r * (rowH + gutterRow);
        modules.push({ x, y, w: colW, h: rowH });
      }
    }
    for (let r = 0; r < rows; r++) {
      const y = contentY + r * (rowH + gutterRow);
      rowGuides.push(y, y + rowH);
    }
  }

  return {
    pageW,
    pageH,
    margin: { x: contentX, y: contentY, w: contentW, h: contentH },
    modules,
    columnGuides,
    rowGuides,
    valid,
  };
}

export interface SquareGridGeometry {
  pageW: number;
  pageH: number;
  area: Rect; // zona donde se dibuja la cuadrícula (mm)
  vLines: number[]; // posiciones x de las líneas verticales (mm)
  hLines: number[]; // posiciones y de las líneas horizontales (mm)
  cellW: number; // tamaño de celda en mm
  cellH: number;
  valid: boolean;
}

export function computeSquareGrid(cfg: GridConfig): SquareGridGeometry {
  const f = MM_PER_UNIT[cfg.unit];
  const { w: pageW, h: pageH } = pageDimsMM(cfg);

  const cellW = cfg.cellWidth * f;
  const cellH = cfg.cellHeight * f;

  let areaX = 0;
  let areaY = 0;
  let areaW = pageW;
  let areaH = pageH;

  if (cfg.gridUseMargins) {
    const top = cfg.marginTop * f;
    const bottom = cfg.marginBottom * f;
    const inner = cfg.marginInner * f;
    const outer = cfg.marginOuter * f;
    const left = cfg.side === 'derecha' ? inner : outer;
    const right = cfg.side === 'derecha' ? outer : inner;
    areaX = left;
    areaY = top;
    areaW = pageW - left - right;
    areaH = pageH - top - bottom;
  }

  // tope de seguridad para no generar miles de líneas con celdas diminutas
  const valid =
    cellW > 0 &&
    cellH > 0 &&
    areaW > 0 &&
    areaH > 0 &&
    areaW / cellW <= 2000 &&
    areaH / cellH <= 2000;

  const vLines: number[] = [];
  const hLines: number[] = [];
  if (valid) {
    const eps = 1e-6;
    for (let x = areaX; x <= areaX + areaW + eps; x += cellW) vLines.push(x);
    for (let y = areaY; y <= areaY + areaH + eps; y += cellH) hLines.push(y);
  }

  return {
    pageW,
    pageH,
    area: { x: areaX, y: areaY, w: areaW, h: areaH },
    vLines,
    hLines,
    cellW,
    cellH,
    valid,
  };
}
