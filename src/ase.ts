import { hexToRgb } from './color.ts';

/**
 * Genera un archivo .ase (Adobe Swatch Exchange) a partir de colores HEX.
 * Formato binario big-endian: cabecera "ASEF" + bloques de color RGB.
 * Lo importan Illustrator, Photoshop e InDesign; desde ahí va a CC Libraries.
 */
export function buildAseBlob(hexColors: string[]): Blob {
  const colors = hexColors.map((hex) => {
    const name = hex.toUpperCase();
    const { r, g, b } = hexToRgb(hex);
    // contenido del bloque: nameLen(2) + nombre UTF-16 con null + modelo(4) + 3 floats(12) + tipo(2)
    const contentLen = 2 + (name.length + 1) * 2 + 4 + 12 + 2;
    return { name, r, g, b, contentLen };
  });

  let total = 12; // "ASEF"(4) + versión(4) + cantidad de bloques(4)
  for (const c of colors) total += 2 + 4 + c.contentLen; // tipo de bloque(2) + longitud(4) + contenido

  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf); // DataView usa big-endian por defecto (lo que pide ASE)
  let o = 0;
  const u8 = (n: number) => dv.setUint8(o++, n);
  const u16 = (n: number) => {
    dv.setUint16(o, n);
    o += 2;
  };
  const u32 = (n: number) => {
    dv.setUint32(o, n);
    o += 4;
  };
  const f32 = (n: number) => {
    dv.setFloat32(o, n);
    o += 4;
  };

  // cabecera
  u8(0x41); u8(0x53); u8(0x45); u8(0x46); // "ASEF"
  u16(1); u16(0); // versión 1.0
  u32(colors.length);

  for (const c of colors) {
    u16(0x0001); // bloque: entrada de color
    u32(c.contentLen);
    u16(c.name.length + 1); // largo del nombre (incluye terminador null)
    for (let i = 0; i < c.name.length; i++) u16(c.name.charCodeAt(i)); // UTF-16BE
    u16(0); // null terminator
    u8(0x52); u8(0x47); u8(0x42); u8(0x20); // modelo "RGB "
    f32(c.r / 255); f32(c.g / 255); f32(c.b / 255);
    u16(0x0002); // tipo de color: normal/process
  }

  return new Blob([buf], { type: 'application/octet-stream' });
}
