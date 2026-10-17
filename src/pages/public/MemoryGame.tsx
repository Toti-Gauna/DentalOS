// "Memoria de los Brisitos" (lote 5 · R-KID-02): pares de cartas boca abajo. Táctil, teclado (flechas en la grilla),
// pausa, salida y modo sin apuro. Es un juego para pasar el rato: no mide ni evalúa nada de la salud.
import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react';
import { useDraft } from '../../app/ui-state';
import { ToothCharacter } from '../../ui/art/characters';
import { BrushArt, StarArt } from '../../ui/art/kids';
import { Button, announce } from '../../ui/kit';
import { sound } from '../../ui/sound';
import { MEMORY_TICKS, MEMORY_TICK_MS, PAIRS, initialMemory, memoryReducer, memorySecondsLeft, memoryStars, pairsFound, type Face, type MemoryMode } from './kidsMemory';

const FACE_LABEL: Record<Face, string> = { mora: 'Mora', coco: 'Coco', ivo: 'Ivo', lia: 'Lía', cepillo: 'un cepillo', estrella: 'una estrella' };
const COLS = 4;
/** Tiempo que un par distinto queda a la vista antes de taparse (se puede seguir tocando antes). */
const SETTLE_MS = 1100;

function FaceArt({ face }: { face: Face }) {
  if (face === 'cepillo') return <BrushArt />;
  if (face === 'estrella') return <StarArt filled />;
  return <ToothCharacter who={face} mood="feliz" size={64} />;
}

