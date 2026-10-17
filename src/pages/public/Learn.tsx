import { useEffect, useRef, useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { LEARNING_CARDS, type LearningState } from '../../domain';
import { ratioText } from '../../domain/selectors';
import { Button, ConfirmDialog, Icon, Notice, PageHeader, StatusBadge, announce } from '../../ui/kit';

const STATE_LABEL: Record<LearningState, string> = { nuevo: 'Nueva', en_curso: 'En curso', comprendido: 'Comprendida', completo: 'Sello guardado' };
const STATE_TONE: Record<LearningState, string> = { nuevo: 'borrador', en_curso: 'en_curso', comprendido: 'aceptado', completo: 'realizado' };

function Seal({ earned, isNew, title }: { earned: boolean; isNew: boolean; title: string }) {
  return (
    <li className={`seal-slot ${earned ? 'is-earned' : ''} ${isNew ? 'is-new' : ''}`}>
      <svg className="seal-svg" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="ring" cx="24" cy="24" r="20" />
        {earned && <path className="mark" d="M15 25l6 6 12-13" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <span>{title}</span>
      <span className="sr-only">{earned ? 'sello guardado' : 'sin sello todavía'}</span>
    </li>
  );
}

export function Learn() {
  const s = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { correct: boolean; text: string }>>({});
  const [justEarned, setJustEarned] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const progress = (id: string) => s.learning.find((l) => l.cardId === id);
  const opened = s.learning.filter((l) => l.opens > 0 || l.state !== 'nuevo').length;
  const understood = s.learning.filter((l) => l.state === 'comprendido' || l.state === 'completo').length;
  const completed = s.learning.filter((l) => l.state === 'completo').length;
  const lastFeedback = open ? feedback[open] : undefined;

  // Tras responder, el foco va a la explicación para que se lea antes de seguir (teclado y lector de pantalla).
  useEffect(() => { if (lastFeedback) feedbackRef.current?.focus(); }, [lastFeedback]);

  return (
    <section className="page">
      <PageHeader eyebrow="M15 · Exploración voluntaria" title="Tu primera visita, con claridad" actions={<Button variant="ghost" icon="refresh" onClick={() => setConfirmReset(true)}>Reiniciar colección</Button>}>
        Tres situaciones administrativas para entender cómo funciona la clínica. Es opcional: no hay ranking, rachas, premios ni descuentos, y no cambia tus turnos. La guía de cada tarjeta se puede leer sin jugar.
      </PageHeader>

      <div className="collection" aria-labelledby="col-title">
        <div>
          <h2 id="col-title" style={{ fontSize: 20, margin: 0 }}>Tu colección: <span className="tabular">{completed} de {LEARNING_CARDS.length}</span> sellos</h2>
          <p className="small muted" style={{ margin: 0 }}>Comprendidas {understood} de {opened} abiertas ({ratioText({ num: understood, den: opened, label: '', detail: '' })}). Privado, guardado en este dispositivo.</p>
        </div>
        <ul className="collection-slots" aria-label="Sellos">
          {LEARNING_CARDS.map((c) => <Seal key={c.id} earned={progress(c.id)?.state === 'completo'} isNew={justEarned === c.id} title={c.title} />)}
        </ul>
      </div>

      <div className="cards">
        {LEARNING_CARDS.map((card) => {
          const p = progress(card.id);
          const state = p?.state ?? 'nuevo';
          const isOpen = open === card.id;
          const fb = feedback[card.id];
          const done = state === 'completo';
          return (
            <article key={card.id} className={`card learn-card ${done ? 'is-complete' : ''}`} aria-labelledby={`lc-${card.id}`}>
              <div className="row between">
                <h2 id={`lc-${card.id}`} style={{ fontSize: 22, margin: 0 }}>{card.title}</h2>
                {done ? <span className="seal"><Icon name="check" size={14} /> Sello guardado</span> : <StatusBadge status={STATE_TONE[state]} label={STATE_LABEL[state]} />}
              </div>
              <p style={{ margin: 0 }}>{card.situation}</p>
              {!isOpen ? (
                <Button variant={done ? 'secondary' : 'primary'} onClick={() => { setOpen(card.id); dispatch({ type: 'learningOpen', cardId: card.id }); }} aria-label={`${done ? 'Releer' : state === 'nuevo' ? 'Empezar' : 'Continuar'} la tarjeta ${card.title}`}>
                  {done ? 'Releer' : state === 'nuevo' ? 'Empezar' : 'Continuar'}
                </Button>
              ) : (
                <div className="stack">
                  {done && <Notice tone="info" title="Relectura">Tu sello ya está guardado; volver a responder no suma ni quita nada.</Notice>}
                  <fieldset>
                    <legend>{card.question}</legend>
                    <div className="option-list">
                      {card.options.map((o, i) => (
                        <button key={o.id} type="button" className="option" aria-pressed={p?.lastChoiceId === o.id} onClick={() => {
                          const r = dispatch({ type: 'learningAnswer', cardId: card.id, choiceId: o.id });
                          if (r.ok) { setFeedback((f) => ({ ...f, [card.id]: { correct: o.correct, text: o.feedback } })); announce(o.correct ? 'Respuesta correcta.' : 'Podés intentar otra opción.'); }
                        }}><span className="opt-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{o.label}</span></button>
                      ))}
                    </div>
                  </fieldset>
                  {fb && (
                    <div ref={feedbackRef} tabIndex={-1} className="feedback">
                      <Notice tone={fb.correct ? 'ok' : 'info'} title={fb.correct ? 'Bien visto' : 'Todavía no: probá otra opción'}>{fb.text}</Notice>
                    </div>
                  )}
                  {fb?.correct && <p style={{ margin: 0 }}>{card.explanation}</p>}
                  <div className="row wrap">
                    {state === 'comprendido' && <Button variant="primary" icon="check" onClick={() => { const r = dispatch({ type: 'learningComplete', cardId: card.id }); if (r.ok) setJustEarned(card.id); announce(r.message); }}>Guardar sello</Button>}
                    <Button variant="ghost" onClick={() => setOpen(null)}>Cerrar tarjeta</Button>
                  </div>
                </div>
              )}
              <details>
                <summary>Ver la guía sin jugar</summary>
                <ul className="plain">{card.guide.map((g) => <li key={g}>{g}</li>)}</ul>
                <p className="small muted">{card.explanation}</p>
              </details>
            </article>
          );
        })}
      </div>
      <Notice tone="info" title="Sobre esta colección">Los sellos son privados y quedan solo en este dispositivo. No miden salud, no se canjean y no se relacionan con tratamientos ni ventas. Tampoco son obligatorios para usar el portal.</Notice>
      <ConfirmDialog open={confirmReset} title="¿Reiniciar la colección?" confirmLabel="Reiniciar" onCancel={() => setConfirmReset(false)} onConfirm={() => { dispatch({ type: 'learningReset' }); setFeedback({}); setOpen(null); setJustEarned(null); setConfirmReset(false); announce('Colección reiniciada.'); }}>
        Las tres tarjetas vuelven a “Nueva” y los sellos se quitan. No afecta turnos ni datos de la clínica.
      </ConfirmDialog>
    </section>
  );
}
