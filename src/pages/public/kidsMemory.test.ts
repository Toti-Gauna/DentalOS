import { describe, expect, it } from 'vitest';
import { FACES, MEMORY_TICKS, PAIRS, initialMemory, memoryReducer, memorySecondsLeft, memoryStars, pairsFound, shuffledDeck, type MemoryState } from './kidsMemory';

const start = (mode: 'tranquilo' | 'reloj' = 'tranquilo', round = 0) => memoryReducer(initialMemory(mode), { type: 'start', mode, round });
const flip = (s: MemoryState, card: number) => memoryReducer(s, { type: 'flip', card });
/** Resuelve el mazo perfecto: da vuelta cada par conocido. */
function solve(s: MemoryState): MemoryState {
  for (const face of FACES) {
    const [a, b] = s.deck.flatMap((f, i) => (f === face ? [i] : []));
    s = flip(flip(s, a), b);
  }
  return s;
}

describe('Memoria de los Brisitos (S74–S76)', () => {
  it('el mazo tiene cada cara dos veces, es reproducible por ronda y cambia entre rondas', () => {
    const d = shuffledDeck(4);
    expect(d).toHaveLength(PAIRS * 2);
    for (const f of FACES) expect(d.filter((x) => x === f)).toHaveLength(2);
    expect(shuffledDeck(4)).toEqual(d);
    expect(new Set([0, 1, 2, 3].map((r) => shuffledDeck(r).join())).size).toBeGreaterThan(1);
  });

  it('un par igual queda encontrado; uno distinto se tapa con settle o al dar vuelta otra carta', () => {
    let s = start();
    const a = 0; const same = s.deck.indexOf(s.deck[0], 1); const other = s.deck.findIndex((f) => f !== s.deck[0]);
    s = flip(flip(s, a), other);
    expect(s.open).toEqual([a, other]);
    expect(s.moves).toBe(1);
    s = memoryReducer(s, { type: 'settle' });
    expect(s.open).toEqual([]);
    s = flip(flip(s, a), other);
    s = flip(s, same); // la tercera carta tapa el par anterior y queda sola
    expect(s.open).toEqual([same]);
    s = flip(s, a);
    expect(s.matched.sort()).toEqual([a, same].sort());
    expect(pairsFound(s)).toBe(1);
  });

  it('no se puede dar vuelta una carta encontrada, la misma dos veces, ni jugar en pausa', () => {
    let s = start();
    const same = s.deck.indexOf(s.deck[0], 1);
    s = flip(flip(s, 0), same);
    expect(flip(s, 0)).toEqual(s);
    const one = flip(s, s.deck.findIndex((_, i) => !s.matched.includes(i)));
    expect(flip(one, one.open[0])).toEqual(one);
    const paused = memoryReducer(s, { type: 'pause' });
    expect(paused.phase).toBe('paused');
    expect(flip(paused, 5)).toEqual(paused);
    expect(memoryReducer(paused, { type: 'tick' })).toEqual(paused);
    expect(memoryReducer(paused, { type: 'resume' }).phase).toBe('playing');
  });

  it('completar el mazo gana; con el mínimo de intentos son 3 estrellas', () => {
    const s = solve(start());
    expect(s.phase).toBe('done');
    expect(s.won).toBe(true);
    expect(s.moves).toBe(PAIRS);
    expect(memoryStars(s)).toBe(3);
  });

  it('sin apuro el tiempo no corre; con reloj termina a los 90 s sin culpar (al menos 1 estrella si hubo pares)', () => {
    expect(memoryReducer(start('tranquilo'), { type: 'tick' }).tick).toBe(0);
    let s = start('reloj');
    expect(memorySecondsLeft(s)).toBe(90);
    const same = s.deck.indexOf(s.deck[0], 1);
    s = flip(flip(s, 0), same);
    for (let i = 0; i < MEMORY_TICKS; i++) s = memoryReducer(s, { type: 'tick' });
    expect(s.phase).toBe('done');
    expect(s.won).toBe(false);
    expect(memoryStars(s)).toBe(1);
  });

  it('salir termina sin ganar y permite volver a empezar', () => {
    let s = memoryReducer(start(), { type: 'stop' });
    expect(s.phase).toBe('done');
    expect(s.won).toBe(false);
    s = memoryReducer(s, { type: 'start', mode: 'tranquilo', round: 1 });
    expect(s.phase).toBe('playing');
    expect(s.matched).toEqual([]);
  });
});
