import { Fragment, useEffect, useRef, useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { activeReplies } from '../../domain';
import { byId, personLabel, upcomingFor } from '../../domain/selectors';
import { fmtDateOnly, fmtShort, parts } from '../../domain/time';
import { Button, Icon, Notice, PageHeader, StatusBadge, announce } from '../../ui/kit';
import { TurnoCard, agendaLink } from '../../ui/components';
import { PageArt } from '../../ui/art/pages';
import { BrandMark } from '../../ui/art/brand';

export function WhatsApp() {
  const s = useDemo();
  const [convId, setConvId] = useDraft('wa:conv', 'C-001');
  const [text, setText] = useDraft('wa:text', '');
  const [hint, setHint] = useState<string | null>(null);
  const conv = byId(s.conversations, convId) ?? s.conversations[0];
  const logRef = useRef<HTMLDivElement>(null);
  const msgs = conv ? s.messages.filter((m) => m.conversationId === conv.id) : [];
  const replies = conv ? activeReplies(s, conv.id) : [];
  const openRequests = conv ? s.requests.filter((r) => (r.status === 'pendiente' || r.status === 'asignada') && (!conv.personId || r.personId === conv.personId)) : [];

  useEffect(() => {
    if (conv) dispatch({ commandId: `open:${conv.id}:r${s.revision}`, type: 'chatOpen', conversationId: conv.id });
    // Solo al cambiar de conversación: revalida el historial contra el estado actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.id]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs.length]);

  if (!conv) return <section className="page"><PageHeader title="WhatsApp simulado" /><Notice tone="info" title="No hay conversaciones en este preset." /></section>;

  const send = () => {
    const r = dispatch({ commandId: `chat:${conv.id}:${msgs.length}:${text}`, type: 'chatSend', conversationId: conv.id, text });
    if (!r.ok) { setHint(r.message); return; }
    setHint(null); setText('');
    announce('Mensaje enviado (simulado). El asistente respondió.');
  };
  const choose = (replyId: string) => {
    const r = dispatch({ commandId: `reply:${conv.id}:${msgs.length}:${replyId}`, type: 'chatChoose', conversationId: conv.id, replyId });
    if (!r.ok) setHint(r.message); else { setHint(null); announce('Opción elegida. El asistente respondió.'); }
  };

  const upcoming = conv.personId ? upcomingFor(s, conv.personId) : [];
  return (
    <section className="page">
      <PageHeader eyebrow="M06 · Canal simulado" title="WhatsApp de la demo" art={<PageArt kind="chat" />}>
        Emulador local: no abre WhatsApp ni envía mensajes. Reglas de texto simples, sin IA. Todo lo que pasa acá se ve igual en recepción.
      </PageHeader>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="phone" aria-label="Emulador de WhatsApp">
          <div className="phone-head">
            <span className="chat-avatar" aria-hidden="true"><BrandMark size={30} /></span>
            <div>
              <strong>Clínica Brisa · asistente administrativo</strong>
              <small>{conv.contactLabel} · emulador local · sin envíos reales</small>
            </div>
          </div>
          <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" tabIndex={0} aria-label="Mensajes">
            {msgs.map((m, i) => {
              const day = parts(m.at).date;
              const newDay = i === 0 || parts(msgs[i - 1].at).date !== day;
              const grouped = !newDay && msgs[i - 1].from === m.from;
              const status = m.simulated === 'entregado_simulado' ? 'entregado (simulado)' : 'leído (simulado)';
              return (
                <Fragment key={m.id}>
                  {newDay && <p className="chat-day"><span>{fmtDateOnly(day)}</span></p>}
                  <div className={`bubble ${m.from}${grouped ? ' is-grouped' : ''}`}>
                    {m.from === 'sistema' && <Icon name="info" size={14} />}
                    {m.from === 'recepcion' && <span className="who">Recepción · persona</span>}
                    <span className="bubble-text">{m.text}</span>
                    <span className="stamp tabular" title={`${fmtShort(m.at)} · ${status}`}>
                      <span className="sr-only">{fmtShort(m.at)} · {status}</span>
                      <span aria-hidden="true">{parts(m.at).hhmm}{m.from === 'paciente' && <span className={`ticks${m.simulated === 'entregado_simulado' ? '' : ' is-read'}`}>✓✓</span>}</span>
                      {i < msgs.length - 1 && m.replies ? <span className="stale"> · opciones vencidas</span> : null}
                    </span>
                  </div>
                </Fragment>
              );
            })}
            {replies.length > 0 && (
              <div className="replies" role="group" aria-label="Respuestas rápidas">
                {replies.map((r) => <button key={r.id} className="reply" onClick={() => choose(r.id)}>{r.label}</button>)}
              </div>
            )}
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="wa-text" className="sr-only">Escribí un mensaje</label>
            <input id="wa-text" value={text} maxLength={500} placeholder="Escribí, por ejemplo: quiero cambiar mi turno" onChange={(e) => { setText(e.target.value); setHint(null); }} aria-describedby={hint ? 'wa-hint' : undefined} autoComplete="off" />
            <Button type="submit" variant="primary" icon="arrow" aria-label="Enviar">Enviar</Button>
          </form>
          <p id="wa-hint" className="composer-hint" role="status">{hint ?? ''}</p>
        </div>

        <aside className="stack">
          <div className="card stack">
            <div className="field">
              <label htmlFor="wa-conv">Conversación de muestra (persona por ID)</label>
              <select id="wa-conv" value={conv.id} onChange={(e) => setConvId(e.target.value)}>
                {s.conversations.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.contactLabel}</option>)}
              </select>
            </div>
            <p className="small muted">Hay dos "Martina Sosa" (P-001 y P-007): la demo no fusiona por nombre.</p>
            <div className="row wrap"><StatusBadge status={conv.status} />{conv.personId && <span className="tag">{personLabel(s, conv.personId)}</span>}</div>
            <div className="field">
              <label htmlFor="wa-req">Gestión vinculada</label>
              <select id="wa-req" value={conv.requestId ?? ''} onChange={(e) => { const r = dispatch({ type: 'chatLinkRequest', conversationId: conv.id, requestId: e.target.value || null }); announce(r.message); if (!r.ok) setHint(r.message); }}>
                <option value="">Ninguna</option>
                {openRequests.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.summary.slice(0, 48)}</option>)}
                {conv.requestId && !openRequests.some((r) => r.id === conv.requestId) && <option value={conv.requestId}>{conv.requestId} (cerrada)</option>}
              </select>
              <p className="hint">Para seguir por llamada, elegí esta misma gestión allí.</p>
            </div>
          </div>
          <div className="card stack">
            <h3>Estado actual (en vivo)</h3>
            {!conv.personId ? <p className="muted">Contacto sin identificar: el asistente no busca por nombre. Recepción identifica por ID.</p> : upcoming.length === 0 ? <p className="muted">Sin turnos activos.</p> : (
              <ul className="turno-list">
                {upcoming.map((a) => <li key={a.id}><TurnoCard a={a} extra={<a className="small" href={agendaLink(a)}>Ver en la agenda de recepción</a>} /></li>)}
              </ul>
            )}
            <p className="small muted">Los mensajes viejos son historial: no confirman nada vigente.</p>
          </div>
          <Notice tone="info" title="Probá">
            <ul className="plain">
              <li>"Hola" o "buen día": menú, sin crear nada.</li>
              <li>"Quiero cambiar mi turno" → control → mismo horario (ocupado) → alternativa → confirmar.</li>
              <li>"No quiero cancelar", "me duele", "hablar con recepción".</li>
            </ul>
          </Notice>
        </aside>
      </div>
    </section>
  );
}