export function MemoryGame({ round, onFinish }: { round: number; onFinish: (won: boolean, stars: number) => void }) {
  const [mode, setMode] = useDraft<MemoryMode>('kids:memory-mode', 'tranquilo');
  const [m, act] = useReducer(memoryReducer, mode, initialMemory);
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);
  const grid = useRef<HTMLDivElement>(null);
  // Al empezar, el foco pasa a la primera carta (cuando ya están habilitadas).
  const focusFirst = useRef(false);
  useEffect(() => {
    if (m.phase !== 'playing' || !focusFirst.current) return;
    focusFirst.current = false;
    grid.current?.querySelector<HTMLButtonElement>('.mem-card')?.focus();
  }, [m.phase]);

  const playing = m.phase === 'playing';
  const paused = m.phase === 'paused';
  const active = playing || paused;
  const done = m.phase === 'done';

  useEffect(() => {
    if (!playing || m.mode !== 'reloj') return;
    const id = setInterval(() => act({ type: 'tick' }), MEMORY_TICK_MS);
    return () => clearInterval(id);
  }, [playing, m.mode]);

  // Un par distinto se tapa solo después de un momento; en pausa queda como está.
  const mismatch = m.open.length === 2;
  useEffect(() => {
    if (!mismatch || !playing) return;
    const id = setTimeout(() => act({ type: 'settle' }), SETTLE_MS);
    return () => clearTimeout(id);
  }, [mismatch, playing, m.moves]);

  const prev = useRef(m);
  useEffect(() => {
    const was = prev.current;
    prev.current = m;
    if (m.matched.length > was.matched.length && !done) {
      sound.play('success');
      announce(`¡Par encontrado: ${FACE_LABEL[m.deck[m.matched[m.matched.length - 1]]]}! Llevás ${pairsFound(m)} de ${PAIRS}.`);
    } else if (m.open.length === 2 && was.open.length < 2) announce('No son iguales. Se dan vuelta en un momento.');
    if ((was.phase === 'playing' || was.phase === 'paused') && done) {
      const stars = memoryStars(m);
      sound.play(m.won ? 'fanfare' : 'success');
      announce(m.won ? `¡Encontraste los ${PAIRS} pares en ${m.moves} intentos! ${stars} estrella${stars === 1 ? '' : 's'}.` : `Fin de la partida: encontraste ${pairsFound(m)} de ${PAIRS} pares.`);
      finishRef.current(m.won, stars);
    }
  }, [m, done]);

  const start = () => {
    sound.play('tap');
    act({ type: 'start', mode, round });
    announce(mode === 'reloj' ? `¡A jugar! Tenés ${Math.round((MEMORY_TICKS * MEMORY_TICK_MS) / 1000)} segundos para encontrar los ${PAIRS} pares.` : `¡A jugar sin apuro! Encontrá los ${PAIRS} pares.`);
    focusFirst.current = true;
  };
  const flip = (i: number) => {
    if (!playing || m.matched.includes(i) || m.open.includes(i)) return;
    sound.play('tap');
    act({ type: 'flip', card: i });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const btns = [...(grid.current?.querySelectorAll<HTMLButtonElement>('.mem-card') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const to = e.key === 'ArrowRight' ? Math.min(btns.length - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1)
      : e.key === 'ArrowDown' ? Math.min(btns.length - 1, i + COLS) : e.key === 'ArrowUp' ? (i >= COLS ? i - COLS : i)
      : e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    btns[to]?.focus();
  };

  const stars = memoryStars(m);
  const cards = m.deck.length ? m.deck : Array.from({ length: PAIRS * 2 }, () => null);
  return (
    <section id="memoria" className="memory card" aria-labelledby="memory-title">
      <div className="stack memory-side">
        <p className="eyebrow">Juego · Memoria de los Brisitos</p>
        <h2 id="memory-title">Encontrá las parejas</h2>
        <p style={{ margin: 0 }}>Hay {PAIRS * 2} cartas boca abajo: cada dibujo está dos veces. Da vuelta dos cartas; si son iguales, quedan a la vista. Si no, se tapan y probás otra vez. Equivocarse está bien: es parte del juego.</p>
        <p className="small muted" style={{ margin: 0 }}>Con teclado: Tab para entrar a las cartas, flechas para moverte y Enter para dar vuelta.</p>
        <div className="field" style={{ maxWidth: 300 }}>
          <label htmlFor="memory-mode">Con reloj o sin apuro</label>
          <select id="memory-mode" value={mode} disabled={active} onChange={(e) => setMode(e.target.value as MemoryMode)}>
            <option value="tranquilo">Sin apuro (sin reloj)</option>
            <option value="reloj">Con reloj (90 segundos)</option>
          </select>
        </div>
        <dl className="game-hud">
          <div><dt>Pares</dt><dd className="tabular">{pairsFound(m)} de {PAIRS}</dd></div>
          <div><dt>Intentos</dt><dd className="tabular">{m.moves}</dd></div>
          <div><dt>{m.mode === 'reloj' ? 'Tiempo' : 'Reloj'}</dt><dd className="tabular">{m.mode === 'reloj' ? `${memorySecondsLeft(m)} s` : 'libre'}</dd></div>
        </dl>
        <div className="row wrap">
          <Button variant={active ? 'secondary' : 'primary'} icon={active ? 'x' : 'play'} onClick={active ? () => act({ type: 'stop' }) : start}>{active ? 'Salir de la partida' : done ? 'Jugar otra vez' : 'Empezar memoria'}</Button>
          {active && <Button variant="ghost" icon={paused ? 'play' : 'pause'} aria-pressed={paused} onClick={() => { act({ type: paused ? 'resume' : 'pause' }); announce(paused ? 'Seguimos.' : 'Memoria en pausa.'); }}>{paused ? 'Seguir' : 'Pausar'}</Button>}
        </div>
      </div>
      <div className="memory-stage">
        <div ref={grid} className={`memory-grid ${playing ? 'is-playing' : ''}`} role="group" aria-label={`Tablero de memoria: ${PAIRS * 2} cartas en ${COLS} columnas`} onKeyDown={onKey}>
          {cards.map((face, i) => {
            const found = m.matched.includes(i);
            const up = found || m.open.includes(i);
            return (
              <button key={i} type="button" className={`mem-card ${up ? 'is-up' : ''} ${found ? 'is-found' : ''}`} disabled={!playing}
                aria-label={`Carta ${i + 1}: ${face && up ? `${FACE_LABEL[face]}${found ? ', encontrada' : ''}` : 'boca abajo'}`} onClick={() => flip(i)}>
                <span className="mem-back" aria-hidden="true"><span className="mem-dot" /></span>
                <span className="mem-face" aria-hidden="true">{face && up && <FaceArt face={face} />}</span>
              </button>
            );
          })}
          {!playing && (
            <div className="game-overlay memory-overlay">
              {done ? (
                <div className="game-result">
                  <p className="game-stars" aria-label={`${stars} de 3 estrellas`}>{[0, 1, 2].map((k) => <StarArt key={k} filled={k < stars} />)}</p>
                  <p className="game-result-title">{m.won ? (stars === 3 ? '¡Memoria de campeón!' : '¡Todas las parejas!') : pairsFound(m) > 0 ? '¡Buen intento!' : '¡Hasta la próxima!'}</p>
                  <p className="small" style={{ margin: 0 }}>{m.won ? <>Lo lograste en <span className="tabular">{m.moves}</span> intentos.</> : <>Encontraste <span className="tabular">{pairsFound(m)}</span> de {PAIRS} pares.</>}</p>
                </div>
              ) : paused ? <p className="game-result-title">En pausa. Tocá “Seguir” cuando quieras.</p>
                : <p className="game-result-title">¿Listo? Tocá “Empezar memoria”.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
