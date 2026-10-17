// Mockups interactivos (lote 4): marco de teléfono con acabado final y superficie ampliable.
// “Ampliar / Pantalla completa” usa la Fullscreen API solo tras el gesto y si el navegador la ofrece; si no, la misma
// superficie ocupa la ventana dentro de la página. Siempre es el MISMO componente: no se copia ni se reinicia el estado.
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useDemo } from '../app/store';
import { parts } from '../domain/time';
import { Icon } from './kit';

export type SurfaceMode = 'normal' | 'expanded' | 'fullscreen';
const SurfaceModeContext = createContext<SurfaceMode>('normal');
export const useSurfaceMode = () => useContext(SurfaceModeContext);

/** Marca como inerte todo lo que no contiene a `el` (hermanos de cada ancestro) y devuelve cómo deshacerlo. */
function inertOutside(el: HTMLElement): () => void {
  const touched: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sib of Array.from(parent.children) as HTMLElement[]) {
      if (sib !== node && !sib.inert && sib.tagName !== 'SCRIPT') { sib.inert = true; touched.push(sib); }
    }
    node = parent;
  }
  return () => touched.forEach((t) => { t.inert = false; });
}

let historySeq = 0;

export function ExpandableSurface({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<SurfaceMode>('normal');
  const scrollY = useRef(0);
  const token = useRef<string | null>(null);
  const titleId = useId();

  const restore = () => {
    setMode('normal');
    if (slot.current) slot.current.style.height = '';
    // Vuelve el foco al botón y la página a la posición previa (el mismo botón cambia de texto, no se desmonta).
    requestAnimationFrame(() => requestAnimationFrame(() => { window.scrollTo({ top: scrollY.current, behavior: 'instant' }); button.current?.focus({ preventScroll: true }); }));
  };

  const open = async () => {
    scrollY.current = window.scrollY;
    const el = ref.current;
    if (!el) return;
    // El lugar de la superficie queda reservado: la página no se acorta y el scroll no se pierde al volver.
    if (slot.current) slot.current.style.height = `${slot.current.offsetHeight}px`;
    if (document.fullscreenEnabled && typeof el.requestFullscreen === 'function') {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        setMode('fullscreen');
        return;
      } catch { /* sin permiso o sin soporte real: modo ampliado en la página */ }
    }
    // Modo ampliado: una entrada propia en el historial permite cerrar con Atrás sin salir de la página.
    token.current = `surface-${++historySeq}`;
    history.pushState({ ...(history.state ?? {}), dentalosSurface: token.current }, '', location.href);
    setMode('expanded');
  };

  const close = () => {
    if (mode === 'fullscreen') { void document.exitFullscreen?.(); return; }
    // Solo se retrocede si la entrada actual es la que agregó esta superficie; nunca un history.back a ciegas.
    if (token.current && (history.state as { dentalosSurface?: string } | null)?.dentalosSurface === token.current) { history.back(); return; }
    token.current = null;
    restore();
  };

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement && mode === 'fullscreen') restore(); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'expanded') return;
    const onPop = () => { if ((history.state as { dentalosSurface?: string } | null)?.dentalosSurface !== token.current) { token.current = null; restore(); } };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Si hay un menú o diálogo abierto, Escape lo cierra a él primero.
      if (document.querySelector('[popover]:popover-open, dialog[open]')) return;
      close();
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === 'normal' || !ref.current) return;
    const undo = inertOutside(ref.current);
    document.documentElement.classList.add('has-open-surface');
    return () => { undo(); document.documentElement.classList.remove('has-open-surface'); };
  }, [mode]);

  const isOpen = mode !== 'normal';
  return (
    <SurfaceModeContext.Provider value={mode}>
      <div ref={slot} className="xsurface-slot">
      <div ref={ref} className={`xsurface is-${mode} ${className}`} role={isOpen ? 'dialog' : 'group'} aria-modal={isOpen || undefined} aria-labelledby={titleId}>
        <div className="xsurface-bar">
          <p id={titleId} className="xsurface-title">{title}{isOpen && <span className="xsurface-mode">{mode === 'fullscreen' ? ' · pantalla completa' : ' · ampliado'}</span>}</p>
          <button ref={button} type="button" className="btn btn-sm xsurface-toggle" onClick={isOpen ? close : open} aria-pressed={isOpen}>
            <Icon name={isOpen ? 'shrink' : 'expand'} size={16} /> <span>{isOpen ? 'Restaurar / Cerrar' : 'Ampliar / Pantalla completa'}</span>
          </button>
        </div>
        <div className="xsurface-body">{children}</div>
      </div>
      </div>
    </SurfaceModeContext.Provider>
  );
}

function StatusGlyphs() {
  return (
    <svg className="device-glyphs" viewBox="0 0 54 12" width="54" height="12" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.5} y={9 - i * 2.4} width="3" height={3 + i * 2.4} rx=".8" fill="currentColor" opacity={i === 3 ? 0.35 : 1} />)}
      <path d="M24 4.6 a7 7 0 0 1 9 0 M25.7 6.6 a4.4 4.4 0 0 1 5.6 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="28.5" cy="9.2" r="1.2" fill="currentColor" />
      <rect x="37" y="2" width="14" height="8" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <rect x="38.6" y="3.6" width="9" height="4.8" rx="1.1" fill="currentColor" />
      <rect x="51.6" y="4.6" width="1.6" height="2.8" rx=".6" fill="currentColor" />
    </svg>
  );
}

/** Marco de teléfono: barra de estado con la hora del reloj de muestra, isla, indicador de inicio. En modo ampliado
 *  el marco se retira y el contenido ocupa la superficie (no es un teléfono diminuto dentro de un panel enorme). */
export function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const mode = useSurfaceMode();
  const s = useDemo();
  return (
    <div className={`device ${mode === 'normal' ? '' : 'is-open'} ${className}`}>
      <div className="device-screen">
        <div className="device-status" aria-hidden="true">
          <span className="tabular">{parts(s.clock).hhmm}</span>
          <span className="device-island" />
          <StatusGlyphs />
        </div>
        <div className="device-content">{children}</div>
        <span className="device-home" aria-hidden="true" />
      </div>
    </div>
  );
}
