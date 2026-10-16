import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { LEARNING_CARDS } from '../../domain';
import { ratioText } from '../../domain/selectors';
import { Button, ConfirmDialog, Icon, Notice, PageHeader, StatusBadge, announce } from '../../ui/kit';

const STATE_LABEL = { nuevo: 'Nueva', en_curso: 'En curso', comprendido: 'Comprendida', completo: 'Completa' } as const;

export function Learn() {
  const s = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { correct: boolean; text: string }>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const progress = (id: string) => s.learning.find((l) => l.cardId === id);
  const opened = s.learning.filter((l) => l.opens > 0 || l.state !== 'nuevo').length;
  const understood = s.learning.filter((l) => l.state === 'comprendido' || l.state === 'completo').length;
  const completed = s.learning.filter((l) => l.state === 'completo').length;

  return (
    <section className="page">
      <PageHeader eyebrow="M15 · Exploración voluntaria" title="Tu primera visita, con claridad" actions={<Button variant="ghost" icon="refresh" onClick={() => setConfirmReset(true)}>Reiniciar colección</Button>}>
        Tres situaciones administrativas para entender cómo funciona la clínica. Es opcional: no hay ranking, rachas, premios ni descuentos, y no cambia tus turnos.
      </PageHeader>
      <p className="muted tabular">Tu colección: {completed} de {LEARNING_CARDS.length} sellos · comprendidas {understood} de {opened} abiertas ({ratioText({ num: understood, den: opened, label: '', detail: '' })}). Guardado en este dispositivo.</p>
      <div className="cards">
        {LEARNING_CARDS.map((card) => {
          const p = progress(card.id);
          const isOpen = open === card.id;
          const fb = feedback[card.id];
          const done = p?.state === 'completo';
          return (
            <article key={card.id} className="card learn-card" aria-labelledby={`lc-${card.id}`}>
              <div className="row between">
                <h2 id={`lc-${card.id}`} style={{ fontSize: 22, margin: 0 }}>{card.title}</h2>
                {done ? <span className="seal"><Icon name="check" size={14} /> Sello guardado</span> : <StatusBadge status={p?.state === 'comprendido' ? 'aceptado' : p?.state === 'en_curso' ? 'en_curso' : 'borrador'} label={STATE_LABEL[p?.state ?? 'nuevo']} />}
              </div>
              <p>{card.situation}</p>
              {!isOpen ? (
                <Button variant={done ? 'secondary' : 'primary'} onClick={() => { setOpen(card.id); dispatch({ type: 'learningOpen', cardId: card.id }); }}>{done ? 'Releer' : p?.state === 'nuevo' ? 'Empezar' : 'Continuar'}</Button>
              ) : (
                <div className="stack">
                  {done && <Notice tone="info" title="Relectura">Tu sello ya está guardado; volver a responder no suma.</Notice>}
                  <fieldset>
                    <legend>{card.question}</legend>
                    <div className="option-list">
                      {card.options.map((o) => (
                        <button key={o.id} className="option" aria-pressed={p?.lastChoiceId === o.id} onClick={() => {
                          const r = dispatch({ type: 'learningAnswer', cardId: card.id, choiceId: o.id });
                          if (r.ok) { setFeedback((f) => ({ ...f, [card.id]: { correct: o.correct, text: o.feedback } })); announce(o.feedback); }
                        }}>{o.label}</button>
                      ))}
                    </div>
                  </fieldset>
                  {fb && <Notice tone={fb.correct ? 'ok' : 'info'} title={fb.correct ? 'Bien visto' : 'Probá otra opción'}>{fb.text}</Notice>}
                  {fb?.correct && <p>{card.explanation}</p>}
                  <div className="row wrap">
                    {p?.state === 'comprendido' && <Button variant="primary" icon="check" onClick={() => { const r = dispatch({ type: 'learningComplete', cardId: card.id }); announce(r.message); }}>Guardar sello</Button>}
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
      <Notice tone="info" title="Sobre esta colección">Los sellos son privados y quedan solo en este dispositivo. No miden salud, no se canjean y no se relacionan con tratamientos ni ventas.</Notice>
      <ConfirmDialog open={confirmReset} title="¿Reiniciar la colección?" confirmLabel="Reiniciar" onCancel={() => setConfirmReset(false)} onConfirm={() => { dispatch({ type: 'learningReset' }); setFeedback({}); setOpen(null); setConfirmReset(false); announce('Colección reiniciada.'); }}>
        Las tres tarjetas vuelven a "Nueva". No afecta turnos ni datos de la clínica.
      </ConfirmDialog>
    </section>
  );
}
