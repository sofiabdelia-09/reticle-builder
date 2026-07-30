# Design Toolbox

Una suite de herramientas para diseñadores gráficos, 100% front-end y sin dependencias de runtime. Pensada para desplegarse como sitio estático (Vercel, Netlify, GitHub Pages, etc.).

> El repositorio se llama `reticle-builder` por su primera herramienta, pero el proyecto evolucionó a una caja de herramientas con navegación propia.

## Herramientas

### 🔳 Constructor de Retículas (`#/reticulas`)
Genera grillas editoriales y de imprenta con vista previa en vivo y exportación vectorial/bitmap.

- **Tipos de grilla:** modular / columnas (columnas, filas, medianiles independientes) y cuadrícula (por tamaño de celda, con o sin márgenes).
- **Documento:** tamaños A2–A6, Carta, Legal, Tabloide o personalizado; orientación vertical/horizontal; lado de página (lomo interno/externo).
- **Unidades de trabajo:** mm, cm, px, pt, in (se reconvierten al cambiar de unidad).
- **Capas:** módulos, líneas, margen y fondo de hoja, con color y opacidad configurables.
- **Exportar:** SVG (vectorial, a tamaño real en la unidad de trabajo) y PNG (1:1 en px, 300 DPI en unidades físicas).

### 🎨 Conversor de Color (`#/color`)
Conversión en vivo entre formatos, selector visual y generación de paletas.

- **Formatos:** HEX, RGB, CMYK y HSL, editables y con copiado por formato.
- **Selector:** barras de Tono / Saturación / Luminosidad con gradiente en vivo.
- **Armonías:** complementario, análogo, tríada, split-complementario, tétrada y monocromático.
- **Paleta:** colección manual persistida en el navegador (localStorage).
- **Exportar paleta:** lista HEX, variables CSS, JSON y `.ase` (Adobe Swatch Exchange) para importar en Illustrator/Photoshop.

## Stack

- [Vite](https://vitejs.dev/) + TypeScript (vanilla, sin framework).
- Cero dependencias de runtime — todo el render, las conversiones y los generadores de archivos (SVG, PNG, `.ase`) están hechos a mano.
- Ruteo del lado del cliente por *hash* (`#/`, `#/reticulas`, `#/color`).

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo (http://localhost:5173)
npm run build     # typecheck (tsc) + build de producción a dist/
npm run preview   # sirve el build de producción
```

Para probar en un dispositivo de la misma red:

```bash
npm run dev -- --host
```

## Estructura

```
src/
  main.ts            Router por hash; monta la vista según la ruta
  home.ts            Página de inicio con las tarjetas de herramientas
  reticulas.ts       Herramienta Constructor de Retículas
    controls.ts        Panel de controles (declarativo)
    grid.ts            Geometría de las grillas (modular y cuadrícula)
    svg.ts             Generación del SVG
    types.ts           GridConfig, unidades y tamaños de página
  colorconverter.ts  Herramienta Conversor de Color
    color.ts           Conversiones HEX/RGB/CMYK/HSL y armonías
    ase.ts             Generador de archivos .ase
  colorpicker.ts     Selector de color reutilizable (área SV + tono + alfa)
  style.css          Estilos globales (tema oscuro)
```

## Despliegue

Es un sitio estático de Vite: cualquier hosting estático sirve. En Vercel se autodetecta (build `npm run build`, salida `dist`) y redespliega en cada push a `main`.

## Licencia

Sin licencia definida (proyecto privado).
