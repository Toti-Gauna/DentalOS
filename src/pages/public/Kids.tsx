import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { navigate } from '../../app/router';
import { useDraft } from '../../app/ui-state';
import { CHARACTERS, ToothCharacter, type Character, type Mood } from '../../ui/art/characters';
import { GameMouth, Germ, KidTooth, StarArt } from '../../ui/art/kids';
import { ToothArt } from '../../ui/art/teeth';
import { Button, ConfirmDialog, Icon, Notice, announce } from '../../ui/kit';
import { sound } from '../../ui/sound';
import { CALM_GOAL, GAME_TEETH, GAME_TICKS, TICK_MS, gameReducer, initialGame, secondsLeft, starsFor, type GameMode } from './kidsGame';

interface KidsProgress { stickers: string[]; brushed: number; met: Character[]; games: number; cleaned: number; best: number }
const EMPTY: KidsProgress = { stickers: [], brushed: 0, met: [], games: 0, cleaned: 0, best: 0 };

const STICKERS: { id: string; label: string; how: string }[] = [
  { id: 'equipo', label: 'Equipo completo', how: 'Saludá a los Brisitos' },
  { id: 'amigos', label: 'Amigos de verdad', how: 'Tocá a cada Brisito para conocerlo' },
  { id: 'juego', label: 'Cazabichitos', how: 'Terminá una partida de ¡A limpiar la sonrisa!' },
  { id: 'juego-3', label: 'Sonrisa brillante', how: 'Ganá 3 estrellas jugando con reloj' },
  { id: 'juego-30', label: 'Superlimpieza', how: 'Limpiá 30 bichitos en total' },
  { id: 'cuento', label: 'Cuento leído', how: 'Terminá el cuento de la primera visita' },
  { id: 'cepillado', label: 'Primer cepillado', how: 'Completá un cepillado con el reloj' },
  { id: 'cepillado-3', label: 'Diente de oro', how: 'Completá tres cepillados' },
];
const STICKER_IDS = new Set(STICKERS.map((x) => x.id));

const STORY: { who: Character; mood: Mood; title: string; text: string }[] = [
  { who: 'ivo', mood: 'feliz', title: 'Llegamos a la clínica', text: 'Te recibe una persona de recepción que anota tu nombre. Podés venir con quien te cuida.' },
  { who: 'lia', mood: 'sorpresa', title: 'La sala de espera', text: 'Esperás un ratito. Si tenés preguntas, ¡hacelas! Nadie se enoja por preguntar.' },
  { who: 'mora', mood: 'valiente', title: 'El sillón que sube y baja', text: 'Te sentás en un sillón especial con una luz. La odontóloga te cuenta qué va a hacer antes de hacerlo.' },
  { who: 'coco', mood: 'guino', title: 'Contamos los dientes', text: 'Mira tus dientes con un espejito. Si algo te incomoda, levantás la mano y para.' },
  { who: 'ivo', mood: 'feliz', title: '¡Listo!', text: 'Al terminar te explican los próximos pasos a vos y a tu familia. ¡Lo hiciste muy bien!' },
];

const ZONES = ['Arriba a la derecha', 'Arriba a la izquierda', 'Abajo a la izquierda', 'Abajo a la derecha'];
const IDLE_MOOD: Record<Character, Mood> = { mora: 'feliz', coco: 'guino', ivo: 'feliz', lia: 'feliz' };

function StickerArt({ id, earned }: { id: string; earned: boolean }) {
  const inner = id === 'equipo' ? <ToothCharacter who="mora" mood="guino" size={52} />
    : id === 'amigos' ? <ToothCharacter who="lia" mood="feliz" size={52} />
    : id === 'juego' ? <Germ variant={1} />
    : id === 'juego-3' ? <StarArt filled />
    : id === 'juego-30' ? <ToothCharacter who="coco" mood="feliz" size={52} />
    : id === 'cuento' ? <ToothCharacter who="ivo" mood="sorpresa" size={52} />
    : id === 'cepillado' ? <ToothCharacter who="coco" mood="valiente" size={52} />
    : <ToothArt kind="molar" state="corona_oro" width={40} />;
  return <span className={`sticker ${earned ? 'is-earned' : ''}`} aria-hidden="true">{inner}</span>;
}

