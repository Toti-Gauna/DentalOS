import { useEffect, useMemo, useState } from 'react';
import { dispatch, useDemo, useLastChange } from '../../app/store';
import { navigate, useRoute } from '../../app/router';
import { useDraft } from '../../app/ui-state';
import type { Appointment, Block } from '../../domain';
import { validateSlot } from '../../domain/scheduling';
import { byId, chairName, computeKpis, locName, personLabel, proName, ratioText, serviceName, sortByStart, STATUS_LABEL, staffName } from '../../domain/selectors';
import { DateStrip, DisabledReason, SummaryStrip, TurnoCard } from '../../ui/components';
import { addDays, addMinutes, at, fmtDateOnly, fmtShort, fmtTime, hhmmToMinutes, overlaps, parts, startOfWeek, toMs } from '../../domain/time';
import { Button, Drawer, EmptyState, Field, Icon, Notice, PageHeader, StatusBadge, announce } from '../../ui/kit';
import { AppointmentActions, AppointmentDrawer } from '../../ui/AppointmentPanel';

interface Filters { professionalId: string; locationId: string; status: string }
const NO_FILTERS: Filters = { professionalId: '', locationId: '', status: '' };
type View = 'recursos' | 'dia' | 'semana' | 'lista';
const VIEWS: [View, string][] = [['recursos', 'Por profesional'], ['dia', 'Lista del día'], ['semana', 'Semana'], ['lista', '14 días']];

