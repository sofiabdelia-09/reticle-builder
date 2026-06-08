export interface RGB {
  r: number; // 0..255
  g: number;
  b: number;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function hexToRgb(hex: string): RGB {
  const m = hex.replace('#', '').trim();
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function isHex(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

// ---------- CMYK (conversión matemática, sin perfil ICC) ----------
export interface CMYK {
  c: number; // 0..100
  m: number;
  y: number;
  k: number;
}

export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);
  return { c: c * 100, m: m * 100, y: y * 100, k: k * 100 };
}

export function cmykToRgb(c: number, m: number, y: number, k: number): RGB {
  const cc = c / 100;
  const mm = m / 100;
  const yy = y / 100;
  const kk = k / 100;
  return {
    r: clamp(Math.round(255 * (1 - cc) * (1 - kk)), 0, 255),
    g: clamp(Math.round(255 * (1 - mm) * (1 - kk)), 0, 255),
    b: clamp(Math.round(255 * (1 - yy) * (1 - kk)), 0, 255),
  };
}

// ---------- HSL ----------
export interface HSL {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

// ---------- Armonías ----------
export type HarmonyType =
  | 'complementario'
  | 'analogo'
  | 'triada'
  | 'split'
  | 'tetrada'
  | 'mono';

export function harmony(rgb: RGB, type: HarmonyType): string[] {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const mk = (hue: number, sat = s, lig = l) => {
    const c = hslToRgb(((hue % 360) + 360) % 360, sat, lig);
    return rgbToHex(c.r, c.g, c.b).toUpperCase();
  };
  switch (type) {
    case 'complementario':
      return [mk(h), mk(h + 180)];
    case 'analogo':
      return [mk(h - 30), mk(h), mk(h + 30)];
    case 'triada':
      return [mk(h), mk(h + 120), mk(h + 240)];
    case 'split':
      return [mk(h), mk(h + 150), mk(h + 210)];
    case 'tetrada':
      return [mk(h), mk(h + 90), mk(h + 180), mk(h + 270)];
    case 'mono':
      return [
        mk(h, s, clamp(l - 30, 8, 95)),
        mk(h, s, clamp(l - 15, 8, 95)),
        mk(h, s, l),
        mk(h, s, clamp(l + 15, 8, 95)),
        mk(h, s, clamp(l + 30, 8, 95)),
      ];
  }
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: clamp(Math.round((r + mm) * 255), 0, 255),
    g: clamp(Math.round((g + mm) * 255), 0, 255),
    b: clamp(Math.round((b + mm) * 255), 0, 255),
  };
}
