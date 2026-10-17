import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import type { RequestStatus } from '../../domain';
import { byId, homonymsOf, personLabel, STATUS_LABEL, staffName } from '../../domain/selectors';
import { fmtShort, parts, toMs } from '../../domain/time';
import { Button, Drawer, EmptyState, Field, Icon, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { NewAppointmentDrawer } from './Today';
import { AppointmentDrawer } from '../../ui/AppointmentPanel';

const TABS: { id: string; label: string; match: (st: RequestStatus) => boolean }[] = [
  { id: 'pendiente', label: 'Pendientes', match: (st) => st === 'pendiente' },
  { id: 'asignada', label: 'Asignadas', match: (st) => st === 'asignada' },
  { id: 'resuelta', label: 'Resueltas', match: (st) => st === 'resuelta' || st === 'descartada' },
];

const CHANNEL_ICON: Record<string, string> = { whatsapp: 'chat', llamada: 'phone', web: 'home', recepcion: 'user', espera: 'hourglass' };

function age(fromIso: string, clock: string) {
  const m = Math.max(0, Math.round((toMs(clock) - toMs(fromIso)) / 60_000));
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
}

export function Inbox() {
  const s = useDemo();
  const [tab, setTab] = useDraft('inbox:tab', 'pendiente');
  const [assignee, setAssignee] = useDraft('inbox:assignee', '');
  const [selected, setSelected] = useState<string | null>(null);
  const list = s.requests
    .filter((r) => TABS.find((t) => t.id === tab)!.match(r.status))
    .filter((r) => !assignee || (assignee === 'none' ? !r.assigneeId : r.assigneeId === assignee))
    .slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const req = byId(s.requests, selected);
  return (
    <section className="page">
      <PageHeader eyebrow="M05 · Recepción" title="Bandeja de gestiones">
        Conversación → solicitud → turno. Cada estado es distinto: resolver una solicitud no confirma un turno. Las identidades ambiguas no se fusionan.
      </PageHeader>
      <div className="row wrap" style={{ alignItems: 'end', justifyContent: 'space-between' }}>
        <div className="pill-tabs" role="tablist" aria-label="Estado de la gestión">
          {TABS.map((t) => {
            const n = s.requests.filter((r) => t.match(r.status)).length;
            return <button key={t.id} role="tab" aria-selected={tab === t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.id)}>{t.label} <span className="tabular">({n})</span></button>;
          })}
        </div>
        <Field label="Responsable">{(p) => <select {...p} value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ minWidth: 200 }}><option value="">Todos</option><option value="none">Sin responsable</option>{s.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
      </div>
      {list.length === 0 ? <EmptyState title="Nada en esta bandeja" icon="inbox">{assignee ? 'Probá quitar el filtro de responsable.' : 'Cuando llegue una gestión por web, WhatsApp o llamada aparece acá.'}</EmptyState> : (
        <ul className="list" aria-label="Gestiones">
          {list.map((r) => (
            <li key={r.id}>
              <button className="list-item inbox-row" aria-haspopup="dialog" onClick={() => setSelected(r.id)}>
                <span className="inbox-icon" aria-hidden="true"><Icon name={CHANNEL_ICON[r.channel] ?? 'inbox'} /></span>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span className="inbox-title">{r.id} · {KIND_LABEL[r.kind]} <span className="muted small">por {r.channel}</span></span>
                  <span>{r.summary}</span>
                  <span className="next-step"><Icon name="arrow" size={14} /> <span><strong>Siguiente paso:</strong> {r.nextStep || 'Definir próximo paso.'}</span></span>
                  <span className="meta"><span>{r.personId ? personLabel(s, r.personId) : 'Sin identificar'}</span><span>{staffName(s, r.assigneeId)}</span><span className="tabular">{age(r.updatedAt, s.clock)}</span></span>
                </span>
                <StatusBadge status={r.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {req && (
        <Drawer open title={`${req.id} · ${KIND_LABEL[req.kind]}`} onClose={() => setSelected(null)}>
          <RequestDetail id={req.id} />
        </Drawer>
      )}
    </section>
  );
}

const KIND_LABEL: Record<string, string> = { primera_visita: 'Primera visita', reserva: 'Reserva', reprogramacion: 'Reprogramación', cancelacion: 'Cancelación', consulta: 'Consulta', derivacion: 'Derivación humana' };

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
    <div className="stack" key={r.id}>
      <div className="row between"><StatusBadge status={r.status} /><span className="small muted">Canal {r.channel}</span></div>
      <p style={{ margin: 0 }}>{r.summary}</p>
      <p className="next-step"><Icon name="arrow" size={14} /> <span><strong>Siguiente paso:</strong> {r.nextStep || 'Definir próximo paso.'}</span></p>
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
