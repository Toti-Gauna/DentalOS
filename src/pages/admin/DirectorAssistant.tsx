// Asistente de dirección (lote 6 · 6G/6I): reglas sobre el store, respuesta breve "en streaming" e interrumpible.
// Explica cada cálculo, pide los datos que faltan y como mucho crea un borrador. Nunca activa una campaña.
import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { DIRECTOR_QUESTIONS, detectDirectorIntent, directorAnswer, type DirectorAnswer, type DirectorIntent } from '../../domain/assistant';
import { SEGMENTS, emptyEconomics } from '../../domain/campaigns';
import { Button, Icon, announce } from '../../ui/kit';
import { useStreamedText } from '../../ui/Stream';
import { MISSING_FIELD } from './Campaigns';

export function DirectorAssistant({ campaignId, onCreated }: { campaignId: string | null; onCreated: (id: string) => void }) {
  const s = useDemo();
  const [asked, setAsked] = useState<{ n: number; q: string; intent: DirectorIntent } | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const ask = (q: string, intent: DirectorIntent) => {
    setNote(null);
    setAsked((a) => ({ n: (a?.n ?? 0) + 1, q, intent }));
    announce('El asistente está respondiendo con los datos de la demo.');
  };
  const createDraft = () => {
    const seg = SEGMENTS.find((x) => x.id === 'controles_pendientes')!;
    const r = dispatch({ type: 'campaignCreate', input: { name: seg.label, kind: 'segmentada', trigger: 'manual', cadence: 'unica', segmentIds: [seg.id], personId: null, templateId: seg.templateId, extraNote: '', serviceTypeId: seg.serviceTypeId, scheduledFor: null, economics: emptyEconomics() } });
    setNote(r.message); announce(r.message);
    if (r.ok) onCreated(r.ids!.campaignId);
  };
  const goTo = (label: string) => {
    const el = document.getElementById(MISSING_FIELD[label] ?? '');
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); } else announce('Ese dato se carga en Preferencias de contacto, más abajo.');
  };

  return (
    <section className="card stack assistant" aria-labelledby="asst-title">
      <div className="row between wrap">
        <h2 id="asst-title" style={{ fontSize: 20, margin: 0 }}><Icon name="sparkle" size={18} /> Asistente de dirección</h2>
        <span className="tag">Determinista · sin IA · datos de la demo</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Responde con reglas sobre el estado local{campaignId ? <> · campaña elegida: <strong className="tabular">{campaignId}</strong></> : ''}. Si falta un dato lo marca como ND y te lo pide. Puede dejar un borrador, nunca activarlo.</p>
      <div className="row wrap" role="group" aria-label="Preguntas frecuentes">
        {DIRECTOR_QUESTIONS.map((q) => <button key={q.intent} type="button" className="chip" onClick={() => ask(q.label, q.intent)}>{q.label}</button>)}
      </div>
      <form className="row wrap asst-form" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; ask(text.trim(), detectDirectorIntent(text)); setText(''); }}>
        <label htmlFor="asst-q" className="sr-only">Preguntale al asistente</label>
        <input id="asst-q" value={text} maxLength={200} placeholder="Por ejemplo: ¿cuánto cuesta esta campaña?" onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <Button type="submit" icon="arrow">Preguntar</Button>
      </form>
      {asked && <Answer key={asked.n} n={asked.n} q={asked.q} answer={directorAnswer(s, asked.intent, campaignId)} onCreate={createDraft} onMissing={goTo} note={note} />}
    </section>
  );
}

function Answer({ n, q, answer, onCreate, onMissing, note }: { n: number; q: string; answer: DirectorAnswer; onCreate: () => void; onMissing: (label: string) => void; note: string | null }) {
  const body = [answer.title, ...answer.paragraphs].join('\n\n');
  const st = useStreamedText(body, n);
  const done = !st.streaming && !st.interrupted;
  return (
        <div className="asst-answer" aria-busy={st.streaming}>
          <p className="asst-q small muted"><span className="sr-only">Pregunta: </span>“{q}”</p>
          {st.thinking ? <p className="asst-thinking" aria-hidden="true"><span className="dot" /><span className="dot" /><span className="dot" /> Pensando con los datos de la demo…</p> : (
            <div className="asst-text" aria-hidden={st.streaming || undefined}>
              {st.shown.split('\n\n').map((p, i) => (i === 0 ? <p key={i} className="asst-title">{p}</p> : <p key={i}>{p}</p>))}
            </div>
          )}
          {st.streaming && <Button size="sm" variant="ghost" icon="stop" onClick={() => { st.stop(); announce('Respuesta detenida.'); }}>Detener</Button>}
          {st.interrupted && <p className="small muted row wrap">Respuesta detenida. <Button size="sm" variant="ghost" onClick={st.finish}>Ver completa</Button></p>}
          {done && <div className="sr-only" aria-live="polite">{body}</div>}
          {done && answer.missing.length > 0 && (
            <div className="stack">
              <p className="small" style={{ margin: 0 }}><strong>Datos que faltan:</strong></p>
              <ul className="row wrap plain">{answer.missing.map((m) => <li key={m}><button type="button" className="chip" onClick={() => onMissing(m)}>{m}</button></li>)}</ul>
            </div>
          )}
          {done && answer.action === 'crear_borrador_controles' && <Button icon="plus" onClick={onCreate}>Crear borrador (no se activa)</Button>}
          {note && <p className="small" role="status">{note}</p>}
        </div>
  );
}
