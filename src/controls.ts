import type { GridConfig, PageSizeId, Unit } from './types.ts';
import { createColorPicker } from './colorpicker.ts';

type Option = { value: string; label: string };

type FieldBase = {
  key: keyof GridConfig;
  label: string;
  showWhen?: (cfg: GridConfig) => boolean;
};

type Field = FieldBase &
  (
    | {
        kind: 'number';
        min?: number;
        step?: number;
        measure?: boolean; // true => se muestra el sufijo de unidad
      }
    | {
        kind: 'select';
        options: Option[];
      }
    | {
        kind: 'toggle';
      }
    | {
        kind: 'color';
        opacityKey?: keyof GridConfig;
      }
  );

interface Group {
  title: string;
  fields: Field[];
  disableWhen?: (cfg: GridConfig) => boolean;
}

const PAGE_OPTIONS: Option[] = (
  ['A2', 'A3', 'A4', 'A5', 'A6', 'Carta', 'Legal', 'Tabloide', 'Personalizada'] as PageSizeId[]
).map((v) => ({ value: v, label: v }));

const UNIT_OPTIONS: Option[] = (['mm', 'cm', 'px', 'pt', 'in'] as Unit[]).map((v) => ({
  value: v,
  label: v,
}));

const isCustom = (cfg: GridConfig) => cfg.pageSize === 'Personalizada';
const isModular = (cfg: GridConfig) => cfg.gridType === 'modular';
const isSquare = (cfg: GridConfig) => cfg.gridType === 'cuadricula';
// los márgenes no aplican en una cuadrícula que no los usa
const marginsDisabled = (cfg: GridConfig) => cfg.gridType === 'cuadricula' && !cfg.gridUseMargins;

const GROUPS: Group[] = [
  {
    title: 'Documento',
    fields: [
      { kind: 'select', key: 'unit', label: 'Unidad', options: UNIT_OPTIONS },
      { kind: 'select', key: 'pageSize', label: 'Tamaño', options: PAGE_OPTIONS },
      { kind: 'number', key: 'customW', label: 'Ancho', min: 1, measure: true, showWhen: isCustom },
      { kind: 'number', key: 'customH', label: 'Alto', min: 1, measure: true, showWhen: isCustom },
      {
        kind: 'select',
        key: 'orientation',
        label: 'Orientación',
        options: [
          { value: 'vertical', label: 'Vertical' },
          { value: 'horizontal', label: 'Horizontal' },
        ],
      },
      {
        kind: 'select',
        key: 'side',
        label: 'Lado de página',
        options: [
          { value: 'derecha', label: 'Derecha (lomo izq.)' },
          { value: 'izquierda', label: 'Izquierda (lomo der.)' },
        ],
      },
    ],
  },
  {
    title: 'Grilla',
    fields: [
      {
        kind: 'select',
        key: 'gridType',
        label: 'Tipo',
        options: [
          { value: 'modular', label: 'Modular / Columnas' },
          { value: 'cuadricula', label: 'Cuadrícula' },
        ],
      },
      { kind: 'number', key: 'columns', label: 'Columnas', min: 1, step: 1, showWhen: isModular },
      { kind: 'number', key: 'rows', label: 'Filas', min: 1, step: 1, showWhen: isModular },
      { kind: 'number', key: 'gutterColumn', label: 'Medianil columnas', min: 0, measure: true, showWhen: isModular },
      { kind: 'number', key: 'gutterRow', label: 'Medianil filas', min: 0, measure: true, showWhen: isModular },
      { kind: 'number', key: 'cellWidth', label: 'Ancho de celda', min: 1, measure: true, showWhen: isSquare },
      { kind: 'number', key: 'cellHeight', label: 'Alto de celda', min: 1, measure: true, showWhen: isSquare },
      { kind: 'toggle', key: 'gridUseMargins', label: 'Usar márgenes', showWhen: isSquare },
    ],
  },
  {
    title: 'Márgenes',
    disableWhen: marginsDisabled,
    fields: [
      { kind: 'number', key: 'marginTop', label: 'Superior', min: 0, measure: true },
      { kind: 'number', key: 'marginBottom', label: 'Inferior', min: 0, measure: true },
      { kind: 'number', key: 'marginInner', label: 'Interno', min: 0, measure: true },
      { kind: 'number', key: 'marginOuter', label: 'Externo', min: 0, measure: true },
    ],
  },
  {
    title: 'Visualización',
    fields: [
      { kind: 'toggle', key: 'pageFill', label: 'Fondo de hoja' },
      { kind: 'toggle', key: 'showModules', label: 'Módulos', showWhen: isModular },
      { kind: 'toggle', key: 'showLines', label: 'Líneas', showWhen: isModular },
      { kind: 'toggle', key: 'showMargin', label: 'Margen' },
    ],
  },
  {
    title: 'Colores',
    fields: [
      { kind: 'color', key: 'moduleColor', label: 'Módulos', opacityKey: 'moduleOpacity' },
      { kind: 'color', key: 'lineColor', label: 'Líneas', opacityKey: 'lineOpacity' },
      { kind: 'color', key: 'marginColor', label: 'Margen', opacityKey: 'marginOpacity' },
    ],
  },
];

