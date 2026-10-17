// Respuesta "en streaming" simulada (lote 6 · 6I): una pausa breve de "pensando" y el texto que aparece por palabras.
// Es interrumpible y no demora para aparentar inteligencia: con movimiento reducido se muestra entero.
import { useEffect, useRef, useState } from 'react';

const THINK_MS = 280;
const STEP_MS = 22;
const WORDS_PER_STEP = 2;

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface Streamed { shown: string; thinking: boolean; streaming: boolean; interrupted: boolean; stop: () => void; finish: () => void }

/** `key` cambia con cada respuesta nueva; mientras no cambie, el texto mostrado no vuelve a animarse. */
export function useStreamedText(text: string, key: string | number | null): Streamed {
  const words = useRef<string[]>(key == null ? [] : text.split(/(\s+)/));
  // Arranca ya en "pensando" (o completo con movimiento reducido) para no mostrar un cuadro intermedio.
  const [count, setCount] = useState(() => (key != null && reduced() ? words.current.length : 0));
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'streaming' | 'done' | 'stopped'>(() => (key == null ? 'idle' : reduced() ? 'done' : 'thinking'));

  useEffect(() => {
    if (key == null) { setPhase('idle'); setCount(0); return; }
    words.current = text.split(/(\s+)/);
    if (reduced()) { setCount(words.current.length); setPhase('done'); return; }
    setCount(0); setPhase('thinking');
    const t = setTimeout(() => setPhase('streaming'), THINK_MS);
    return () => clearTimeout(t);
    // Solo una animación por respuesta (key), aunque el texto se recalcule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (phase !== 'streaming') return;
    if (count >= words.current.length) { setPhase('done'); return; }
    const t = setTimeout(() => setCount((c) => Math.min(words.current.length, c + WORDS_PER_STEP * 2)), STEP_MS);
    return () => clearTimeout(t);
  }, [phase, count]);

  const full = phase === 'done';
  return {
    shown: full ? text : words.current.slice(0, count).join(''),
    thinking: phase === 'thinking',
    streaming: phase === 'thinking' || phase === 'streaming',
    interrupted: phase === 'stopped',
    stop: () => setPhase((p) => (p === 'thinking' || p === 'streaming' ? 'stopped' : p)),
    finish: () => { setCount(words.current.length); setPhase('done'); },
  };
}