/** Salto dentro de la página sin tocar el hash (el router usa #/ruta): desplaza y deja el foco en el título. */
function goTo(headingId: string) {
  const h = document.getElementById(headingId);
  if (!h) return;
  h.setAttribute('tabindex', '-1');
  h.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  h.focus({ preventScroll: true });
}

export function Kids() {
  const [raw, setP, clearP] = useDraft<Partial<KidsProgress>>('kids', EMPTY);
  // Progreso guardado por versiones anteriores: se completa con valores vacíos y se ignoran stickers que ya no existen.
  const p: KidsProgress = { ...EMPTY, ...raw, met: raw.met ?? [], stickers: (raw.stickers ?? []).filter((id) => STICKER_IDS.has(id)) };
  const [active, setActive] = useState<Character | null>(null);
  const [waving, setWaving] = useState(false);
  const [page, setPage] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newSticker, setNewSticker] = useState<string | null>(null);

  useEffect(() => {
    if (!waving) return;
    const id = setTimeout(() => setWaving(false), 2600);
    return () => clearTimeout(id);
  }, [waving]);

  // Los efectos (sonido, anuncio) se disparan fuera del cálculo del nuevo estado.
  const earn = (ids: string[], next: KidsProgress) => {
    const add = ids.filter((id) => !next.stickers.includes(id));
    setP({ ...next, stickers: [...next.stickers, ...add] });
    if (add.length) {
      setNewSticker(add[add.length - 1]);
      sound.play('stamp');
      announce(`¡Nuevo sticker: ${STICKERS.find((x) => x.id === add[add.length - 1])?.label}!`);
    }
  };

  const helloAll = () => {
    sound.play('pop');
    setActive(null);
    setWaving(true);
    earn(['equipo'], p);
  };
  const meet = (who: Character) => {
    sound.play('tap');
    setWaving(false);
    setActive(who);
    const met = p.met.includes(who) ? p.met : [...p.met, who];
    earn(met.length === 4 ? ['amigos'] : [], { ...p, met });
  };
  const finishGame = (score: number, stars: number, mode: GameMode) => {
    const next = { ...p, games: p.games + 1, cleaned: p.cleaned + score, best: mode === 'reloj' ? Math.max(p.best, score) : p.best };
    earn([...(score > 0 ? ['juego'] : []), ...(mode === 'reloj' && stars === 3 ? ['juego-3'] : []), ...(next.cleaned >= 30 ? ['juego-30'] : [])], next);
  };

  const talking = active ? CHARACTERS.find((c) => c.id === active) : null;
  const tail = active ? CHARACTERS.findIndex((c) => c.id === active) : -1;
  const earnedCount = STICKERS.filter((s) => p.stickers.includes(s.id)).length;

  return (
    <section className="page kids">
      <div className="kids-hero">
        <div className="kids-hero-copy">
          <p className="eyebrow">Brisa Chicos · para chicas y chicos (y sus familias)</p>
          <h1 tabIndex={-1} data-page-title>Sonrisas valientes</h1>
          <p className="lede">Conocé a los Brisitos, cazá bichitos en el juego, leé cómo es la primera visita y cepillate dos minutos con nosotros. Todo es para jugar y aprender: no reemplaza lo que te diga tu odontóloga.</p>
          <div className="row wrap">
            <Button variant="primary" size="lg" icon="sparkle" onClick={() => goTo('game-title')}>Jugar a limpiar la sonrisa</Button>
            <Button size="lg" icon="clock" onClick={() => goTo('brush-title')}>Cepillarme con el reloj</Button>
            <Button size="lg" variant="ghost" icon="book" onClick={() => goTo('story-title')}>Leer el cuento</Button>
          </div>
        </div>
        <div className="brisitos" role="group" aria-labelledby="meet">
          <h2 id="meet" className="sr-only">Los Brisitos</h2>
          <div className={`brisitos-bubble ${talking ? 'has-tail' : ''}`} style={{ ['--tail' as string]: `${((tail + 0.5) / 4) * 100}%` }} aria-live="polite">
            {talking ? <><p className="bubble-who"><strong>{talking.name}</strong> · {talking.tooth}</p><p className="bubble-line">{talking.line}</p><p className="small bubble-bio">{talking.bio}</p></>
              : waving ? <p className="bubble-line">¡Los cuatro te saludan!</p>
              : <p className="bubble-line">Tocá a un Brisito para conocerlo, o saludá a todos juntos.</p>}
          </div>
          <ul className={`brisitos-stage ${waving ? 'is-waving' : ''}`}>
            {CHARACTERS.map((c, i) => (
              <li key={c.id} className={`brisito is-${c.id} ${active === c.id ? 'is-active' : ''}`} style={{ ['--i' as string]: i }}>
                {waving && <span className="hello-bubble" aria-hidden="true">¡Hola!</span>}
                <button type="button" className="brisito-btn" aria-pressed={active === c.id} onClick={() => meet(c.id)} aria-label={`Conocer a ${c.name.split(' ')[1]}`}>
                  <ToothCharacter who={c.id} mood={waving ? 'feliz' : active === c.id ? 'sorpresa' : IDLE_MOOD[c.id]} size={120} />
                </button>
                <span className="brisito-name" aria-hidden="true">{c.name.split(' ')[1]}</span>
              </li>
            ))}
          </ul>
          <div className="brisitos-actions">
            <Button variant="primary" icon="smile" onClick={helloAll}>¡Hola, Brisitos!</Button>
            <span className="small muted tabular">Conociste a {p.met.length} de 4</span>
          </div>
        </div>
      </div>

      <SmileGame best={p.best} round={p.games} onFinish={finishGame} />

      <BrushTimer onDone={() => { const brushed = p.brushed + 1; earn(brushed >= 3 ? ['cepillado', 'cepillado-3'] : ['cepillado'], { ...p, brushed }); }} brushed={p.brushed} />

      <section id="cuento" aria-labelledby="story-title" className="story card">
        <div className="story-art" aria-hidden="true"><ToothCharacter who={STORY[page].who} mood={STORY[page].mood} size={170} /></div>
        <div className="stack">
          <p className="eyebrow">Cuento · paso {page + 1} de {STORY.length}</p>
          <h2 id="story-title">{STORY[page].title}</h2>
          <p className="story-text" aria-live="polite">{STORY[page].text}</p>
          <div className="story-dots" aria-hidden="true">{STORY.map((_, i) => <span key={i} className={i === page ? 'on' : ''} />)}</div>
          <div className="row wrap">
            <Button icon="back" disabled={page === 0} onClick={() => { setPage(page - 1); sound.play('tap'); }}>Anterior</Button>
            {page < STORY.length - 1
              ? <Button variant="primary" onClick={() => { setPage(page + 1); sound.play('tap'); }}>Siguiente <Icon name="arrow" size={16} /></Button>
              : <Button variant="primary" onClick={() => { earn(['cuento'], p); setPage(0); }}>Terminar el cuento</Button>}
          </div>
        </div>
      </section>

      <section aria-labelledby="album" className="stack">
        <div className="section-title">
          <h2 id="album">Mi álbum de stickers</h2>
          <span className="row wrap"><span className="muted small tabular">{earnedCount} de {STICKERS.length}</span><Button size="sm" variant="ghost" icon="refresh" onClick={() => setConfirmReset(true)}>Vaciar álbum</Button></span>
        </div>
        <ul className="album">
          {STICKERS.map((s) => {
            const earned = p.stickers.includes(s.id);
            return (
              <li key={s.id} className={`album-slot ${earned ? 'is-earned' : ''} ${newSticker === s.id ? 'is-new' : ''}`}>
                <StickerArt id={s.id} earned={earned} />
                <strong>{earned ? s.label : '¿Cuál será?'}</strong>
                <span className="small muted">{earned ? '¡Conseguido!' : s.how}</span>
              </li>
            );
          })}
        </ul>
        <p className="small muted" style={{ margin: 0 }}>Los stickers son privados, quedan solo en este dispositivo y no se canjean por nada. No hay ranking ni rachas.</p>
      </section>

      <section className="card sand stack" aria-labelledby="family">
        <h2 id="family">Para madres, padres y responsables</h2>
        <p style={{ margin: 0 }}>Desde el portal podés gestionar los turnos de tus dependientes: en esta demo, Carla (P-003) es responsable de Tomás (P-004) y Lola (P-005). Cada persona tiene sus propios turnos.</p>
        <div className="row wrap">
          <Button variant="primary" icon="calendar" onClick={() => navigate('/reservar')}>Pedir un turno</Button>
          <Button icon="list" onClick={() => navigate('/mis-turnos')}>Ver turnos de la familia</Button>
        </div>
        <Notice tone="info" title="Contenido general">Los consejos de esta sección son generales y para jugar. Lo que necesita cada chico o chica lo define su odontóloga en la consulta. El juego no mide ni evalúa el cepillado real.</Notice>
      </section>

      <ConfirmDialog open={confirmReset} title="¿Vaciar el álbum?" confirmLabel="Vaciar" onCancel={() => setConfirmReset(false)} onConfirm={() => { clearP(); setNewSticker(null); setActive(null); setConfirmReset(false); announce('Álbum vacío. ¡A juntar stickers de nuevo!'); }}>
        Se quitan los stickers, el récord del juego y el contador de cepillados de este dispositivo. No afecta turnos ni datos de la clínica.
      </ConfirmDialog>
    </section>
  );
}

