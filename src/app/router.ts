// Router por hash: funciona en GitHub Pages y preview sin rewrites.
// Entre rutas usa la View Transitions API nativa (si existe y no hay movimiento reducido): el DOM nuevo se
// confirma dentro de la transición, así el cambio es inmediato para la lógica y solo la imagen se funde.
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

type Doc = Document & { startViewTransition?: (cb: () => void) => unknown };
const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Un solo listener de hashchange para todos los suscriptores: una única transición por navegación.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
function onHash() {
  const doc = document as Doc;
  if (typeof doc.startViewTransition !== 'function' || reducedMotion() || document.hidden) { notify(); return; }
  try {
    doc.startViewTransition(() => { flushSync(notify); });
  } catch {
    notify();
  }
}
const subscribe = (cb: () => void) => {
  if (listeners.size === 0) window.addEventListener('hashchange', onHash);
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener('hashchange', onHash);
  };
};
const getHash = () => window.location.hash || '#/';

export function useRoute(): { path: string; segments: string[]; query: URLSearchParams } {
  const hash = useSyncExternalStore(subscribe, getHash);
  const [pathPart, queryPart = ''] = hash.replace(/^#/, '').split('?');
  const path = pathPart || '/';
  return { path, segments: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(queryPart) };
}

export function navigate(to: string) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (window.location.hash !== target) window.location.hash = target;
}