export function Today() {
  const s = useDemo();
  const { query } = useRoute();
  const today = parts(s.clock).date;
  const [day, setDay] = useDraft('agenda:day', today);
  const [view, setView] = useDraft<View>('agenda:view2', 'recursos');
  const [f, setF] = useDraft<Filters>('agenda:filters', NO_FILTERS);
  const [detail, setDetail] = useState<string | null>(null);
  const [newAppt, setNewAppt] = useState(false);
  const [newBlock, setNewBlock] = useState(false);
  const linked = query.get('turno');

  // Enlace visual portal → agenda: ?dia=YYYY-MM-DD&turno=A-0012 abre el día y resalta la misma cita.
  const linkedDay = query.get('dia');
  useEffect(() => {
    if (linkedDay && /^\d{4}-\d{2}-\d{2}$/.test(linkedDay)) { setDay(linkedDay); if (view === 'semana' || view === 'lista') setView('recursos'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedDay]);

  const match = (a: Appointment) => (!f.professionalId || a.professionalId === f.professionalId) && (!f.locationId || a.locationId === f.locationId) && (!f.status || a.status === f.status);
  const blockMatch = (b: Block) => (!f.professionalId || (b.scope === 'professional' && b.targetId === f.professionalId) || b.scope !== 'professional') && (!f.locationId || b.scope !== 'location' || b.targetId === f.locationId);
  const range = view === 'semana' ? [startOfWeek(day), addDays(startOfWeek(day), 4)] : view === 'lista' ? [day, addDays(day, 13)] : [day, day];
  const inRange = (start: string, end: string) => overlaps(start, end, at(range[0], '00:00'), at(addDays(range[1], 1), '00:00'));
  const all = s.appointments.filter((a) => inRange(a.start, a.end)).sort(sortByStart);
  const shown = all.filter(match);
  const blocks = s.blocks.filter((b) => inRange(b.start, b.end) && blockMatch(b));
  const kpi = computeKpis(s, { from: day, to: day, professionalId: f.professionalId || undefined, locationId: f.locationId || undefined });
  const pendingConfirm = s.appointments.filter((a) => a.status === 'solicitada' && toMs(a.end) > toMs(s.clock)).sort(sortByStart);
  const openTasks = s.tasks.filter((t) => t.status !== 'resuelta').sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const changed = s.audit.filter((e) => e.type === 'cita_reprogramada').slice(-3).reverse();
  const activeFilters = [f.professionalId, f.locationId, f.status].filter(Boolean).length;
  const inRoom = s.appointments.filter((a) => parts(a.start).date === day && (a.status === 'en_sala' || a.status === 'en_atencion')).length;
  const dayNote = (d: string) => {
    const wd = parts(at(d, '12:00')).weekday;
    if (!s.availabilityRules.some((r) => r.weekday === wd)) return 'Cerrado';
    const n = s.appointments.filter((a) => parts(a.start).date === d && a.status !== 'cancelada').length;
    return n ? `${n} turno${n === 1 ? '' : 's'}` : 'Libre';
  };

  return (
    <section className="page">
      <PageHeader eyebrow="M04 · Recepción" title="Hoy y agenda" actions={<>
        <Button variant="primary" icon="plus" onClick={() => setNewAppt(true)}>Alta manual</Button>
        <Button icon="stop" onClick={() => setNewBlock(true)}>Bloquear horario</Button>
      </>}>
        {fmtDateOnly(day)}{day === today ? ` · hoy, reloj de muestra ${fmtTime(s.clock)}` : ''}. Profesional y sillón se validan juntos; sin sobreturnos silenciosos.
      </PageHeader>

      <SummaryStrip label={`Resumen del ${fmtDateOnly(day)}`} items={[
        { label: 'Turnos activos', value: String(kpi.active), detail: `n=${kpi.n}, sin cancelados` },
        { label: 'Por confirmar', value: String(kpi.pendingConfirmation), detail: 'cupo reservado', tone: kpi.pendingConfirmation ? 'warn' : undefined },
        { label: 'Confirmados (futuros)', value: ratioText(kpi.confirmation), detail: `${kpi.confirmation.num}/${kpi.confirmation.den}` },
        { label: 'En sala o atención', value: String(inRoom) },
        { label: 'Tareas abiertas', value: String(kpi.tasksOpen), detail: `${kpi.tasksUnassigned} sin responsable`, tone: kpi.tasksUnassigned ? 'warn' : undefined },
      ]} />

      <div className="toolbar" role="group" aria-label="Controles de agenda">
        <DateStrip label="Día" value={day} start={startOfWeek(day)} days={7} onChange={setDay} note={dayNote} />
        <div className="stack" style={{ gap: 4 }}>
          <span className="label" id="view-label">Vista</span>
          <div className="seg" role="group" aria-labelledby="view-label">
            {VIEWS.map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setDay(today)} disabled={day === today}>Ir a hoy</Button>
      </div>
      <details className="filters" open={activeFilters > 0 || undefined}>
        <summary><Icon name="list" size={16} /> Filtros{activeFilters ? ` (${activeFilters} activo${activeFilters === 1 ? '' : 's'})` : ''}</summary>
        <div className="agenda-toolbar">
          <Field label="Profesional">{(p) => <select {...p} value={f.professionalId} onChange={(e) => setF({ ...f, professionalId: e.target.value })}><option value="">Todos</option>{s.professionals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
          <Field label="Sede">{(p) => <select {...p} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Todas</option>{s.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
          <Field label="Estado">{(p) => <select {...p} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos</option>{['solicitada', 'confirmada', 'en_sala', 'en_atencion', 'finalizada', 'ausente', 'cancelada'].map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>}</Field>
          <Button size="sm" variant="ghost" onClick={() => setF(NO_FILTERS)} disabled={!activeFilters} aria-describedby={!activeFilters ? 'nofilters' : undefined}>Limpiar filtros</Button>
          {!activeFilters && <DisabledReason id="nofilters">No hay filtros activos.</DisabledReason>}
        </div>
      </details>
      <p className="muted small" role="status" style={{ margin: 0 }}>Mostrando <span className="tabular">{shown.length}</span> de <span className="tabular">{all.length}</span> turnos · {range[0] === range[1] ? fmtDateOnly(range[0]) : `${fmtDateOnly(range[0])} al ${fmtDateOnly(range[1])}`}. Filtrar no cambia datos.</p>

      <div className="ops">
        <div className="stack">
          {shown.length === 0 && blocks.length === 0 ? (
            <EmptyState title={all.length ? 'Sin coincidencias con estos filtros' : 'Sin turnos en este período'} icon="calendar" action={all.length ? <Button onClick={() => setF(NO_FILTERS)}>Restablecer filtros</Button> : <Button variant="primary" onClick={() => setNewAppt(true)}>Crear turno de muestra</Button>} />
          ) : view === 'recursos' ? (
            <>
              <div className="desktop-only"><ResourceGrid day={day} appts={shown} blocks={blocks} filters={f} onOpen={setDetail} linked={linked} /></div>
              <div className="mobile-only"><p className="small muted">En pantallas angostas la agenda se muestra como lista diaria.</p><DayList appts={shown} blocks={blocks} onOpen={setDetail} linked={linked} /></div>
            </>
          ) : view === 'semana' ? (
            <>
              <div className="desktop-only"><WeekGrid start={range[0]} appts={shown} blocks={blocks} onOpen={setDetail} /></div>
              <div className="mobile-only"><p className="small muted">En pantallas angostas la semana se muestra como lista diaria.</p><DayList appts={shown} blocks={blocks} onOpen={setDetail} linked={linked} /></div>
            </>
          ) : view === 'lista' ? <ListTable appts={shown} onOpen={setDetail} /> : <DayList appts={shown} blocks={blocks} onOpen={setDetail} linked={linked} />}
        </div>
        <aside className="stack" aria-label="Pendientes de recepción">
          <div className="card stack">
            <div className="section-title"><h2>Por confirmar</h2><span className="muted small tabular">{pendingConfirm.length}</span></div>
            {pendingConfirm.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nada pendiente.</p> : pendingConfirm.map((a) => (
              <div key={a.id} className="list-item">
                <strong>{personLabel(s, a.personId)}</strong>
                <span className="small muted tabular">{serviceName(s, a.serviceTypeId)} · {fmtShort(a.start)} · {a.requestId}</span>
                <AppointmentActions a={a} compact onOpen={() => setDetail(a.id)} />
              </div>
            ))}
          </div>
          <div className="card stack">
            <div className="section-title"><h2>Pendientes</h2><Button size="sm" variant="ghost" onClick={() => navigate('/admin/tareas')}>Ver todas</Button></div>
            {openTasks.length === 0 ? <p className="muted" style={{ margin: 0 }}>Sin tareas abiertas.</p> : openTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="list-item">
                <div className="row between"><strong className="small">{t.title}</strong><StatusBadge status={t.status} /></div>
                <span className="small muted">{staffName(s, t.assigneeId)}{t.dueAt ? ` · vence ${fmtShort(t.dueAt)}` : ''}{t.ruleId ? ` · ${t.ruleId}` : ''}</span>
              </div>
            ))}
          </div>
          {changed.length > 0 && (
            <div className="card stack">
              <h2>Cambios recientes</h2>
              {changed.map((e) => <div key={e.id} className="small"><button className="btn btn-ghost btn-sm" onClick={() => setDetail(e.entityId)}><span className="code">{e.entityId}</span></button> {e.detail}</div>)}
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

const ROW_MIN = 15;

/** Agenda por recursos: columnas por profesional, filas de 15 min; los turnos ocupan su intervalo [inicio, fin). */
function ResourceGrid({ day, appts, blocks, filters, onOpen, linked }: { day: string; appts: Appointment[]; blocks: Block[]; filters: Filters; onOpen: (id: string) => void; linked: string | null }) {
  const s = useDemo();
  const last = useLastChange();
  const wd = parts(at(day, '12:00')).weekday;
  const rules = s.availabilityRules.filter((r) => r.weekday === wd && (!filters.professionalId || r.professionalId === filters.professionalId) && (!filters.locationId || r.locationId === filters.locationId));
  const pros = s.professionals.filter((p) => rules.some((r) => r.professionalId === p.id) || appts.some((a) => a.professionalId === p.id));
  const visible = appts.filter((a) => a.status !== 'cancelada');
  const cancelled = appts.length - visible.length;
  if (!pros.length) return <EmptyState title="Sin jornada de atención este día" icon="calendar">Los turnos de la lista aparecen igual en la vista “Lista del día”.</EmptyState>;
  const mins = [...rules.map((r) => hhmmToMinutes(r.start)), ...visible.map((a) => parts(a.start).minutes)];
  const maxs = [...rules.map((r) => hhmmToMinutes(r.end)), ...visible.map((a) => parts(a.end).minutes)];
  const startMin = Math.floor(Math.min(...mins, 9 * 60) / 60) * 60;
  const endMin = Math.ceil(Math.max(...maxs, 13 * 60) / 60) * 60;
  const rows = (endMin - startMin) / ROW_MIN;
  const row = (m: number) => Math.round((m - startMin) / ROW_MIN) + 2;
  const open = (proId: string, m: number) => rules.some((r) => r.professionalId === proId && hhmmToMinutes(r.start) <= m && m < hhmmToMinutes(r.end));
  const otherBlocks = blocks.filter((b) => b.scope !== 'professional');
  return (
    <div className="stack">
      <div className="res-wrap">
        <div className="res-grid" role="group" aria-label={`Agenda por profesional, ${fmtDateOnly(day)}`}
          style={{ gridTemplateColumns: `56px repeat(${pros.length}, minmax(150px, 1fr))`, gridTemplateRows: `auto repeat(${rows}, 26px)` }}>
          <div className="res-head" style={{ gridColumn: 1, gridRow: 1 }}><span className="sr-only">Hora</span></div>
          {pros.map((p, i) => {
            const locs = [...new Set(rules.filter((r) => r.professionalId === p.id).map((r) => locName(s, r.locationId)))];
            return <div key={p.id} className="res-head" style={{ gridColumn: i + 2, gridRow: 1 }}>{p.name}<small>{locs.join(' · ') || 'Sin jornada'}</small></div>;
          })}
          {Array.from({ length: rows }, (_, r) => {
            const m = startMin + r * ROW_MIN;
            return [
              m % 60 === 0 ? <div key={`t${r}`} className="res-time" style={{ gridColumn: 1, gridRow: `${r + 2} / span 4` }} aria-hidden="true">{`${String(m / 60).padStart(2, '0')}:00`}</div> : null,
              ...pros.map((p, i) => <div key={`c${p.id}${r}`} className={`res-cell ${open(p.id, m) ? '' : 'closed'} ${m % 60 === 0 ? 'hour' : ''}`} style={{ gridColumn: i + 2, gridRow: r + 2 }} aria-hidden="true" />),
            ];
          })}
          {blocks.filter((b) => b.scope === 'professional').map((b) => {
            const col = pros.findIndex((p) => p.id === b.targetId);
            if (col < 0) return null;
            const a = Math.max(parts(b.start).date === day ? parts(b.start).minutes : 0, startMin);
            const z = Math.min(parts(b.end).date === day ? parts(b.end).minutes : 24 * 60, endMin);
            if (z <= a) return null;
            return <div key={b.id} className="res-block" style={{ gridColumn: col + 2, gridRow: `${row(a)} / ${row(z)}` }}><Icon name="stop" size={12} /> {b.reason}</div>;
          })}
          {visible.map((a) => {
            const col = pros.findIndex((p) => p.id === a.professionalId);
            const updated = last?.appointmentId === a.id || linked === a.id;
            return (
              <button key={a.id} type="button" className={`res-appt st-${a.status} ${updated ? 'is-updated' : ''}`} data-appointment={a.id}
                style={{ gridColumn: col + 2, gridRow: `${row(parts(a.start).minutes)} / ${row(parts(a.end).minutes)}` }}
                onClick={() => onOpen(a.id)}
                aria-label={`${fmtTime(a.start)} a ${fmtTime(a.end)}, ${personLabel(s, a.personId)}, ${serviceName(s, a.serviceTypeId)}, ${chairName(s, a.chairId)}, ${STATUS_LABEL[a.status]}, turno ${a.id} versión ${a.version}${updated ? ', actualizado recién' : ''}`}>
                <strong className="tabular">{fmtTime(a.start)} · {byId(s.persons, a.personId)?.firstName ?? a.personId}</strong>
                <span>{serviceName(s, a.serviceTypeId)}</span>
                <span className="small">{chairName(s, a.chairId)} · {STATUS_LABEL[a.status]} · {a.id} v{a.version}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ul className="legend" aria-label="Leyenda de la agenda">
        <li><span className="swatch" style={{ background: 'var(--primary-50)', borderColor: 'var(--primary)' }} /> Confirmado</li>
        <li><span className="swatch" style={{ background: 'var(--warn-50)', borderColor: 'var(--warn)' }} /> Pendiente de confirmación</li>
        <li><span className="swatch" style={{ background: 'var(--info-50)', borderColor: 'var(--info)' }} /> En sala o en atención</li>
        <li><span className="swatch" style={{ background: 'repeating-linear-gradient(135deg,#fff,#fff 3px,#f1eee6 3px,#f1eee6 6px)' }} /> Fuera de jornada o bloqueado</li>
        {cancelled > 0 && <li>{cancelled} cancelado(s): solo en “Lista del día”</li>}
      </ul>
      {otherBlocks.map((b) => <BlockRow key={b.id} b={b} />)}
    </div>
  );
}

function BlockRow({ b }: { b: Block }) {
  const s = useDemo();
  return (
    <div className="block-row">
      <span><strong><Icon name="stop" size={14} /> Bloqueo · {b.reason}</strong><br /><span className="small muted tabular">{fmtTime(b.start)}–{fmtTime(b.end)} · {b.scope === 'professional' ? proName(s, b.targetId) : b.scope === 'chair' ? chairName(s, b.targetId) : locName(s, b.targetId)} · {b.id}</span></span>
      <Button size="sm" variant="ghost" onClick={() => { const r = dispatch({ type: 'removeBlock', blockId: b.id }); announce(r.message); }}>Quitar bloqueo</Button>
    </div>
  );
}

function DayList({ appts, blocks, onOpen, linked }: { appts: Appointment[]; blocks: Block[]; onOpen: (id: string) => void; linked: string | null }) {
  const items = [...appts.map((a) => ({ t: a.start, a })), ...blocks.map((b) => ({ t: b.start, b }))].sort((x, y) => toMs(x.t) - toMs(y.t));
  const days = [...new Set(items.map((it) => parts(it.t).date))];
  return (
    <div className="day-grid">
      {days.map((d) => (
        <section key={d} className="stack" style={{ gap: 8 }} aria-label={fmtDateOnly(d)}>
          <h3 className="day-head">{fmtDateOnly(d)}</h3>
          <ul className="turno-list">
            {items.filter((it) => parts(it.t).date === d).map((it) => 'a' in it && it.a
              ? <li key={it.a.id}><TurnoCard a={it.a} variant="admin" showPerson forceHighlight={linked === it.a.id} actions={<AppointmentActions a={it.a} compact onOpen={() => onOpen(it.a!.id)} />} /></li>
              : <li key={(it as { b: Block }).b.id}><BlockRow b={(it as { b: Block }).b} /></li>)}
          </ul>
        </section>
      ))}
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