// Ubicación de los 12 dientes del tablero (coordenadas del dibujo de la boca, 600 × 340).
const SLOTS = Array.from({ length: GAME_TEETH }, (_, i) => {
  const half = GAME_TEETH / 2;
  const upper = i < half;
  const k = upper ? i : i - half;
  const x = 165 + k * 54;
  const dx = (x - 300) / 135;
  return { upper, n: k + 1, x, y: upper ? 114 + 12 * dx * dx : 262 - 12 * dx * dx };
});

function SmileGame({ best, round, onFinish }: { best: number; round: number; onFinish: (score: number, stars: number, mode: GameMode) => void }) {
  const [mode, setMode] = useDraft<GameMode>('kids:game-mode', 'reloj');
  const [g, act] = useReducer(gameReducer, mode, initialGame);
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);
  const board = useRef<HTMLDivElement>(null);

  // El intervalo solo avanza el juego; los efectos reaccionan al estado nuevo.
  useEffect(() => {
    if (g.phase !== 'playing') return;
    const id = setInterval(() => act({ type: 'tick' }), TICK_MS);
    return () => clearInterval(id);
  }, [g.phase]);

  const prevPhase = useRef(g.phase);
  useEffect(() => {
    if (prevPhase.current === 'playing' && g.phase === 'done') {
      const stars = starsFor(g.mode, g.score);
      sound.play(stars > 0 ? 'fanfare' : 'success');
      announce(`Fin del juego: limpiaste ${g.score} bichito${g.score === 1 ? '' : 's'}. ${stars} estrella${stars === 1 ? '' : 's'}.`);
      finishRef.current(g.score, stars, g.mode);
    }
    prevPhase.current = g.phase;
  }, [g.phase, g.mode, g.score]);

  const playing = g.phase === 'playing';
  const done = g.phase === 'done';
  const stars = starsFor(g.mode, g.score);
  const germs = Object.keys(g.germs).map(Number);
  const pct = g.mode === 'reloj' ? ((GAME_TICKS - g.tick) / GAME_TICKS) * 100 : (g.score / CALM_GOAL) * 100;

  const start = () => {
    sound.play('tap');
    act({ type: 'start', mode, round });
    announce(mode === 'reloj' ? '¡A jugar! Tenés 30 segundos.' : `¡A jugar sin apuro! Limpiá ${CALM_GOAL} bichitos.`);
  };
  const brush = (i: number) => {
    if (!(i in g.germs)) return;
    sound.play('pop');
    act({ type: 'brush', tooth: i });
  };
  // Flechas: izquierda/derecha recorren la fila, arriba/abajo cambian de fila.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const btns = [...(board.current?.querySelectorAll<HTMLButtonElement>('.game-tooth') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const half = GAME_TEETH / 2;
    const to = e.key === 'ArrowRight' ? Math.min(GAME_TEETH - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1)
      : e.key === 'ArrowDown' ? (i < half ? i + half : i) : e.key === 'ArrowUp' ? (i >= half ? i - half : i) : -1;
    if (to < 0) return;
    e.preventDefault();
    btns[to]?.focus();
  };

  return (
    <section className="game card" aria-labelledby="game-title">
      <div className="stack game-side">
        <p className="eyebrow">Juego · ¡A limpiar la sonrisa!</p>
        <h2 id="game-title">Cazá los bichitos</h2>
        <p style={{ margin: 0 }}>Aparecen bichitos sobre los dientes. Tocá cada diente con bichito para cepillarlo antes de que se escape. Con teclado: Tab para entrar, flechas para moverte y Enter para cepillar.</p>
        <div className="field" style={{ maxWidth: 300 }}>
          <label htmlFor="game-mode">Ritmo</label>
          <select id="game-mode" value={mode} disabled={playing} onChange={(e) => setMode(e.target.value as GameMode)}>
            <option value="reloj">Con reloj (30 segundos)</option>
            <option value="tranquilo">Sin apuro (sin reloj)</option>
          </select>
        </div>
        <dl className="game-hud">
          <div><dt>Puntos</dt><dd className="tabular">{g.score}</dd></div>
          <div><dt>{g.mode === 'reloj' ? 'Tiempo' : 'Meta'}</dt><dd className="tabular">{g.mode === 'reloj' ? `${secondsLeft(g)} s` : `${g.score} de ${CALM_GOAL}`}</dd></div>
          <div><dt>Récord</dt><dd className="tabular">{best}</dd></div>
        </dl>
        <div className="game-time" aria-hidden="true"><span style={{ inlineSize: `${pct}%` }} /></div>
        <div className="row wrap">
          <Button variant={playing ? 'secondary' : 'primary'} icon={playing ? 'pause' : 'play'} onClick={playing ? () => act({ type: 'stop' }) : start}>{playing ? 'Terminar' : done ? 'Jugar otra vez' : 'Empezar a jugar'}</Button>
        </div>
      </div>
      <div className="game-stage">
        <div className={`game-board ${playing ? 'is-playing' : ''}`} ref={board} role="group" aria-label="Boca del juego: 6 dientes arriba y 6 abajo" onKeyDown={onKey}>
          <GameMouth />
          {SLOTS.map((sl, i) => {
            const dirty = i in g.germs;
            return (
              <button key={i} type="button" className={`game-tooth ${dirty ? 'is-dirty' : ''}`} disabled={!playing}
                style={{ left: `${(sl.x / 600) * 100}%`, top: `${(sl.y / 340) * 100}%` }}
                aria-label={`Diente ${sl.n} de ${sl.upper ? 'arriba' : 'abajo'}${dirty ? ': ¡tiene un bichito!' : ''}`} onClick={() => brush(i)}>
                <KidTooth lower={!sl.upper} shine={g.lastClean === i} />
                {dirty && <span className="germ-wrap"><Germ variant={g.germs[i] % 3} /></span>}
                {g.lastClean === i && <span key={g.cleans} className="clean-fx" aria-hidden="true" />}
              </button>
            );
          })}
          {!playing && (
            <div className="game-overlay">
              {done ? (
                <div className="game-result">
                  <p className="game-stars" aria-label={`${stars} de 3 estrellas`}>{[0, 1, 2].map((k) => <StarArt key={k} filled={k < stars} />)}</p>
                  <p className="game-result-title">{stars === 3 ? '¡Sonrisa brillante!' : stars === 2 ? '¡Muy bien!' : stars === 1 ? '¡Buen comienzo!' : '¡Se escaparon todos!'}</p>
                  <p className="small" style={{ margin: 0 }}>Limpiaste <span className="tabular">{g.score}</span> bichito{g.score === 1 ? '' : 's'}{g.mode === 'reloj' && g.escaped > 0 ? ` · se escaparon ${g.escaped}` : ''}.</p>
                </div>
              ) : <p className="game-result-title">¿Listo? Tocá “Empezar a jugar”.</p>}
            </div>
          )}
        </div>
        <p className="sr-only" aria-live="polite">{playing ? (germs.length ? `Bichitos en: ${germs.map((i) => `diente ${SLOTS[i].n} de ${SLOTS[i].upper ? 'arriba' : 'abajo'}`).join(', ')}` : 'Sin bichitos por ahora') : ''}</p>
        <div className={`game-coach ${done && stars > 0 ? 'is-happy' : ''}`} aria-hidden="true"><ToothCharacter who="coco" mood={done && stars > 0 ? 'feliz' : 'valiente'} size={96} /></div>
      </div>
    </section>
  );
}

