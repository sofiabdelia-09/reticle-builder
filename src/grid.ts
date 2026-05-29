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
