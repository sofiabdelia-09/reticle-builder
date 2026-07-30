# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code.

## Qué es

**Design Toolbox**: suite de herramientas para diseñadores, front-end puro (Vite + TypeScript vanilla, **sin dependencias de runtime**). Se despliega como sitio estático en Vercel (redespliega en cada push a `main`). El repo se llama `reticle-builder` por razones históricas.

## Comandos

```bash
npm run dev            # dev server (localhost:5173)
npm run dev -- --host  # expone en la red (para probar en el celular)
npm run build          # tsc (typecheck) + vite build → dist/
npm run preview        # sirve dist/
```

No hay tests ni linter configurados. **`npm run build` es la verificación**: corre `tsc` con `strict`, `noUnusedLocals` y `noUnusedParameters`, así que una variable sin usar rompe el build. Ejecutá el build antes de dar algo por terminado.

## Arquitectura

SPA con **router por hash** en `main.ts`. Rutas: `#/` (home), `#/reticulas`, `#/color`. Cada herramienta expone una función `mount(app): () => void` que inyecta su markup en el contenedor y devuelve una función de limpieza; el router la llama al cambiar de vista. `index.html` es sólo `<div id="app"></div>`.

- **`home.ts`** — grilla de tarjetas hacia cada herramienta.
- **`reticulas.ts`** — Constructor de Retículas. Mantiene un `GridConfig`, arma el panel con `buildControls`, y en cada cambio re-renderiza el SVG. Usa:
  - **`types.ts`** — `GridConfig`, `MM_PER_UNIT`, `PAGE_SIZES_MM`, `DEFAULT_CONFIG`.
  - **`grid.ts`** — geometría pura: `pageDimsMM`, `computeGrid` (modular), `computeSquareGrid` (cuadrícula). **Todo se calcula en milímetros.**
  - **`svg.ts`** — `buildSVG(cfg, {absolute})` genera el string SVG.
  - **`controls.ts`** — panel declarativo: `GROUPS` describe los campos (number/select/toggle/color) con `showWhen`/`disableWhen`; `buildControls` los construye.
- **`colorconverter.ts`** — Conversor de Color. Estado canónico: un `rgb`. Usa:
  - **`color.ts`** — conversiones puras HEX/RGB/CMYK/HSL y `harmony()`.
  - **`ase.ts`** — genera un archivo `.ase` (Adobe Swatch Exchange, binario big-endian) a mano.
- **`colorpicker.ts`** — selector reutilizable (área SV + tono + alfa) en un popover anclado a `<body>`.
- **`style.css`** — un único stylesheet global, tema oscuro, con media query mobile (≤760px) que pasa a scroll de documento.

## Convenciones y decisiones clave (leer antes de tocar)

- **Unidades:** la geometría de las retículas se calcula **siempre en mm**. La unidad de trabajo del usuario (`cfg.unit`) sólo afecta la entrada/salida. Al **exportar**, el SVG se emite en el sistema de coordenadas de la unidad del usuario (viewBox + `width/height` en esa unidad, contenido mm envuelto en `<g transform="scale(1/f)">`). Esto es intencional: en **px** el archivo queda en px puro, sin mm que un editor a 72 dpi reinterprete (bug histórico: 800px salían como 600px). No vuelvas a poner `width` fijo en `mm`.
- **PNG:** en `px` rasteriza 1:1; en unidades físicas usa 300 DPI.
- **CMYK↔RGB no es inyectivo.** En el conversor, `renderAll(skipGroup)` **no re-deriva los campos del grupo que se está editando**; si eliminás ese `skipGroup`, al tipear un canal CMYK se pisan los otros. CMYK es conversión matemática (sin perfil ICC) — está documentado en la UI con un tooltip.
- **Color picker:** hay un único listener global que cierra el picker activo al clic-afuera/Escape. El popover se oculta con `[hidden]` y hay una regla CSS `.cp-popover[hidden]{display:none}` **necesaria** porque `display:flex` pisaría el atributo `hidden`.
- **`.cclibs` (bibliotecas de Adobe CC):** se intentó y se descartó — Creative Cloud sólo acepta el archivo exacto que él mismo exportó (valida contra su nube por `id`/`assetId`). No se puede generar localmente. La vía a Adobe es `.ase` → abrir en Illustrator/PS → arrastrar a una CC Library.
- **Idioma:** UI y textos en **español**. Nombres de código en inglés.
- **Estilo de código:** vanilla TS, sin frameworks ni librerías. Los archivos que se descargan (SVG, PNG, `.ase`) se generan a mano; mantenerlo así.

## Flujo de trabajo

- Al cambiar UI, correr en local (`npm run dev`) y verificar visualmente; para mobile, `--host`.
- Commit + push sólo cuando el usuario lo pida. Trabajar en `main` está bien (Vercel despliega desde ahí).
- Para bugs esquivos, agregar logs de diagnóstico y leer la salida en vez de teorizar.