function BrushTimer({ onDone, brushed }: { onDone: () => void; brushed: number }) {
  const [total, setTotal] = useDraft('kids:duration', 120);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  // El intervalo solo avanza el reloj; los efectos (sonido, sticker) reaccionan al valor nuevo.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => Math.min(total, e + 1)), 1000);
    return () => clearInterval(id);
  }, [running, total]);

  useEffect(() => {
    if (!running || elapsed === 0) return;
    const zoneLen = total / 4;
    if (elapsed >= total) {
      setRunning(false);
      sound.play('fanfare');
      announce('¡Listo! Terminaste el cepillado.');
      doneRef.current();
    } else if (elapsed % zoneLen === 0) {
      sound.play('success');
      announce(`Ahora: ${ZONES[elapsed / zoneLen]}`);
    } else if (elapsed % 5 === 0) sound.play('tick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const zone = Math.min(3, Math.floor(elapsed / (total / 4)));
  const left = total - elapsed;
  const r = 70; const circ = 2 * Math.PI * r;
  const finished = elapsed >= total;
  return (
    <section id="cepillado" className="brush card" aria-labelledby="brush-title">
      <div className="stack">
        <p className="eyebrow">Juego · cepillado guiado</p>
        <h2 id="brush-title">Dos minutos con Coco</h2>
        <p style={{ margin: 0 }}>Cepillá cada zona de tu boca mientras avanza el reloj. Cambiamos de zona cada {total / 4} segundos.</p>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="brush-len">Duración</label>
          <select id="brush-len" value={total} disabled={running} onChange={(e) => { setTotal(Number(e.target.value)); setElapsed(0); }}>
            <option value={120}>2 minutos</option>
            <option value={20}>Demo rápida (20 segundos)</option>
          </select>
        </div>
        <div className="row wrap">
          {!running
            ? <Button variant="primary" icon="play" onClick={() => { sound.play('tap'); if (finished) setElapsed(0); setRunning(true); announce(`Empezamos: ${ZONES[finished ? 0 : zone]}`); }}>{elapsed > 0 && !finished ? 'Seguir' : 'Empezar'}</Button>
            : <Button icon="pause" onClick={() => setRunning(false)}>Pausar</Button>}
          <Button variant="ghost" icon="refresh" onClick={() => { setRunning(false); setElapsed(0); }} disabled={elapsed === 0}>Reiniciar</Button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Cepillados completos en este dispositivo: <span className="tabular">{brushed}</span>.</p>
      </div>
      <div className="brush-visual">
        <svg viewBox="0 0 180 180" width="180" height="180" className="brush-ring" role="img" aria-label={finished ? 'Terminado' : `Quedan ${left} segundos`}>
          <circle cx="90" cy="90" r={r} fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="12" />
          <circle cx="90" cy="90" r={r} fill="none" style={{ stroke: 'var(--primary-fill)' }} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - elapsed / total)} transform="rotate(-90 90 90)" />
          <text x="90" y="98" textAnchor="middle" fontFamily="'Source Sans 3', sans-serif" fontWeight="700" fontSize="30" style={{ fill: 'var(--ink)' }}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</text>
        </svg>
        <div className={`brush-char ${running ? 'is-brushing' : ''}`}><ToothCharacter who="coco" mood={finished ? 'feliz' : 'valiente'} size={110} /></div>
        <ol className="zones" aria-label="Zonas de la boca">
          {ZONES.map((z, i) => <li key={z} className={!finished && i === zone && (running || elapsed > 0) ? 'on' : i < zone || finished ? 'done' : ''}>{i < zone || finished ? <Icon name="check" size={14} /> : <span className="zone-n">{i + 1}</span>} {z}</li>)}
        </ol>
        <p className="zone-now">{finished ? '¡Listo! Ganaste un sticker.' : running || elapsed > 0 ? `Ahora: ${ZONES[zone]}` : 'Tocá Empezar cuando tengas el cepillo.'}</p>
      </div>
    </section>
  );
}
