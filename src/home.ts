const gridIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="1.5"/>
  <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
</svg>`;

const colorIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="13.5" cy="6.5" r="2.5"/>
  <circle cx="17.5" cy="10.5" r="2.5"/>
  <circle cx="8.5" cy="7.5" r="2.5"/>
  <circle cx="6.5" cy="12.5" r="2.5"/>
  <path d="M12 22a10 10 0 1 1 0-20 8.5 8.5 0 0 1 8.5 8.5c0 2-1.5 3.5-3.5 3.5h-1.7a1.8 1.8 0 0 0-1.3 3 1.8 1.8 0 0 1-1 5z"/>
</svg>`;

const soonIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 8v8M8 12h8"/>
</svg>`;

interface ToolCard {
  href?: string;
  icon: string;
  title: string;
  desc: string;
  soon?: boolean;
}

const TOOLS: ToolCard[] = [
  {
    href: '#/reticulas',
    icon: gridIcon,
    title: 'Constructor de Retículas',
    desc: 'Grillas editoriales y cuadrículas para imprenta, con exportación a SVG y PNG.',
  },
  {
    href: '#/color',
    icon: colorIcon,
    title: 'Conversor de Color',
    desc: 'Convertí entre CMYK, RGB, HEX y HSL al instante, con vista previa del color.',
  },
  {
    icon: soonIcon,
    title: 'Más herramientas',
    desc: 'Nuevas utilidades para diseñadores. Próximamente.',
    soon: true,
  },
];

export function renderHome(app: HTMLElement): void {
  const cards = TOOLS.map((t) => {
    const inner = `
      <div class="tool-icon">${t.icon}</div>
      <h2>${t.title}</h2>
      <p>${t.desc}</p>
      ${t.soon ? '<span class="tool-badge">Pronto</span>' : ''}`;
    return t.href
      ? `<a class="tool-card" href="${t.href}">${inner}</a>`
      : `<div class="tool-card is-soon">${inner}</div>`;
  }).join('');

  app.innerHTML = `
    <div class="home">
      <header class="home-header">
        <h1 class="home-title">Design Toolbox</h1>
        <p class="home-subtitle">Una caja de herramientas para diseñadores.</p>
      </header>
      <div class="tool-grid">${cards}</div>
    </div>`;
}
