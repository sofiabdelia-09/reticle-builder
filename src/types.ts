export type Unit = 'mm' | 'cm' | 'px' | 'pt' | 'in';
export type PageSizeId =
  | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'
  | 'Carta' | 'Legal' | 'Tabloide' | 'Personalizada';
export type Orientation = 'vertical' | 'horizontal';
export type PageSide = 'derecha' | 'izquierda';

export interface GridConfig {
  unit: Unit;
  pageSize: PageSizeId;
  orientation: Orientation;
  customW: number; // en la unidad de trabajo
  customH: number;

  side: PageSide; // de qué lado queda el margen interno (lomo)

  columns: number;
  rows: number;
  gutterColumn: number; // medianil entre columnas, en la unidad de trabajo
  gutterRow: number; // medianil entre filas, en la unidad de trabajo

  marginTop: number;
  marginBottom: number;
  marginInner: number; // interno (lomo)
  marginOuter: number; // externo

  // capas de visualización
  pageFill: boolean; // fondo blanco de la hoja (off = transparente)
  showModules: boolean; // módulos rellenos
  showLines: boolean; // líneas guía de columnas/filas
  showMargin: boolean; // zona de margen coloreada

  moduleColor: string;
  moduleOpacity: number; // 0..1
  lineColor: string;
  lineOpacity: number;
  marginColor: string;
  marginOpacity: number;
}

// milímetros por unidad (px y pt asumen 96 / 72 dpi)
export const MM_PER_UNIT: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  px: 25.4 / 96,
};

// tamaños en mm, en orientación vertical (portrait)
export const PAGE_SIZES_MM: Record<Exclude<PageSizeId, 'Personalizada'>, { w: number; h: number }> = {
  A2: { w: 420, h: 594 },
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A6: { w: 105, h: 148 },
  Carta: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
  Tabloide: { w: 279.4, h: 431.8 },
};

export const DEFAULT_CONFIG: GridConfig = {
  unit: 'mm',
  pageSize: 'A4',
  orientation: 'vertical',
  customW: 210,
  customH: 297,

  side: 'derecha',

  columns: 12,
  rows: 1,
  gutterColumn: 5,
  gutterRow: 5,

  marginTop: 20,
  marginBottom: 20,
  marginInner: 20,
  marginOuter: 15,

  pageFill: true,
  showModules: true,
  showLines: false,
  showMargin: true,

  moduleColor: '#007aff',
  moduleOpacity: 0.25,
  lineColor: '#00b3c4',
  lineOpacity: 1,
  marginColor: '#e5006d',
  marginOpacity: 1,
};
