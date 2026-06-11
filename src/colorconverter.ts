import {
  type RGB,
  type HarmonyType,
  clamp,
  hexToRgb,
  rgbToHex,
  isHex,
  rgbToCmyk,
  cmykToRgb,
  rgbToHsl,
  hslToRgb,
  harmony,
} from './color.ts';
import { buildAseBlob } from './ase.ts';

const PALETTE_KEY = 'dt-palette';

interface Channel {
  key: string;
  label: string;
  max: number;
}

const GROUPS: { id: string; title: string; channels: Channel[] }[] = [
  {
    id: 'rgb',
    title: 'RGB',
    channels: [
      { key: 'r', label: 'R', max: 255 },
      { key: 'g', label: 'G', max: 255 },
      { key: 'b', label: 'B', max: 255 },
    ],
  },
  {
    id: 'cmyk',
    title: 'CMYK',
    channels: [
      { key: 'c', label: 'C', max: 100 },
      { key: 'm', label: 'M', max: 100 },
      { key: 'y', label: 'Y', max: 100 },
      { key: 'k', label: 'K', max: 100 },
    ],
  },
  {
    id: 'hsl',
    title: 'HSL',
    channels: [
      { key: 'h', label: 'H', max: 360 },
      { key: 's', label: 'S', max: 100 },
      { key: 'l', label: 'L', max: 100 },
    ],
  },
];

