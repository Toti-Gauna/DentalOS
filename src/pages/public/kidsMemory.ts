// "Memoria de los Brisitos" (lote 5 · R-KID-02): segunda actividad de Brisa Chicos, distinta del juego de reflejos.
// Lógica pura: el mazo se mezcla con una semilla por ronda (sin Math.random) y el tiempo lo da quien la usa con `tick`.

export type MemoryMode = 'tranquilo' | 'reloj';
export type MemoryPhase = 'idle' | 'playing' | 'paused' | 'done';
/** Caras del mazo: los cuatro Brisitos y dos objetos de la sala. Cada una aparece dos veces. */
export const FACES = ['mora', 'coco', 'ivo', 'lia', 'cepillo', 'estrella'] as const;
export type Face = (typeof FACES)[number];
export const PAIRS = FACES.length;
export const MEMORY_TICK_MS = 500;
/** Con reloj: 90 segundos. Sin apuro no hay límite. */
export const MEMORY_TICKS = 180;

export interface MemoryState {
  phase: MemoryPhase;
  mode: MemoryMode;
  deck: Face[];
  matched: number[];
  /** Cartas dadas vuelta que todavía no se resolvieron (0, 1 o 2). */
  open: number[];
  moves: number;
  tick: number;
  /** Terminó porque se encontraron todos los pares (no por tiempo ni por salir). */
  won: boolean;
}

export type MemoryAction =
  | { type: 'start'; mode: MemoryMode; round: number }
  | { type: 'flip'; card: number }
  /** Da vuelta otra vez un par que no coincide (la interfaz lo manda después de una pausa corta). */
  | { type: 'settle' }
  | { type: 'tick' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' };

export const initialMemory = (mode: MemoryMode = 'tranquilo'): MemoryState => ({ phase: 'idle', mode, deck: [], matched: [], open: [], moves: 0, tick: 0, won: false });

const nextSeed = (s: number) => (s * 1103515245 + 12345) % 2147483648;

/** Fisher–Yates con un generador lineal congruente: mismo mazo para la misma ronda, distinto entre rondas. */
export function shuffledDeck(round: number): Face[] {
  const deck: Face[] = [...FACES, ...FACES];
  let seed = 97 + round * 7919;
  for (let i = deck.length - 1; i > 0; i--) {
    seed = nextSeed(seed);
    const j = Math.floor(seed / 65536) % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function memoryReducer(st: MemoryState, a: MemoryAction): MemoryState {
  switch (a.type) {
    case 'start':
      return { ...initialMemory(a.mode), phase: 'playing', deck: shuffledDeck(a.round) };
    case 'flip': {
      if (st.phase !== 'playing' || a.card < 0 || a.card >= st.deck.length) return st;
      if (st.matched.includes(a.card) || st.open.includes(a.card)) return st;
      // Si quedaron dos sin coincidir, la nueva carta primero las tapa (no hace falta esperar).
      const open = st.open.length === 2 ? [] : st.open;
      if (open.length === 0) return { ...st, open: [a.card] };
      const first = open[0];
      const moves = st.moves + 1;
      if (st.deck[first] === st.deck[a.card]) {
        const matched = [...st.matched, first, a.card];
        const won = matched.length === st.deck.length;
        return { ...st, matched, open: [], moves, phase: won ? 'done' : 'playing', won };
      }
      return { ...st, open: [first, a.card], moves };
    }
    case 'settle':
      return st.open.length === 2 ? { ...st, open: [] } : st;
    case 'tick': {
      if (st.phase !== 'playing' || st.mode !== 'reloj') return st;
      const tick = st.tick + 1;
      return tick >= MEMORY_TICKS ? { ...st, tick, open: [], phase: 'done', won: false } : { ...st, tick };
    }
    case 'pause':
      return st.phase === 'playing' ? { ...st, phase: 'paused' } : st;
    case 'resume':
      return st.phase === 'paused' ? { ...st, phase: 'playing' } : st;
    case 'stop':
      return st.phase === 'playing' || st.phase === 'paused' ? { ...st, phase: 'done', open: [], won: false } : st;
  }
}

export const pairsFound = (st: MemoryState) => st.matched.length / 2;
export const memorySecondsLeft = (st: MemoryState) => Math.max(0, Math.ceil(((MEMORY_TICKS - st.tick) * MEMORY_TICK_MS) / 1000));

/** Estrellas: siempre hay al menos una al completar; más con menos intentos. Nunca se pierde por equivocarse. */
export function memoryStars(st: MemoryState): number {
  if (!st.won) return pairsFound(st) > 0 ? 1 : 0;
  return st.moves <= PAIRS + 3 ? 3 : st.moves <= PAIRS * 2 + 2 ? 2 : 1;
}
