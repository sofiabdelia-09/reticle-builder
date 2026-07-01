import { computeGrid, computeSquareGrid } from './grid.ts';
import { pageDimsMM } from './grid.ts';
import { MM_PER_UNIT, type GridConfig } from './types.ts';

const COLOR_PAGE = '#ffffff';
const COLOR_PAGE_BORDER = '#c9ced6';

interface BuildOpts {
  absolute?: boolean; // agrega width/height (para exportar a tamaño real en la unidad de trabajo)
}

export function buildSVG(cfg: GridConfig, opts: BuildOpts = {}): string {
  const { w: pageW, h: pageH } = pageDimsMM(cfg);

  // El SVG se emite en el sistema de coordenadas de la unidad de trabajo:
  // así, en px, todo queda en px (sin mm que un editor pueda reinterpretar a otro dpi).
  const f = MM_PER_UNIT[cfg.unit];
  const vbW = pageW / f;
  const vbH = pageH / f;

  // grosor de línea relativo al tamaño de página para que se vea consistente
  const stroke = Math.max(pageW, pageH) / 800;

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(vbW)} ${round(vbH)}"` +
      (opts.absolute ? ` width="${round(vbW)}${cfg.unit}" height="${round(vbH)}${cfg.unit}"` : '') +
      ` preserveAspectRatio="xMidYMid meet">`,
  );

  // el contenido se dibuja en mm; este grupo lo lleva a la unidad de trabajo
  parts.push(`<g transform="scale(${1 / f})">`);

  // hoja: relleno opcional + contorno siempre visible (= tamaño de página)
  parts.push(
    `<rect x="0" y="0" width="${round(pageW)}" height="${round(pageH)}" fill="${cfg.pageFill ? COLOR_PAGE : 'none'}" stroke="${COLOR_PAGE_BORDER}" stroke-width="${round(stroke)}"/>`,
  );

  if (cfg.gridType === 'cuadricula') {
    drawSquare(parts, cfg, stroke, pageW, pageH);
    parts.push('</g></svg>');
    return parts.join('');
  }

  const g = computeGrid(cfg);
  if (g.valid) {
    // módulos (columnas × filas)
    if (cfg.showModules) {
      for (const m of g.modules) {
        parts.push(
          `<rect x="${round(m.x)}" y="${round(m.y)}" width="${round(m.w)}" height="${round(m.h)}" fill="${cfg.moduleColor}" fill-opacity="${cfg.moduleOpacity}" stroke="${cfg.moduleColor}" stroke-opacity="${Math.min(1, cfg.moduleOpacity + 0.35)}" stroke-width="${round(stroke * 0.6)}"/>`,
        );
      }
    }

    // líneas guía de columnas y filas, extendidas por toda la hoja
    if (cfg.showLines) {
      for (const gx of g.columnGuides) {
        parts.push(
          `<line x1="${round(gx)}" y1="0" x2="${round(gx)}" y2="${round(pageH)}" stroke="${cfg.lineColor}" stroke-opacity="${cfg.lineOpacity}" stroke-width="${round(stroke)}"/>`,
        );
      }
      for (const gy of g.rowGuides) {
        parts.push(
          `<line x1="0" y1="${round(gy)}" x2="${round(pageW)}" y2="${round(gy)}" stroke="${cfg.lineColor}" stroke-opacity="${cfg.lineOpacity}" stroke-width="${round(stroke)}"/>`,
        );
      }
    }

    // línea del margen (contorno del área de contenido)
    if (cfg.showMargin) {
      const { x, y, w, h } = g.margin;
      parts.push(
        `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="none" stroke="${cfg.marginColor}" stroke-opacity="${cfg.marginOpacity}" stroke-width="${round(stroke)}"/>`,
      );
    }
  } else {
    parts.push(
      `<text x="${round(pageW / 2)}" y="${round(pageH / 2)}" font-family="sans-serif" font-size="${round(Math.min(pageW, pageH) / 18)}" fill="#e5006d" text-anchor="middle">Márgenes/medianil demasiado grandes</text>`,
    );
  }

  parts.push('</g></svg>');
  return parts.join('');
}

function drawSquare(
  parts: string[],
  cfg: GridConfig,
  stroke: number,
  pageW: number,
  pageH: number,
): void {
  const sg = computeSquareGrid(cfg);
  if (!sg.valid) {
    parts.push(
      `<text x="${round(pageW / 2)}" y="${round(pageH / 2)}" font-family="sans-serif" font-size="${round(Math.min(pageW, pageH) / 18)}" fill="#e5006d" text-anchor="middle">Tamaño de celda inválido</text>`,
    );
    return;
  }

  const { x, y, w, h } = sg.area;
  // líneas verticales y horizontales de la cuadrícula, recortadas al área
  for (const vx of sg.vLines) {
    parts.push(
      `<line x1="${round(vx)}" y1="${round(y)}" x2="${round(vx)}" y2="${round(y + h)}" stroke="${cfg.lineColor}" stroke-opacity="${cfg.lineOpacity}" stroke-width="${round(stroke)}"/>`,
    );
  }
  for (const hy of sg.hLines) {
    parts.push(
      `<line x1="${round(x)}" y1="${round(hy)}" x2="${round(x + w)}" y2="${round(hy)}" stroke="${cfg.lineColor}" stroke-opacity="${cfg.lineOpacity}" stroke-width="${round(stroke)}"/>`,
    );
  }

  // contorno del área (margen) solo cuando la cuadrícula respeta los márgenes
  if (cfg.showMargin && cfg.gridUseMargins) {
    parts.push(
      `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="none" stroke="${cfg.marginColor}" stroke-opacity="${cfg.marginOpacity}" stroke-width="${round(stroke)}"/>`,
    );
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
