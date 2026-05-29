interface PickerOpts {
  getColor: () => string; // hex #rrggbb
  getAlpha: () => number; // 0..1
  hasAlpha: boolean;
  onChange: (hex: string, alpha: number) => void;
}

interface Picker {
  swatch: HTMLElement;
  sync: () => void;
}

interface ActivePicker {
  pop: HTMLElement;
  swatch: HTMLElement;
  close: () => void;
}

// Solo un picker abierto a la vez. Un único listener global (permanente)
// cierra el activo al clickear fuera o presionar Escape.
let activePicker: ActivePicker | null = null;
let globalBound = false;

function bindGlobal(): void {
  if (globalBound) return;
  globalBound = true;
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (!activePicker) return;
      const t = ev.target as Node;
      if (activePicker.pop.contains(t) || activePicker.swatch.contains(t)) return;
      activePicker.close();
    },
    true,
  );
  document.addEventListener('keydown', (ev) => {
    if (activePicker && ev.key === 'Escape') activePicker.close();
  });
}

export function createColorPicker(opts: PickerOpts): Picker {
  bindGlobal();
  let h = 0;
  let s = 0;
  let v = 0;
  let a = 1;

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'cp-swatch';
  const swatchFill = document.createElement('span');
  swatchFill.className = 'cp-swatch-fill';
  swatch.appendChild(swatchFill);

  // --- popover (anclado al body para que no lo recorte el panel) ---
  const pop = document.createElement('div');
  pop.className = 'cp-popover';
  pop.hidden = true;

  const sv = document.createElement('div');
  sv.className = 'cp-sv';
  const svHue = document.createElement('div');
  svHue.className = 'cp-sv-hue';
  const svPointer = document.createElement('div');
  svPointer.className = 'cp-sv-pointer';
  sv.append(svHue, svPointer);

  const hueRange = document.createElement('input');
  hueRange.type = 'range';
  hueRange.min = '0';
  hueRange.max = '360';
  hueRange.className = 'cp-hue';

  const alphaWrap = document.createElement('div');
  alphaWrap.className = 'cp-alpha-wrap';
  const alphaRange = document.createElement('input');
  alphaRange.type = 'range';
  alphaRange.min = '0';
  alphaRange.max = '100';
  alphaRange.className = 'cp-alpha';
  alphaWrap.appendChild(alphaRange);

  const footer = document.createElement('div');
  footer.className = 'cp-footer';
  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'cp-hex';
  hexInput.spellcheck = false;
  const alphaOut = document.createElement('span');
  alphaOut.className = 'cp-alpha-out';
  footer.append(hexInput, alphaOut);

  pop.append(sv, hueRange);
  if (opts.hasAlpha) pop.append(alphaWrap);
  pop.append(footer);

  function hex(): string {
    const { r, g, b } = hsvToRgb(h, s, v);
    return rgbToHex(r, g, b);
  }

  function emit(): void {
    opts.onChange(hex(), a);
    paint();
  }

  function paint(): void {
    svHue.style.background =
      `linear-gradient(to top, #000, transparent), ` +
      `linear-gradient(to right, #fff, transparent), ` +
      `hsl(${h}, 100%, 50%)`;
    svPointer.style.left = `${s * 100}%`;
    svPointer.style.top = `${(1 - v) * 100}%`;
    svPointer.style.background = hex();
    hueRange.value = String(Math.round(h));
    alphaRange.value = String(Math.round(a * 100));
    alphaWrap.style.background = `linear-gradient(to right, transparent, ${hex()})`;
    hexInput.value = hex();
    alphaOut.textContent = `${Math.round(a * 100)}%`;
    swatchFill.style.background = hex();
    swatchFill.style.opacity = String(a);
  }

  function loadFromState(): void {
    const { r, g, b } = hexToRgb(opts.getColor());
    const hsv = rgbToHsv(r, g, b);
    h = hsv.h;
    s = hsv.s;
    v = hsv.v;
    a = opts.hasAlpha ? clamp(opts.getAlpha(), 0, 1) : 1;
    paint();
  }

  // SV drag
  function svFromEvent(ev: PointerEvent): void {
    const rect = sv.getBoundingClientRect();
    s = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
    v = clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1);
    emit();
  }
  sv.addEventListener('pointerdown', (ev) => {
    sv.setPointerCapture(ev.pointerId);
    svFromEvent(ev);
  });
  sv.addEventListener('pointermove', (ev) => {
    if (sv.hasPointerCapture(ev.pointerId)) svFromEvent(ev);
  });

  hueRange.addEventListener('input', () => {
    h = Number(hueRange.value);
    emit();
  });
  alphaRange.addEventListener('input', () => {
    a = Number(alphaRange.value) / 100;
    emit();
  });
  hexInput.addEventListener('change', () => {
    if (/^#?[0-9a-fA-F]{6}$/.test(hexInput.value.trim())) {
      const { r, g, b } = hexToRgb(hexInput.value.trim());
      const hsv = rgbToHsv(r, g, b);
      h = hsv.h;
      s = hsv.s;
      v = hsv.v;
      emit();
    } else {
      paint();
    }
  });

  function place(): void {
    const panel = swatch.closest('.controls') as HTMLElement | null;
    const sr = swatch.getBoundingClientRect();
    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;
    let left: number;
    if (panel) {
      const pr = panel.getBoundingClientRect();
      left = pr.left + pr.width / 2 - popW / 2; // centrado al menú
    } else {
      left = sr.left + sr.width / 2 - popW / 2;
    }
    left = clamp(left, 8, window.innerWidth - popW - 8);
    let top = sr.bottom + 8;
    if (top + popH > window.innerHeight - 8) top = Math.max(8, sr.top - popH - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function open(): void {
    if (activePicker && activePicker !== self) activePicker.close();
    loadFromState();
    pop.hidden = false;
    place();
    activePicker = self;
  }
  function close(): void {
    pop.hidden = true;
    if (activePicker === self) activePicker = null;
  }
  const self: ActivePicker = { pop, swatch, close };

  swatch.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (pop.hidden) open();
    else close();
  });

  document.body.appendChild(pop);
  loadFromState();

  return { swatch, sync: loadFromState };
}

// ---------- conversiones ----------
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
