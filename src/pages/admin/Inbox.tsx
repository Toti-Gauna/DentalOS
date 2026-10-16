import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import type { RequestStatus } from '../../domain';
import { byId, homonymsOf, personLabel, STATUS_LABEL, staffName } from '../../domain/selectors';
import { fmtShort, parts } from '../../domain/time';
import { Button, EmptyState, Field, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { NewAppointmentDrawer } from './Today';
import { AppointmentDrawer } from '../../ui/AppointmentPanel';

const TABS: { id: string; label: string; match: (st: RequestStatus) => boolean }[] = [
  { id: 'pendiente', label: 'Pendientes', match: (st) => st === 'pendiente' },
  { id: 'asignada', label: 'Asignadas', match: (st) => st === 'asignada' },
  { id: 'resuelta', label: 'Resueltas', match: (st) => st === 'resuelta' || st === 'descartada' },
];

export function Inbox() {
  const s = useDemo();
  const [tab, setTab] = useDraft('inbox:tab', 'pendiente');
  const [selected, setSelected] = useDraft<string | null>('inbox:selected', null);
  const list = s.requests.filter((r) => TABS.find((t) => t.id === tab)!.match(r.status)).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const req = byId(s.requests, selected);
  return (
    <section className="page">
      <PageHeader eyebrow="M05 · Recepción" title="Bandeja de gestiones">
        Conversación → solicitud → turno. Cada estado es distinto: resolver una solicitud no confirma un turno. Las identidades ambiguas no se fusionan.
      </PageHeader>
      <div className="pill-tabs" role="tablist" aria-label="Estado">
        {TABS.map((t) => {
          const n = s.requests.filter((r) => t.match(r.status)).length;
          return <button key={t.id} role="tab" aria-selected={tab === t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.id)}>{t.label} <span className="tabular">({n})</span></button>;
        })}
      </div>
      <div className="ops">
        <div className="stack">
          {list.length === 0 ? <EmptyState title="Nada en esta bandeja" icon="inbox" /> : (
            <ul className="list">
              {list.map((r) => (
                <li key={r.id}>
                  <button className="list-item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', borderColor: selected === r.id ? 'var(--primary)' : undefined }} aria-pressed={selected === r.id} onClick={() => setSelected(r.id)}>
                    <span className="row between"><strong>{r.id} · {r.kind.replace('_', ' ')}</strong><StatusBadge status={r.status} /></span>
                    <span>{r.summary}</span>
                    <span className="meta"><span>{personLabel(s, r.personId)}</span><span>Canal {r.channel}</span><span>{staffName(s, r.assigneeId)}</span><span className="tabular">{fmtShort(r.updatedAt)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside>{req ? <RequestDetail id={req.id} /> : <EmptyState title="Elegí una gestión" icon="inbox">Vas a ver responsable, nota, próximo paso, conversación y turno vinculado.</EmptyState>}</aside>
      </div>
    </section>
  );
}

function RequestDetail({ id }: { id: string }) {
  const s = useDemo();
  const r = byId(s.requests, id)!;
  const [note, setNote] = useState(r.note);
  const [nextStep, setNextStep] = useState(r.nextStep);
  const [reply, setReply] = useState('');
  const [identify, setIdentify] = useState('');
  const [book, setBook] = useState(false);
  const [openAppt, setOpenAppt] = useState<string | null>(null);
  const { show, view } = useResult();
  const convs = s.conversations.filter((c) => c.requestId === r.id);
  const calls = s.callSessions.filter((c) => c.requestId === r.id);
  const tasks = s.tasks.filter((t) => t.requestId === r.id);
  const appt = byId(s.appointments, r.appointmentId);
  const save = (status?: RequestStatus) => show(dispatch({ type: 'updateRequest', requestId: r.id, note, nextStep, ...(status ? { status } : {}) }));
  return (
    <div className="card stack" key={r.id}>
      <div className="row between"><h2 style={{ fontSize: 20, margin: 0 }}>{r.id}</h2><StatusBadge status={r.status} /></div>
      <p>{r.summary}</p>
      <dl className="kv">
        <dt>Persona</dt><dd>{r.personId ? <a href={`#/admin/personas/${r.personId}`}>{personLabel(s, r.personId)}</a> : 'Sin identificar'}</dd>
        <dt>Canal</dt><dd>{r.channel}</dd>
        <dt>Creada</dt><dd className="tabular">{fmtShort(r.createdAt)}</dd>
        <dt>Turno</dt><dd>{appt ? <button className="btn btn-ghost btn-sm" onClick={() => setOpenAppt(appt.id)}>{appt.id} · {STATUS_LABEL[appt.status]}</button> : 'Sin turno'}</dd>
      </dl>
      {r.personId && homonymsOf(s, r.personId).length > 0 && <Notice tone="warn" title="Hay homónimos">{homonymsOf(s, r.personId).map((p) => p.id).join(', ')} tienen el mismo nombre. Verificá siempre por ID.</Notice>}
      {!r.personId && (
        <div className="row wrap" style={{ alignItems: 'end' }}>
          <Field label="Identificar por ID (explícito)">{(p) => <select {...p} value={identify} onChange={(e) => setIdentify(e.target.value)}><option value="">Elegí</option>{s.persons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName} ({x.birthYear})</option>)}</select>}</Field>
          <Button disabled={!identify} onClick={() => show(dispatch({ type: 'updateRequest', requestId: r.id, personId: identify }))}>Vincular persona</Button>
        </div>
      )}
      <Field label="Responsable">{(p) => <select {...p} value={r.assigneeId ?? ''} onChange={(e) => show(dispatch({ type: 'updateRequest', requestId: r.id, assigneeId: e.target.value || null }))}><option value="">Sin responsable</option>{s.staff.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.area})</option>)}</select>}</Field>
      <Field label="Nota interna">{(p) => <textarea {...p} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}</Field>
      <Field label="Próximo paso">{(p) => <input {...p} value={nextStep} maxLength={200} onChange={(e) => setNextStep(e.target.value)} />}</Field>
      <div className="row wrap">
        <Button variant="primary" onClick={() => save()}>Guardar</Button>
        {r.status !== 'resuelta' && <Button onClick={() => save('resuelta')}>Marcar resuelta</Button>}
        {r.status !== 'descartada' && r.status !== 'resuelta' && <Button variant="ghost" onClick={() => save('descartada')}>Descartar</Button>}
        {r.personId && !appt && <Button icon="calendar" onClick={() => setBook(true)}>Agendar turno</Button>}
      </div>
      {view}
      {r.status === 'resuelta' && appt?.status === 'solicitada' && <Notice tone="warn" title="La solicitud está resuelta pero el turno sigue pendiente de confirmación">Resolver la gestión no confirma el turno; confirmalo desde la agenda.</Notice>}
      {tasks.length > 0 && <div><h3>Tareas</h3><ul className="plain">{tasks.map((t) => <li key={t.id}>{t.id} · {t.title} <StatusBadge status={t.status} /></li>)}</ul></div>}
      {convs.map((c) => {
        const msgs = s.messages.filter((m) => m.conversationId === c.id).slice(-8);
        return (
          <div key={c.id} className="stack">
            <h3>Conversación {c.id} <StatusBadge status={c.status} /></h3>
            <div className="chat-log" style={{ maxHeight: 280, borderRadius: 10 }}>
              {msgs.map((m) => <div key={m.id} className={`bubble ${m.from}`}>{m.text}<span className="stamp tabular">{m.from} · {parts(m.at).hhmm}</span></div>)}
            </div>
            <form className="row" onSubmit={(e) => { e.preventDefault(); const res = dispatch({ type: 'chatStaffReply', conversationId: c.id, text: reply }); show(res); if (res.ok) setReply(''); announce(res.message); }}>
              <label className="sr-only" htmlFor={`rep-${c.id}`}>Responder como recepción</label>
              <input id={`rep-${c.id}`} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder como recepción (simulado)" />
              <Button type="submit">Responder</Button>
            </form>
          </div>
        );
      })}
      {calls.length > 0 && <div><h3>Llamadas simuladas</h3><ul className="plain">{calls.map((c) => <li key={c.id}>{c.id} · {c.branch} · {c.status} · {c.transcript.length} líneas</li>)}</ul></div>}
      {book && r.personId && <NewAppointmentDrawer defaultDate={parts(s.clock).date} personId={r.personId} requestId={r.id} onClose={() => setBook(false)} onCreated={(aid) => { setBook(false); setOpenAppt(aid); }} />}
      {openAppt && <AppointmentDrawer id={openAppt} onClose={() => setOpenAppt(null)} />}
    </div>
  );
}
