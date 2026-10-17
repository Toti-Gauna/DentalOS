// "¡A limpiar la sonrisa!": lógica pura del juego de Brisa Chicos (sin DOM ni tiempo real).
// El reloj lo da quien la usa con acciones `tick`; la aparición de bichitos es pseudoaleatoria con semilla,
// así cada partida es distinta pero reproducible (y testeable) sin Math.random.

export type GameMode = 'reloj' | 'tranquilo';
export type GamePhase = 'idle' | 'playing' | 'done';

export const GAME_TEETH = 12;
export const TICK_MS = 500;
/** Con reloj: 30 segundos. */
export const GAME_TICKS = 60;
/** Un bichito se escapa si nadie lo cepilla en 4 segundos (solo con reloj). */
export const GERM_LIFE = 8;
export const MAX_GERMS = 3;
/** Sin apuro: la partida termina al limpiar esta cantidad. */
export const CALM_GOAL = 12;

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  tick: number;
  /** índice de diente → tick en que apareció su bichito */
  germs: Record<number, number>;
  score: number;
  escaped: number;
  seed: number;
  /** último diente cepillado y cuántas veces se cepilló en total (para reiniciar el destello) */
  lastClean: number | null;
  cleans: number;
}

export type GameAction =
  | { type: 'start'; mode: GameMode; round: number }
  | { type: 'tick' }
  | { type: 'brush'; tooth: number }
  | { type: 'stop' };

export const initialGame = (mode: GameMode = 'reloj'): GameState => ({ phase: 'idle', mode, tick: 0, germs: {}, score: 0, escaped: 0, seed: 1, lastClean: null, cleans: 0 });

const nextSeed = (s: number) => (s * 1103515245 + 12345) % 2147483648;

function spawn(st: GameState): GameState {
  const taken = Object.keys(st.germs).map(Number);
  if (taken.length >= MAX_GERMS) return st;
  if (st.mode === 'tranquilo' && st.score + taken.length >= CALM_GOAL) return st;
  const free = Array.from({ length: GAME_TEETH }, (_, i) => i).filter((i) => !taken.includes(i) && i !== st.lastClean);
  if (free.length === 0) return st;
  const seed = nextSeed(st.seed);
  const tooth = free[Math.floor(seed / 65536) % free.length];
  return { ...st, seed, germs: { ...st.germs, [tooth]: st.tick } };
}

export function gameReducer(st: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'start': {
      const fresh: GameState = { ...initialGame(a.mode), phase: 'playing', seed: 7 + a.round * 7919 };
      return spawn(fresh);
    }
    case 'stop':
      return st.phase === 'playing' ? { ...st, phase: 'done', germs: {} } : st;
    case 'tick': {
      if (st.phase !== 'playing') return st;
      const tick = st.tick + 1;
      let germs = st.germs;
      let escaped = st.escaped;
      if (st.mode === 'reloj') {
        germs = {};
        for (const [k, born] of Object.entries(st.germs)) {
          if (tick - born >= GERM_LIFE) escaped++;
          else germs[Number(k)] = born;
        }
        if (tick >= GAME_TICKS) return { ...st, tick, germs: {}, escaped, phase: 'done' };
      }
      const next = { ...st, tick, germs, escaped };
      return tick % 2 === 0 || Object.keys(germs).length === 0 ? spawn(next) : next;
    }
    case 'brush': {
      if (st.phase !== 'playing' || !(a.tooth in st.germs)) return st;
      const germs = { ...st.germs };
      delete germs[a.tooth];
      const score = st.score + 1;
      const done = st.mode === 'tranquilo' && score >= CALM_GOAL;
      return { ...st, germs: done ? {} : germs, score, lastClean: a.tooth, cleans: st.cleans + 1, phase: done ? 'done' : 'playing' };
    }
  }
}

/** Estrellas al terminar: sin apuro siempre son tres (se completa la meta); con reloj dependen de los puntos. */
export function starsFor(mode: GameMode, score: number): number {
  if (mode === 'tranquilo') return score >= CALM_GOAL ? 3 : score > 0 ? 1 : 0;
  return score >= 15 ? 3 : score >= 8 ? 2 : score >= 1 ? 1 : 0;
}

export const secondsLeft = (st: GameState) => Math.max(0, Math.ceil(((GAME_TICKS - st.tick) * TICK_MS) / 1000));