export function mountColorConverter(app: HTMLElement): () => void {
  app.innerHTML = `
    <div class="tool-color">
      <header class="topbar">
        <div class="topbar-left">
          <a class="back-link" href="#/">← Inicio</a>
          <h1>Conversor de Color</h1>
        </div>
      </header>
      <div class="cc-body">
        <div class="cc-top">
          <div class="cc-preview" id="cc-preview"></div>
          <div class="cc-fields">
            <div class="cc-group">
              <h2>HEX</h2>
              <div class="cc-hex-row">
                <input id="cc-hex" class="cc-hex" type="text" spellcheck="false" maxlength="7" />
                <button id="cc-copy" type="button" class="cc-copy">Copiar</button>
              </div>
            </div>
            <div id="cc-groups"></div>
          </div>
        </div>
        <div class="cc-bars" id="cc-bars"></div>

        <div class="cc-section">
          <div class="cc-section-head"><h2>Armonías</h2></div>
          <div id="cc-harmonies"></div>
        </div>

        <div class="cc-section">
          <div class="cc-section-head">
            <h2>Mi paleta</h2>
            <button id="cc-add" class="cc-add" type="button">+ Agregar color</button>
          </div>
          <div class="cc-swatches cc-palette" id="cc-palette"></div>
          <div class="cc-export">
            <button data-exp="hex" type="button">Copiar HEX</button>
            <button data-exp="css" type="button">CSS</button>
            <button data-exp="json" type="button">JSON</button>
            <span class="cc-tipwrap">
              <button data-exp="ase" type="button">.ase (Adobe)</button>
              <span class="cc-tip cc-tip-wide"><strong>Illustrator:</strong> "Ventana" → "Muestras", menú del panel (☰) → "Añadir biblioteca de muestras" → "Otra biblioteca".<br><br><strong>Photoshop:</strong> "Ventana" → "Muestras", menú del panel (☰) → "Importar muestras" y seleccioná el archivo.</span>
            </span>
          </div>
        </div>
      </div>
    </div>`;

  const preview = app.querySelector<HTMLElement>('#cc-preview')!;
  const hexInput = app.querySelector<HTMLInputElement>('#cc-hex')!;
  const copyBtn = app.querySelector<HTMLButtonElement>('#cc-copy')!;
  const groupsRoot = app.querySelector<HTMLElement>('#cc-groups')!;
  const barsRoot = app.querySelector<HTMLElement>('#cc-bars')!;
  const scroller = app.querySelector<HTMLElement>('.cc-body')!;

  const inputs: Record<string, HTMLInputElement> = {};

  for (const group of GROUPS) {
    const section = document.createElement('div');
    section.className = 'cc-group';

    const head = document.createElement('div');
    head.className = 'cc-group-head';
    const h = document.createElement('h2');
    h.textContent = group.title;
    head.appendChild(h);

    if (group.id === 'cmyk') {
      const info = document.createElement('span');
      info.className = 'cc-info';
      info.tabIndex = 0;
      info.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/></svg>
        <span class="cc-tip">CMYK es una conversión matemática (sin perfil ICC); úsalo como referencia.</span>`;
      head.appendChild(info);
    }
    section.appendChild(head);

    const ccRow = document.createElement('div');
    ccRow.className = 'cc-row';
    const row = document.createElement('div');
    row.className = 'cc-channels';
    for (const ch of group.channels) {
      const field = document.createElement('label');
      field.className = 'cc-field';
      const lab = document.createElement('span');
      lab.textContent = ch.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(ch.max);
      input.addEventListener('input', () => onGroupInput(group.id));
      inputs[ch.key] = input;
      field.append(lab, input);
      row.appendChild(field);
    }

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'cc-copy';
    copy.textContent = 'Copiar';
    copy.addEventListener('click', () => copyToButton(formatGroup(group.id), copy));

    ccRow.append(row, copy);
    section.appendChild(ccRow);
    groupsRoot.appendChild(section);
  }

  let rgb: RGB = { r: 26, g: 188, b: 156 };

  // barras de selección de color (HSL): juntas cubren todo el espacio
  const BARS = [
    { key: 'h', label: 'Tono', max: 360 },
    { key: 's', label: 'Saturación', max: 100 },
    { key: 'l', label: 'Luminosidad', max: 100 },
  ] as const;
  const bars: Record<string, HTMLInputElement> = {};

  for (const bar of BARS) {
    const row = document.createElement('div');
    row.className = 'cc-bar';
    const lab = document.createElement('span');
    lab.className = 'cc-bar-label';
    lab.textContent = bar.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'cc-colorbar';
    input.min = '0';
    input.max = String(bar.max);
    input.addEventListener('input', () => setHsl(bar.key, Number(input.value)));
    bars[bar.key] = input;
    row.append(lab, input);
    barsRoot.appendChild(row);
  }

  function setHsl(key: string, value: number): void {
    const c = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const h = key === 'h' ? value : Math.round(c.h);
    const s = key === 's' ? value : Math.round(c.s);
    const l = key === 'l' ? value : Math.round(c.l);
    rgb = hslToRgb(h, s, l);
    renderAll();
  }

  const val = (key: string) => (inputs[key].value === '' ? 0 : Number(inputs[key].value));

  function onGroupInput(id: string): void {
    if (id === 'rgb') {
      rgb = {
        r: clamp(Math.round(val('r')), 0, 255),
        g: clamp(Math.round(val('g')), 0, 255),
        b: clamp(Math.round(val('b')), 0, 255),
      };
    } else if (id === 'cmyk') {
      rgb = cmykToRgb(val('c'), val('m'), val('y'), val('k'));
    } else if (id === 'hsl') {
      rgb = hslToRgb(val('h'), val('s'), val('l'));
    }
    renderAll(id);
  }

  hexInput.addEventListener('input', () => {
    if (isHex(hexInput.value)) {
      rgb = hexToRgb(hexInput.value);
      renderAll('hex');
    }
  });

  copyBtn.addEventListener('click', () =>
    copyToButton(rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase(), copyBtn),
  );

  function formatGroup(id: string): string {
    if (id === 'rgb') return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    if (id === 'cmyk') {
      const c = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      return `cmyk(${Math.round(c.c)}%, ${Math.round(c.m)}%, ${Math.round(c.y)}%, ${Math.round(c.k)}%)`;
    }
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
  }

  function setIfIdle(key: string, value: number): void {
    const el = inputs[key];
    if (document.activeElement !== el) el.value = String(value);
  }

  function loadColor(hex: string): void {
    rgb = hexToRgb(hex);
    renderAll();
  }

  // ---- Armonías (todas visibles) ----
  const HARMONIES: { type: HarmonyType; label: string }[] = [
    { type: 'complementario', label: 'Complementario' },
    { type: 'analogo', label: 'Análogo' },
    { type: 'triada', label: 'Tríada' },
    { type: 'split', label: 'Split-complementario' },
    { type: 'tetrada', label: 'Tétrada' },
    { type: 'mono', label: 'Monocromático' },
  ];
  const harmoniesRoot = app.querySelector<HTMLElement>('#cc-harmonies')!;

  function renderHarmony(): void {
    harmoniesRoot.innerHTML = '';
    for (const harm of HARMONIES) {
      const colors = harmony(rgb, harm.type);

      const block = document.createElement('div');
      block.className = 'cc-harmony';

      const head = document.createElement('div');
      head.className = 'cc-harmony-head';
      const label = document.createElement('span');
      label.className = 'cc-harmony-label';
      label.textContent = harm.label;
      const addAll = document.createElement('button');
      addAll.type = 'button';
      addAll.className = 'cc-add-all';
      addAll.textContent = '+ Agregar todas';
      addAll.addEventListener('click', () => {
        for (const c of colors) if (!palette.includes(c)) palette.push(c);
        savePalette();
        renderPalette();
      });
      head.append(label, addAll);

      const sw = document.createElement('div');
      sw.className = 'cc-swatches';
      for (const hex of colors) sw.appendChild(makeSwatch(hex, () => loadColor(hex)));

      block.append(head, sw);
      harmoniesRoot.appendChild(block);
    }
  }

  // ---- Mi paleta (persistida en localStorage) ----
  const paletteRoot = app.querySelector<HTMLElement>('#cc-palette')!;
  let palette: string[] = loadPalette();

  app.querySelector<HTMLButtonElement>('#cc-add')!.addEventListener('click', () => {
    palette.push(rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase());
    savePalette();
    renderPalette();
  });

  app.querySelectorAll<HTMLButtonElement>('.cc-export button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!palette.length) return;
      const exp = btn.dataset.exp;
      if (exp === 'ase') {
        downloadBlob(buildAseBlob(palette), 'paleta.ase');
        return;
      }
      let text = '';
      if (exp === 'hex') text = palette.join('\n');
      else if (exp === 'css') text = `:root {\n${palette.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`;
      else text = JSON.stringify(palette, null, 2);
      copyToButton(text, btn);
    });
  });

  function makeSwatch(hex: string, onClick: () => void): HTMLElement {
    const sw = document.createElement('div');
    sw.className = 'cc-sw';
    sw.title = hex;
    sw.tabIndex = 0;
    const color = document.createElement('div');
    color.className = 'cc-sw-color';
    color.style.background = hex;
    const label = document.createElement('span');
    label.className = 'cc-sw-hex';
    label.textContent = hex;
    sw.append(color, label);
    sw.addEventListener('click', onClick);
    sw.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        onClick();
      }
    });
    return sw;
  }

  function renderPalette(): void {
    paletteRoot.innerHTML = '';
    if (!palette.length) {
      const empty = document.createElement('p');
      empty.className = 'cc-empty';
      empty.textContent = 'Agregá colores con “+ Agregar color”.';
      paletteRoot.appendChild(empty);
      return;
    }
    palette.forEach((hex, i) => {
      const sw = makeSwatch(hex, () => loadColor(hex));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'cc-sw-del';
      del.textContent = '×';
      del.title = 'Eliminar';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        palette.splice(i, 1);
        savePalette();
        renderPalette();
      });
      sw.appendChild(del);
      paletteRoot.appendChild(sw);
    });
  }

  function savePalette(): void {
    try {
      localStorage.setItem(PALETTE_KEY, JSON.stringify(palette));
    } catch {
      /* almacenamiento no disponible */
    }
  }
  function loadPalette(): string[] {
    try {
      const raw = localStorage.getItem(PALETTE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  renderPalette();

  // skipGroup: grupo que el usuario está editando; sus inputs NO se reescriben
  // (CMYK↔RGB no es inyectivo, así que re-derivar pisaría lo que se está tipeando).
  function renderAll(skipGroup?: string): void {
    const savedScroll = scroller.scrollTop; // preservar scroll (renderHarmony reconstruye el DOM)
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase();
    preview.style.background = hex;
    if (skipGroup !== 'hex' && document.activeElement !== hexInput) hexInput.value = hex;

    if (skipGroup !== 'rgb') {
      setIfIdle('r', rgb.r);
      setIfIdle('g', rgb.g);
      setIfIdle('b', rgb.b);
    }

    if (skipGroup !== 'cmyk') {
      const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      setIfIdle('c', Math.round(cmyk.c));
      setIfIdle('m', Math.round(cmyk.m));
      setIfIdle('y', Math.round(cmyk.y));
      setIfIdle('k', Math.round(cmyk.k));
    }

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const h = Math.round(hsl.h);
    const s = Math.round(hsl.s);
    const l = Math.round(hsl.l);
    if (skipGroup !== 'hsl') {
      setIfIdle('h', h);
      setIfIdle('s', s);
      setIfIdle('l', l);
    }

    // barras: valor + gradiente en vivo según el color actual
    if (document.activeElement !== bars.h) bars.h.value = String(h);
    if (document.activeElement !== bars.s) bars.s.value = String(s);
    if (document.activeElement !== bars.l) bars.l.value = String(l);
    bars.h.style.background =
      `linear-gradient(90deg, hsl(0 ${s}% ${l}%), hsl(60 ${s}% ${l}%), hsl(120 ${s}% ${l}%), hsl(180 ${s}% ${l}%), hsl(240 ${s}% ${l}%), hsl(300 ${s}% ${l}%), hsl(360 ${s}% ${l}%))`;
    bars.s.style.background = `linear-gradient(90deg, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`;
    bars.l.style.background = `linear-gradient(90deg, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))`;

    renderHarmony();
    scroller.scrollTop = savedScroll; // restaurar scroll tras reconstruir armonías
  }

  renderAll();
  return () => {};
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = filename;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToButton(text: string, btn: HTMLButtonElement): Promise<void> {
  const prev = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '¡Copiado!';
    btn.classList.add('copied');
    window.setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1200);
  } catch {
    /* clipboard no disponible */
  }
}