/**
 * Construye el panel. onChange recibe la key que cambió para que el caller
 * pueda reaccionar a casos especiales (p. ej. conversión al cambiar de unidad).
 * Devuelve sync() para reflejar el estado actual en los inputs.
 */
export function buildControls(
  root: HTMLElement,
  cfg: GridConfig,
  onChange: (changed: keyof GridConfig) => void,
): () => void {
  root.innerHTML = '';
  const syncers: Array<() => void> = [];

  for (const group of GROUPS) {
    const section = document.createElement('div');
    section.className = 'control-group';
    const h = document.createElement('h2');
    h.textContent = group.title;
    section.appendChild(h);

    if (group.disableWhen) {
      const cond = group.disableWhen;
      syncers.push(() => section.classList.toggle('is-disabled', cond(cfg)));
    }

    for (const field of group.fields) {
      // las filas de color usan <div>: un <label> reenvía clicks al botón del
      // swatch y descontrola la apertura/cierre del picker.
      const row = document.createElement(field.kind === 'color' ? 'div' : 'label');
      row.className = 'control-row';

      const name = document.createElement('span');
      name.className = 'control-label';
      const nameText = document.createElement('span');
      nameText.textContent = field.label;
      name.appendChild(nameText);

      if (field.kind === 'number') {
        const suffix = document.createElement('span');
        suffix.className = 'unit-suffix';
        if (field.measure) name.appendChild(suffix);

        const input = document.createElement('input');
        input.type = 'number';
        if (field.min !== undefined) input.min = String(field.min);
        input.value = String(cfg[field.key]);
        input.addEventListener('input', () => {
          const v = input.value === '' ? 0 : Number(input.value);
          if (!Number.isNaN(v)) {
            (cfg[field.key] as number) = v;
            onChange(field.key);
          }
        });

        syncers.push(() => {
          input.step = field.step !== undefined ? String(field.step) : stepFor(cfg.unit);
          if (field.measure) suffix.textContent = cfg.unit;
          if (document.activeElement !== input) input.value = String(round(cfg[field.key] as number));
        });

        row.append(name, input);
      } else if (field.kind === 'toggle') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'toggle-input';
        input.checked = cfg[field.key] as boolean;
        input.addEventListener('change', () => {
          (cfg[field.key] as boolean) = input.checked;
          onChange(field.key);
        });
        syncers.push(() => (input.checked = cfg[field.key] as boolean));
        row.append(name, input);
      } else if (field.kind === 'color') {
        const opacityKey = field.opacityKey;
        const picker = createColorPicker({
          getColor: () => cfg[field.key] as string,
          getAlpha: () => (opacityKey ? (cfg[opacityKey] as number) : 1),
          hasAlpha: !!opacityKey,
          onChange: (hex, alpha) => {
            (cfg[field.key] as string) = hex;
            if (opacityKey) (cfg[opacityKey] as number) = alpha;
            onChange(field.key);
          },
        });
        syncers.push(picker.sync);
        row.append(name, picker.swatch);
      } else {
        row.className = 'control-row control-row--stack';
        const select = document.createElement('select');
        for (const opt of field.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          select.appendChild(o);
        }
        select.value = String(cfg[field.key]);
        select.addEventListener('change', () => {
          (cfg[field.key] as string) = select.value;
          onChange(field.key);
        });
        syncers.push(() => (select.value = String(cfg[field.key])));
        row.append(name, select);
      }

      // visibilidad condicional (aplica a cualquier tipo de campo)
      if (field.showWhen) {
        const cond = field.showWhen;
        syncers.push(() => {
          row.style.display = cond(cfg) ? '' : 'none';
        });
      }

      section.appendChild(row);
    }
    root.appendChild(section);
  }

  const sync = () => syncers.forEach((s) => s());
  sync();
  return sync;
}

function stepFor(unit: Unit): string {
  if (unit === 'cm' || unit === 'in') return '0.1';
  return '1';
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
