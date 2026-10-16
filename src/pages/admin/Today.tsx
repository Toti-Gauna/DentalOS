import { useMemo, useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { navigate } from '../../app/router';
import { useDraft } from '../../app/ui-state';
import type { Appointment, Block } from '../../domain';
import { validateSlot } from '../../domain/scheduling';
import { byId, chairName, computeKpis, locName, personLabel, proName, ratioText, serviceName, sortByStart, STATUS_LABEL, staffName } from '../../domain/selectors';
import { addDays, addMinutes, at, fmtDateOnly, fmtShort, fmtTime, overlaps, parts, startOfWeek, toMs } from '../../domain/time';
import { Button, Drawer, EmptyState, Field, Icon, Kpi, Notice, PageHeader, StatusBadge, announce } from '../../ui/kit';
import { AppointmentActions, AppointmentDrawer } from '../../ui/AppointmentPanel';

interface Filters { professionalId: string; locationId: string; status: string }
const NO_FILTERS: Filters = { professionalId: '', locationId: '', status: '' };

export function Today() {
  const s = useDemo();
  const today = parts(s.clock).date;
  const [day, setDay] = useDraft('agenda:day', today);
  const [view, setView] = useDraft<'dia' | 'semana' | 'lista'>('agenda:view', 'dia');
  const [f, setF] = useDraft<Filters>('agenda:filters', NO_FILTERS);
  const [detail, setDetail] = useState<string | null>(null);
  const [newAppt, setNewAppt] = useState(false);
  const [newBlock, setNewBlock] = useState(false);

  const match = (a: Appointment) => (!f.professionalId || a.professionalId === f.professionalId) && (!f.locationId || a.locationId === f.locationId) && (!f.status || a.status === f.status);
  const blockMatch = (b: Block) => (!f.professionalId || (b.scope === 'professional' && b.targetId === f.professionalId) || b.scope !== 'professional') && (!f.locationId || b.scope !== 'location' || b.targetId === f.locationId);
  const range = view === 'dia' ? [day, day] : view === 'semana' ? [startOfWeek(day), addDays(startOfWeek(day), 4)] : [day, addDays(day, 13)];
  const inRange = (start: string, end: string) => overlaps(start, end, at(range[0], '00:00'), at(addDays(range[1], 1), '00:00'));
  const all = s.appointments.filter((a) => inRange(a.start, a.end)).sort(sortByStart);
  const shown = all.filter(match);
  const blocks = s.blocks.filter((b) => inRange(b.start, b.end) && blockMatch(b));
  const kpi = computeKpis(s, { from: today, to: today, professionalId: f.professionalId || undefined, locationId: f.locationId || undefined });
  const pendingConfirm = s.appointments.filter((a) => a.status === 'solicitada' && toMs(a.end) > toMs(s.clock)).sort(sortByStart);
  const openTasks = s.tasks.filter((t) => t.status !== 'resuelta').sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const changed = s.audit.filter((e) => e.type === 'cita_reprogramada').slice(-3).reverse();

  return (
    <section className="page">
      <PageHeader eyebrow="M04 · Recepción" title="Hoy y agenda" actions={<>
        <Button variant="primary" icon="plus" onClick={() => setNewAppt(true)}>Alta manual</Button>
        <Button icon="stop" onClick={() => setNewBlock(true)}>Bloquear horario</Button>
      </>}>
        {fmtDateOnly(today)} · reloj de muestra {fmtTime(s.clock)}. Profesional y sillón se validan juntos; sin sobreturnos silenciosos.
      </PageHeader>

      <div className="kpis">
        <Kpi label="Turnos de hoy (activos)" value={String(kpi.active)} detail="excluye cancelados" n={`n=${kpi.n}`} />
        <Kpi label="Pendientes de confirmación" value={String(kpi.pendingConfirmation)} detail="solicitudes con cupo reservado" />
        <Kpi label="Confirmación (futuros de hoy)" value={ratioText(kpi.confirmation)} detail={kpi.confirmation.detail} n={`${kpi.confirmation.num}/${kpi.confirmation.den}`} />
        <Kpi label="Tareas abiertas" value={String(kpi.tasksOpen)} detail={`${kpi.tasksUnassigned} sin responsable · ${kpi.tasksOverdue} vencidas`} />
      </div>

      <div className="agenda-toolbar" role="group" aria-label="Controles de agenda">
        <div className="seg" role="group" aria-label="Vista">
          {(['dia', 'semana', 'lista'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Lista 14 días'}</button>)}
        </div>
        <Button size="sm" icon="back" aria-label="Día anterior" onClick={() => setDay(addDays(day, view === 'semana' ? -7 : -1))} />
        <Field label="Fecha">{(p) => <input {...p} type="date" value={day} onChange={(e) => setDay(e.target.value || today)} />}</Field>
        <Button size="sm" icon="arrow" aria-label="Día siguiente" onClick={() => setDay(addDays(day, view === 'semana' ? 7 : 1))} />
        <Button size="sm" variant="ghost" onClick={() => setDay(today)}>Hoy</Button>
        <Field label="Profesional">{(p) => <select {...p} value={f.professionalId} onChange={(e) => setF({ ...f, professionalId: e.target.value })}><option value="">Todos</option>{s.professionals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        <Field label="Sede">{(p) => <select {...p} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Todas</option>{s.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        <Field label="Estado">{(p) => <select {...p} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos</option>{['solicitada', 'confirmada', 'en_sala', 'en_atencion', 'finalizada', 'ausente', 'cancelada'].map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>}</Field>
        <Button size="sm" variant="ghost" onClick={() => setF(NO_FILTERS)} disabled={!f.professionalId && !f.locationId && !f.status}>Limpiar filtros</Button>
      </div>
      <p className="muted small" role="status">Mostrando <span className="tabular">{shown.length}</span> de <span className="tabular">{all.length}</span> turnos · {range[0] === range[1] ? fmtDateOnly(range[0]) : `${fmtDateOnly(range[0])} al ${fmtDateOnly(range[1])}`}. Filtrar no cambia datos.</p>

      <div className="ops">
        <div className="stack">
          {view === 'semana' && <p className="muted small">En pantallas angostas la semana se muestra como lista diaria.</p>}
          {shown.length === 0 && blocks.length === 0 ? (
            <EmptyState title={all.length ? 'Sin coincidencias con estos filtros' : 'Sin turnos en este período'} icon="calendar" action={all.length ? <Button onClick={() => setF(NO_FILTERS)}>Restablecer filtros</Button> : <Button variant="primary" onClick={() => setNewAppt(true)}>Crear turno de muestra</Button>} />
          ) : view === 'semana' ? (
            <>
              <WeekGrid start={range[0]} appts={shown} blocks={blocks} onOpen={setDetail} />
              <DayList appts={shown} blocks={blocks} onOpen={setDetail} className="week-fallback" />
            </>
          ) : view === 'lista' ? <ListTable appts={shown} onOpen={setDetail} /> : <DayList appts={shown} blocks={blocks} onOpen={setDetail} />}
        </div>
        <aside className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Por confirmar</h2>
            {pendingConfirm.length === 0 ? <p className="muted">Nada pendiente.</p> : pendingConfirm.map((a) => (
              <div key={a.id} className="list-item">
                <strong>{personLabel(s, a.personId)}</strong>
                <span className="small muted tabular">{serviceName(s, a.serviceTypeId)} · {fmtShort(a.start)} · {a.requestId}</span>
                <AppointmentActions a={a} compact onOpen={() => setDetail(a.id)} />
              </div>
            ))}
          </div>
          <div className="card stack">
            <div className="row between"><h2 style={{ fontSize: 20, margin: 0 }}>Pendientes</h2><Button size="sm" variant="ghost" onClick={() => navigate('/admin/tareas')}>Ver todas</Button></div>
            {openTasks.length === 0 ? <p className="muted">Sin tareas abiertas.</p> : openTasks.slice(0, 6).map((t) => (
              <div key={t.id} className="list-item">
                <div className="row between"><strong className="small">{t.title}</strong><StatusBadge status={t.status} /></div>
                <span className="small muted">{staffName(s, t.assigneeId)}{t.dueAt ? ` · vence ${fmtShort(t.dueAt)}` : ''}{t.ruleId ? ` · ${t.ruleId}` : ''}</span>
              </div>
            ))}
          </div>
          {changed.length > 0 && (
            <div className="card stack">
              <h2 style={{ fontSize: 20 }}>Cambios recientes</h2>
              {changed.map((e) => <p key={e.id} className="small"><button className="btn btn-ghost btn-sm" onClick={() => setDetail(e.entityId)}><span className="code">{e.entityId}</span></button> {e.detail}</p>)}
            </div>
          )}
        </aside>
      </div>
      {detail && <AppointmentDrawer id={detail} onClose={() => setDetail(null)} />}
      {newAppt && <NewAppointmentDrawer defaultDate={day} onClose={() => setNewAppt(false)} onCreated={(id) => { setNewAppt(false); setDetail(id); }} />}
      {newBlock && <NewBlockDrawer defaultDate={day} onClose={() => setNewBlock(false)} />}
    </section>
  );
}

function ApptCard({ a, onOpen }: { a: Appointment; onOpen: (id: string) => void }) {
  const s = useDemo();
  const recent = s.audit.slice(-1)[0]?.entityId === a.id;
  return (
    <div className={`list-item appt st-${a.status} ${recent ? 'highlight' : ''}`}>
      <div className="row between">
        <strong>{personLabel(s, a.personId)}</strong>
        <StatusBadge status={a.status} />
      </div>
      <div className="meta"><span className="tabular">{fmtTime(a.start)}–{fmtTime(a.end)}</span><span>{serviceName(s, a.serviceTypeId)}</span><span>{proName(s, a.professionalId)}</span><span>{locName(s, a.locationId)} · {chairName(s, a.chairId)}</span><span className="code">{a.id} v{a.version}</span></div>
      <AppointmentActions a={a} compact onOpen={() => onOpen(a.id)} />
    </div>
  );
}

function DayList({ appts, blocks, onOpen, className = '' }: { appts: Appointment[]; blocks: Block[]; onOpen: (id: string) => void; className?: string }) {
  const s = useDemo();
  const items = [...appts.map((a) => ({ t: a.start, a })), ...blocks.map((b) => ({ t: b.start, b }))].sort((x, y) => toMs(x.t) - toMs(y.t));
  let lastDate = '';
  return (
    <div className={`day-grid ${className}`}>
      {items.map((it) => {
        const d = parts(it.t).date;
        const header = d !== lastDate ? <h3 key={`h-${d}`} style={{ marginTop: 8 }}>{fmtDateOnly(d)}</h3> : null;
        lastDate = d;
        return (
          <div key={'a' in it && it.a ? it.a.id : (it as { b: Block }).b.id}>
            {header}
            <div className="slot-row">
              <time dateTime={it.t}>{fmtTime(it.t)}</time>
              {'a' in it && it.a ? <ApptCard a={it.a} onOpen={onOpen} /> : (() => { const b = (it as { b: Block }).b; return (
                <div className="list-item appt block"><div className="row between"><strong><Icon name="stop" size={14} /> Bloqueo · {b.reason}</strong><Button size="sm" variant="ghost" onClick={() => { const r = dispatch({ type: 'removeBlock', blockId: b.id }); announce(r.message); }}>Quitar</Button></div>
                  <span className="small muted tabular">{fmtTime(b.start)}–{fmtTime(b.end)} · {b.scope === 'professional' ? proName(s, b.targetId) : b.scope === 'chair' ? chairName(s, b.targetId) : locName(s, b.targetId)} · {b.id}</span></div>); })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekGrid({ start, appts, blocks, onOpen }: { start: string; appts: Appointment[]; blocks: Block[]; onOpen: (id: string) => void }) {
  const s = useDemo();
  return (
    <div className="week" aria-label="Semana">
      {[0, 1, 2, 3, 4].map((i) => {
        const d = addDays(start, i);
        const dayAppts = appts.filter((a) => parts(a.start).date === d);
        const dayBlocks = blocks.filter((b) => parts(b.start).date === d);
        return (
          <div key={d} className="week-day">
            <h3>{fmtDateOnly(d)}</h3>
            {dayAppts.length === 0 && dayBlocks.length === 0 && <span className="small muted">Libre</span>}
            {dayBlocks.map((b) => <div key={b.id} className="mini-appt" style={{ borderLeftColor: 'var(--secondary)' }}>{fmtTime(b.start)} Bloqueo</div>)}
            {dayAppts.map((a) => (
              <button key={a.id} className={`mini-appt st-${a.status}`} onClick={() => onOpen(a.id)}>
                <strong className="tabular">{fmtTime(a.start)}</strong> {byId(s.persons, a.personId)?.firstName ?? a.personId}<br />
                <span className="muted">{serviceName(s, a.serviceTypeId)} · {STATUS_LABEL[a.status]}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ListTable({ appts, onOpen }: { appts: Appointment[]; onOpen: (id: string) => void }) {
  const s = useDemo();
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Turnos del período</caption>
        <thead><tr><th>Cuándo</th><th>Persona</th><th>Motivo</th><th>Recursos</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          {appts.map((a) => (
            <tr key={a.id}>
              <td className="tabular">{fmtShort(a.start)}</td><td>{personLabel(s, a.personId)}</td><td>{serviceName(s, a.serviceTypeId)}</td>
              <td className="small">{proName(s, a.professionalId)}<br />{chairName(s, a.chairId)}</td><td><StatusBadge status={a.status} /></td>
              <td><Button size="sm" variant="ghost" onClick={() => onOpen(a.id)}>Abrir</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TIMES = Array.from({ length: 45 }, (_, i) => { const m = 8 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });

export function NewAppointmentDrawer({ defaultDate, onClose, onCreated, personId, requestId }: { defaultDate: string; onClose: () => void; onCreated: (id: string) => void; personId?: string; requestId?: string }) {
  const s = useDemo();
  const [d, setD, clear] = useDraft(`agenda:new${requestId ? ':' + requestId : ''}`, { personId: personId ?? '', serviceTypeId: 'ST-CONTROL', professionalId: 'PR-01', chairId: 'CH-1', date: defaultDate, time: '10:00', draftId: `r${s.revision}` });
  const [error, setError] = useState<{ message: string; conflicts?: { message: string }[] } | null>(null);
  const st = byId(s.serviceTypes, d.serviceTypeId);
  const chair = byId(s.chairs, d.chairId);
  const start = at(d.date, d.time);
  const preview = useMemo(() => (st && chair ? validateSlot(s, { start, end: addMinutes(start, st.durationMin), professionalId: d.professionalId, chairId: d.chairId, locationId: chair.locationId, serviceTypeId: st.id }, { personId: d.personId || undefined, skipLeadCheck: true }) : []), [s, st, chair, start, d.professionalId, d.chairId, d.personId]);
  const submit = () => {
    if (!d.personId) { setError({ message: 'Elegí la persona por ID.' }); document.getElementById('na-person')?.focus(); return; }
    const r = dispatch({ commandId: `book:${d.draftId}:${d.personId}:${d.serviceTypeId}:${start}:${d.chairId}`, type: 'book', personId: d.personId, serviceTypeId: d.serviceTypeId, professionalId: d.professionalId, chairId: d.chairId, locationId: chair!.locationId, start, channel: 'recepcion', requestId });
    announce(r.message);
    if (r.ok) { clear(); onCreated(r.ids!.appointmentId); } else setError({ message: r.message, conflicts: r.conflicts });
  };
  return (
    <Drawer open title={requestId ? `Agendar desde ${requestId}` : 'Alta manual de turno'} onClose={onClose} footer={<><Button onClick={onClose}>Cerrar (el borrador se conserva)</Button><Button variant="primary" icon="check" onClick={submit}>Crear turno confirmado</Button></>}>
      <p className="muted small">Recepción puede cargar en el día; igual se validan jornada, bloqueos, profesional, sillón y sede. El borrador se conserva si cerrás.</p>
      <Field label="Persona (por ID)" id="na-person">{(p) => <select {...p} value={d.personId} onChange={(e) => setD({ ...d, personId: e.target.value })}><option value="">Elegí</option>{s.persons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName} ({x.birthYear})</option>)}</select>}</Field>
      <div className="form-grid">
        <Field label="Motivo">{(p) => <select {...p} value={d.serviceTypeId} onChange={(e) => setD({ ...d, serviceTypeId: e.target.value })}>{s.serviceTypes.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.durationMin} min</option>)}</select>}</Field>
        <Field label="Profesional">{(p) => <select {...p} value={d.professionalId} onChange={(e) => setD({ ...d, professionalId: e.target.value })}>{s.professionals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        <Field label="Sillón">{(p) => <select {...p} value={d.chairId} onChange={(e) => setD({ ...d, chairId: e.target.value })}>{s.chairs.map((x) => <option key={x.id} value={x.id}>{x.name} · {locName(s, x.locationId)}</option>)}</select>}</Field>
        <Field label="Fecha">{(p) => <input {...p} type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value || defaultDate })} />}</Field>
        <Field label="Hora">{(p) => <select {...p} value={d.time} onChange={(e) => setD({ ...d, time: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
      </div>
      {preview.length ? (
        <Notice tone="warn" title="Este horario no se puede reservar"><ul className="plain">{preview.map((c, i) => <li key={i}>{c.message}</li>)}</ul></Notice>
      ) : <Notice tone="ok" title="Disponible al momento de revisar">Se revalida al crear.</Notice>}
      {error && <Notice tone="error" title={error.message}>{error.conflicts && <ul className="plain">{error.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>}</Notice>}
    </Drawer>
  );
}

function NewBlockDrawer({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const s = useDemo();
  const [d, setD] = useDraft('agenda:block', { scope: 'professional' as Block['scope'], targetId: 'PR-01', date: defaultDate, from: '12:00', to: '13:00', reason: '' });
  const [error, setError] = useState<{ message: string; conflicts?: { message: string }[] } | null>(null);
  const targets = d.scope === 'professional' ? s.professionals.map((x) => ({ id: x.id, name: x.name })) : d.scope === 'chair' ? s.chairs.map((x) => ({ id: x.id, name: x.name })) : s.locations.map((x) => ({ id: x.id, name: x.name }));
  const submit = () => {
    const r = dispatch({ type: 'addBlock', scope: d.scope, targetId: d.targetId, start: at(d.date, d.from), end: at(d.date, d.to), reason: d.reason });
    announce(r.message);
    if (r.ok) onClose(); else setError({ message: r.message, conflicts: r.conflicts });
  };
  return (
    <Drawer open title="Bloquear horario" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit}>Guardar bloqueo</Button></>}>
      <div className="form-grid">
        <Field label="Tipo">{(p) => <select {...p} value={d.scope} onChange={(e) => { const scope = e.target.value as Block['scope']; setD({ ...d, scope, targetId: scope === 'professional' ? 'PR-01' : scope === 'chair' ? 'CH-1' : 'L-CEN' }); }}><option value="professional">Profesional</option><option value="chair">Sillón</option><option value="location">Sede</option></select>}</Field>
        <Field label="Recurso">{(p) => <select {...p} value={d.targetId} onChange={(e) => setD({ ...d, targetId: e.target.value })}>{targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}</Field>
        <Field label="Fecha">{(p) => <input {...p} type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value || defaultDate })} />}</Field>
        <Field label="Desde">{(p) => <select {...p} value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
        <Field label="Hasta">{(p) => <select {...p} value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
      </div>
      <Field label="Motivo administrativo" error={error && !d.reason.trim() ? 'Indicá un motivo.' : undefined}>{(p) => <input {...p} value={d.reason} maxLength={80} onChange={(e) => setD({ ...d, reason: e.target.value })} />}</Field>
      {error && <Notice tone="error" title={error.message}>{error.conflicts && <ul className="plain">{error.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>}</Notice>}
    </Drawer>
  );
}
