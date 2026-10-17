import { useEffect, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { useDraft } from '../../app/ui-state';
import { CHARACTERS, ToothCharacter, type Character, type Mood } from '../../ui/art/characters';
import { ToothArt } from '../../ui/art/teeth';
import { Button, ConfirmDialog, Icon, Notice, announce } from '../../ui/kit';
import { sound } from '../../ui/sound';

interface KidsProgress { stickers: string[]; brushed: number; greeted: Character[] }
const EMPTY: KidsProgress = { stickers: [], brushed: 0, greeted: [] };

const STICKERS: { id: string; label: string; how: string }[] = [
  { id: 'saludo-mora', label: 'Muela Mora', how: 'Saludá a Mora' },
  { id: 'saludo-coco', label: 'Colmillo Coco', how: 'Saludá a Coco' },
  { id: 'saludo-ivo', label: 'Incisivo Ivo', how: 'Saludá a Ivo' },
  { id: 'saludo-lia', label: 'Dientecito Lía', how: 'Saludá a Lía' },
  { id: 'equipo', label: 'Equipo completo', how: 'Conocé a los cuatro' },
  { id: 'cuento', label: 'Cuento leído', how: 'Terminá el cuento de la primera visita' },
  { id: 'cepillado', label: 'Primer cepillado', how: 'Completá un cepillado con el reloj' },
  { id: 'cepillado-3', label: 'Diente de oro', how: 'Completá tres cepillados' },
];

const STORY: { who: Character; mood: Mood; title: string; text: string }[] = [
  { who: 'ivo', mood: 'feliz', title: 'Llegamos a la clínica', text: 'Te recibe una persona de recepción que anota tu nombre. Podés venir con quien te cuida.' },
  { who: 'lia', mood: 'sorpresa', title: 'La sala de espera', text: 'Esperás un ratito. Si tenés preguntas, ¡hacelas! Nadie se enoja por preguntar.' },
  { who: 'mora', mood: 'valiente', title: 'El sillón que sube y baja', text: 'Te sentás en un sillón especial con una luz. La odontóloga te cuenta qué va a hacer antes de hacerlo.' },
  { who: 'coco', mood: 'guino', title: 'Contamos los dientes', text: 'Mira tus dientes con un espejito. Si algo te incomoda, levantás la mano y para.' },
  { who: 'ivo', mood: 'feliz', title: '¡Listo!', text: 'Al terminar te explican los próximos pasos a vos y a tu familia. ¡Lo hiciste muy bien!' },
];

const ZONES = ['Arriba a la derecha', 'Arriba a la izquierda', 'Abajo a la izquierda', 'Abajo a la derecha'];

function StickerArt({ id, earned }: { id: string; earned: boolean }) {
  const inner = id.startsWith('saludo-') ? <ToothCharacter who={id.slice(7) as Character} mood="feliz" size={52} />
    : id === 'equipo' ? <ToothCharacter who="mora" mood="guino" size={52} />
    : id === 'cuento' ? <ToothCharacter who="ivo" mood="sorpresa" size={52} />
    : id === 'cepillado' ? <ToothCharacter who="coco" mood="valiente" size={52} />
    : <ToothArt kind="molar" state="corona_oro" width={40} />;
  return <span className={`sticker ${earned ? 'is-earned' : ''}`} aria-hidden="true">{inner}</span>;
}

export function Kids() {
  const [p, setP, clearP] = useDraft<KidsProgress>('kids', EMPTY);
  const [waving, setWaving] = useState<Character | null>(null);
  const [page, setPage] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newSticker, setNewSticker] = useState<string | null>(null);

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

  const greet = (who: Character) => {
    sound.play('pop');
    setWaving(who);
    const greeted = p.greeted.includes(who) ? p.greeted : [...p.greeted, who];
    earn([`saludo-${who}`, ...(greeted.length === 4 ? ['equipo'] : [])], { ...p, greeted });
  };

  return (
    <section className="page kids">
      <div className="kids-hero">
        <div>
          <p className="eyebrow">Brisa Chicos · para chicas y chicos (y sus familias)</p>
          <h1 tabIndex={-1} data-page-title>Sonrisas valientes</h1>
          <p className="lede">Conocé a los Brisitos, leé cómo es la primera visita y cepillate dos minutos con nosotros. Todo es para jugar y aprender: no reemplaza lo que te diga tu odontóloga.</p>
          <div className="row wrap">
            <a className="btn btn-primary btn-lg" href="#cepillado"><Icon name="clock" /> Cepillarme con el reloj</a>
            <a className="btn btn-lg" href="#cuento"><Icon name="book" /> Leer el cuento</a>
          </div>
        </div>
        <div className="kids-hero-art" aria-hidden="true">
          <ToothCharacter who="mora" mood="feliz" size={150} className="float-a" />
          <ToothCharacter who="lia" mood="guino" size={110} className="float-b" />
          <ToothCharacter who="ivo" mood="feliz" size={130} className="float-c" />
        </div>
      </div>

      <section aria-labelledby="meet" className="stack">
        <div className="section-title"><h2 id="meet">Conocé a los Brisitos</h2><span className="muted small tabular">{p.greeted.length} de 4 saludados</span></div>
        <div className="kids-grid">
          {CHARACTERS.map((c) => (
            <article key={c.id} className={`kid-card ${waving === c.id ? 'is-waving' : ''}`}>
              <ToothCharacter who={c.id} mood={waving === c.id ? 'guino' : p.greeted.includes(c.id) ? 'feliz' : 'sorpresa'} size={120} title={`${c.name}, ${waving === c.id ? 'te guiña un ojo' : 'te mira'}`} />
              <h3>{c.name}</h3>
              <p className="kid-tooth">{c.tooth}</p>
              <p>{c.bio}</p>
              <Button variant={p.greeted.includes(c.id) ? 'secondary' : 'primary'} onClick={() => greet(c.id)}>{p.greeted.includes(c.id) ? `¡Hola otra vez, ${c.name.split(' ')[1]}!` : `Saludar a ${c.name.split(' ')[1]}`}</Button>
            </article>
          ))}
        </div>
      </section>

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

      <BrushTimer onDone={() => { const brushed = p.brushed + 1; earn(brushed >= 3 ? ['cepillado', 'cepillado-3'] : ['cepillado'], { ...p, brushed }); }} brushed={p.brushed} />

      <section aria-labelledby="album" className="stack">
        <div className="section-title">
          <h2 id="album">Mi álbum de stickers</h2>
          <span className="row wrap"><span className="muted small tabular">{p.stickers.length} de {STICKERS.length}</span><Button size="sm" variant="ghost" icon="refresh" onClick={() => setConfirmReset(true)}>Vaciar álbum</Button></span>
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
        <Notice tone="info" title="Contenido general">Los consejos de esta sección son generales y para jugar. Lo que necesita cada chico o chica lo define su odontóloga en la consulta.</Notice>
      </section>

      <ConfirmDialog open={confirmReset} title="¿Vaciar el álbum?" confirmLabel="Vaciar" onCancel={() => setConfirmReset(false)} onConfirm={() => { clearP(); setNewSticker(null); setConfirmReset(false); announce('Álbum vacío. ¡A juntar stickers de nuevo!'); }}>
        Se quitan los stickers y el contador de cepillados de este dispositivo. No afecta turnos ni datos de la clínica.
      </ConfirmDialog>
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
          <circle cx="90" cy="90" r={r} fill="none" stroke="#e9deca" strokeWidth="12" />
          <circle cx="90" cy="90" r={r} fill="none" stroke="#2f8f86" strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - elapsed / total)} transform="rotate(-90 90 90)" />
          <text x="90" y="98" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="30" fill="#173c3a">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</text>
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
