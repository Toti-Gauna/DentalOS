import { describe, expect, it } from 'vitest';
import { CALM_GOAL, GAME_TICKS, GERM_LIFE, MAX_GERMS, gameReducer, initialGame, secondsLeft, starsFor, type GameState } from './kidsGame';

const start = (mode: 'reloj' | 'tranquilo' = 'reloj', round = 0) => gameReducer(initialGame(mode), { type: 'start', mode, round });
const germsOf = (s: GameState) => Object.keys(s.germs).map(Number);
const ticks = (s: GameState, n: number) => { for (let i = 0; i < n; i++) s = gameReducer(s, { type: 'tick' }); return s; };

describe('¡A limpiar la sonrisa!', () => {
  it('al empezar ya hay un bichito y el reloj marca 30 segundos', () => {
    const s = start();
    expect(s.phase).toBe('playing');
    expect(germsOf(s)).toHaveLength(1);
    expect(secondsLeft(s)).toBe(30);
  });

  it('es reproducible por ronda y cambia entre rondas', () => {
    expect(germsOf(ticks(start('reloj', 3), 10))).toEqual(germsOf(ticks(start('reloj', 3), 10)));
    const seqs = [0, 1, 2, 3].map((r) => germsOf(start('reloj', r))[0]);
    expect(new Set(seqs).size).toBeGreaterThan(1);
  });

  it('nunca hay más de tres bichitos a la vez y siempre en dientes válidos', () => {
    let s = start();
    for (let i = 0; i < GAME_TICKS - 1; i++) {
      s = gameReducer(s, { type: 'tick' });
      expect(germsOf(s).length).toBeLessThanOrEqual(MAX_GERMS);
      for (const t of germsOf(s)) expect(t >= 0 && t < 12).toBe(true);
    }
  });

  it('cepillar un diente con bichito suma; uno limpio no cambia nada', () => {
    const s = start();
    const [t] = germsOf(s);
    const clean = (t + 1) % 12;
    expect(gameReducer(s, { type: 'brush', tooth: clean })).toBe(s);
    const after = gameReducer(s, { type: 'brush', tooth: t });
    expect(after.score).toBe(1);
    expect(after.germs[t]).toBeUndefined();
    expect(after.lastClean).toBe(t);
  });

  it('con reloj, un bichito sin cepillar se escapa y la partida termina a los 30 segundos', () => {
    const s = ticks(start(), GERM_LIFE);
    expect(s.escaped).toBeGreaterThanOrEqual(1);
    const end = ticks(s, GAME_TICKS);
    expect(end.phase).toBe('done');
    expect(germsOf(end)).toHaveLength(0);
    expect(gameReducer(end, { type: 'tick' })).toBe(end);
    expect(gameReducer(end, { type: 'brush', tooth: 0 })).toBe(end);
  });

  it('jugando bien se ganan tres estrellas', () => {
    let s = start();
    while (s.phase === 'playing') {
      for (const t of germsOf(s)) s = gameReducer(s, { type: 'brush', tooth: t });
      s = gameReducer(s, { type: 'tick' });
    }
    expect(s.score).toBeGreaterThanOrEqual(15);
    expect(starsFor('reloj', s.score)).toBe(3);
  });

  it('sin apuro no hay reloj ni escapes: termina al limpiar la meta', () => {
    let s = ticks(start('tranquilo'), 200);
    expect(s.phase).toBe('playing');
    expect(s.escaped).toBe(0);
    while (s.phase === 'playing') {
      for (const t of germsOf(s)) s = gameReducer(s, { type: 'brush', tooth: t });
      s = gameReducer(s, { type: 'tick' });
    }
    expect(s.score).toBe(CALM_GOAL);
    expect(starsFor('tranquilo', s.score)).toBe(3);
  });

  it('estrellas con reloj según los puntos y “Terminar” cierra la partida', () => {
    expect([0, 1, 7, 8, 14, 15].map((n) => starsFor('reloj', n))).toEqual([0, 1, 1, 2, 2, 3]);
    expect(gameReducer(start(), { type: 'stop' }).phase).toBe('done');
  });

  it('S73: en pausa el reloj no corre, no se cepilla ni se escapan bichitos; al seguir queda igual', () => {
    let s = ticks(start(), 4);
    const before = { tick: s.tick, germs: { ...s.germs }, escaped: s.escaped };
    s = gameReducer(s, { type: 'pause' });
    expect(s.phase).toBe('paused');
    s = ticks(s, 40);
    const t = germsOf(s)[0];
    s = gameReducer(s, { type: 'brush', tooth: t });
    expect({ tick: s.tick, germs: s.germs, escaped: s.escaped }).toEqual(before);
    s = gameReducer(s, { type: 'resume' });
    expect(s.phase).toBe('playing');
    expect(gameReducer(gameReducer(s, { type: 'pause' }), { type: 'stop' }).phase).toBe('done');
  });
});

