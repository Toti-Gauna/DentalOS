// Router por hash: funciona en GitHub Pages y preview sin rewrites.
import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
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
