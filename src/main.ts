import './style.css';
import { renderHome } from './home.ts';
import { mountReticulas } from './reticulas.ts';
import { mountColorConverter } from './colorconverter.ts';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  const path = location.hash.replace(/^#/, '') || '/';
  app.scrollTop = 0;

  if (path === '/reticulas') {
    cleanup = mountReticulas(app);
  } else if (path === '/color') {
    cleanup = mountColorConverter(app);
  } else {
    renderHome(app);
  }
}

window.addEventListener('hashchange', route);
route();
