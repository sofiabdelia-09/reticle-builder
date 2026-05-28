import type { ReticleConfig } from './types.ts';

type Ctrl =
  | { kind: 'toggle'; key: keyof ReticleConfig; label: string }
  | { kind: 'range'; key: keyof ReticleConfig; label: string; min: number; max: number; step?: number }
  | { kind: 'color'; key: keyof ReticleConfig; label: string }
  | { kind: 'select'; key: keyof ReticleConfig; label: string; options: string[] };

interface Group {
  title: string;
  controls: Ctrl[];
}

const GROUPS: Group[] = [
  {
    title: 'Appearance',
    controls: [
      { kind: 'select', key: 'background', label: 'Background', options: ['dark', 'light', 'transparent'] },
      { kind: 'color', key: 'color', label: 'Color' },
      { kind: 'range', key: 'glow', label: 'Glow', min: 0, max: 30 },
    ],
  },
  {
    title: 'Center Dot',
    controls: [
      { kind: 'toggle', key: 'centerDot', label: 'Enabled' },
      { kind: 'range', key: 'centerDotSize', label: 'Size', min: 1, max: 20 },
    ],
  },
  {
    title: 'Crosshair',
    controls: [
      { kind: 'toggle', key: 'crosshair', label: 'Enabled' },
      { kind: 'range', key: 'crosshairThickness', label: 'Thickness', min: 1, max: 12 },
      { kind: 'range', key: 'crosshairLength', label: 'Length', min: 10, max: 380 },
      { kind: 'range', key: 'crosshairGap', label: 'Center gap', min: 0, max: 200 },
    ],
  },
  {
    title: 'Circle',
    controls: [
      { kind: 'toggle', key: 'circle', label: 'Enabled' },
      { kind: 'range', key: 'circleRadius', label: 'Radius', min: 10, max: 390 },
      { kind: 'range', key: 'circleThickness', label: 'Thickness', min: 1, max: 12 },
    ],
  },
  {
    title: 'Ranging Ticks',
    controls: [
      { kind: 'toggle', key: 'ticks', label: 'Enabled' },
      { kind: 'range', key: 'tickCount', label: 'Count', min: 0, max: 12 },
      { kind: 'range', key: 'tickLength', label: 'Width', min: 2, max: 60 },
      { kind: 'range', key: 'tickSpacing', label: 'Spacing', min: 6, max: 80 },
    ],
  },
];

export function buildControls(
  root: HTMLElement,
  cfg: ReticleConfig,
  onChange: () => void,
): () => void {
  const inputs: Array<() => void> = [];
  root.innerHTML = '';

  for (const group of GROUPS) {
    const section = document.createElement('div');
    section.className = 'control-group';
    const h = document.createElement('h2');
    h.textContent = group.title;
    section.appendChild(h);

    for (const ctrl of group.controls) {
      const row = document.createElement('label');
      row.className = 'control-row';
      const name = document.createElement('span');
      name.className = 'control-label';
      name.textContent = ctrl.label;
      row.appendChild(name);

      if (ctrl.kind === 'toggle') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = cfg[ctrl.key] as boolean;
        input.addEventListener('change', () => {
          (cfg[ctrl.key] as boolean) = input.checked;
          onChange();
        });
        inputs.push(() => (input.checked = cfg[ctrl.key] as boolean));
        row.appendChild(input);
      } else if (ctrl.kind === 'range') {
        const valueOut = document.createElement('output');
        valueOut.textContent = String(cfg[ctrl.key]);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(ctrl.min);
        input.max = String(ctrl.max);
        input.step = String(ctrl.step ?? 1);
        input.value = String(cfg[ctrl.key]);
        input.addEventListener('input', () => {
          (cfg[ctrl.key] as number) = Number(input.value);
          valueOut.textContent = input.value;
          onChange();
        });
        inputs.push(() => {
          input.value = String(cfg[ctrl.key]);
          valueOut.textContent = String(cfg[ctrl.key]);
        });
        name.appendChild(valueOut);
        row.appendChild(input);
      } else if (ctrl.kind === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = cfg[ctrl.key] as string;
        input.addEventListener('input', () => {
          (cfg[ctrl.key] as string) = input.value;
          onChange();
        });
        inputs.push(() => (input.value = cfg[ctrl.key] as string));
        row.appendChild(input);
      } else {
        const input = document.createElement('select');
        for (const opt of ctrl.options) {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          input.appendChild(o);
        }
        input.value = cfg[ctrl.key] as string;
        input.addEventListener('change', () => {
          (cfg[ctrl.key] as string) = input.value;
          onChange();
        });
        inputs.push(() => (input.value = cfg[ctrl.key] as string));
        row.appendChild(input);
      }

      section.appendChild(row);
    }
    root.appendChild(section);
  }

  return () => inputs.forEach((sync) => sync());
}
