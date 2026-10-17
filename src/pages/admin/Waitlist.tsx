import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { findSlots, type DemoState } from '../../domain';
import { isActive, slotKey, validateSlot } from '../../domain/scheduling';
import { byId, personLabel, proName, serviceName, STATUS_LABEL } from '../../domain/selectors';
import { addMinutes, diffMinutes, fmtShort, toMs } from '../../domain/time';
import { Button, EmptyState, Field, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { OutboxPipeline } from '../../ui/components';

function nextReminderJump(s: DemoState): number | null {
  const due = s.outbox.filter((o) => o.kind === 'recordatorio_24h' && o.status === 'programado' && toMs(o.dueAt) > toMs(s.clock)).sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt))[0];
  return due ? diffMinutes(due.dueAt, s.clock) : null;
}

export function ClockControls() {
  const s = useDemo();
  const { show, view } = useResult();
  const jump = nextReminderJump(s);
  const adv = (minutes: number) => { const r = dispatch({ type: 'advanceClock', minutes }); show(r); };
  return (
    <div className="card stack">
      <h2 style={{ fontSize: 20 }}>Reloj de muestra</h2>
      <p className="tabular"><strong>{fmtShort(s.clock)}</strong> · America/Argentina/Buenos_Aires</p>
      <div className="row wrap">
        <Button size="sm" onClick={() => adv(10)}>+10 min</Button>
        <Button size="sm" onClick={() => adv(60)}>+1 h</Button>
        <Button size="sm" onClick={() => adv(60 * 24)}>+1 día</Button>
        <Button size="sm" variant="quiet" disabled={jump === null} onClick={() => jump !== null && adv(jump)}>Ir a 24 h antes del próximo turno{jump !== null ? ` (+${Math.round(jump / 60)} h)` : ''}</Button>
      </div>
      <p className="small muted">Avanzar ejecuta automatizaciones locales (A05 recordatorios, vencimiento de ofertas y presupuestos). Repetir no duplica: clave cita+versión+tipo.</p>
      {view}
    </div>
  );
}

export function Waitlist() {
  const s = useDemo();
  const { show, view } = useResult();
  const [form, setForm] = useDraft('wait:form', { personId: '', serviceTypeId: 'ST-CONTROL', locationId: '', period: 'cualquiera' as 'cualquiera' | 'mañana' | 'tarde', validDays: '30' });
  const [outFilter, setOutFilter] = useState('');
  const entries = s.waitlist.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const activeOffers = s.offers.filter((o) => o.status === 'activa');
  const vacancies = s.appointments.filter((a) => a.status === 'cancelada' && toMs(a.start) > toMs(s.clock) && validateSlot(s, { start: a.start, end: a.end, professionalId: a.professionalId, chairId: a.chairId, locationId: a.locationId, serviceTypeId: a.serviceTypeId }, { ignoreOfferSlot: true }).length === 0);
  const grouped = new Map<string, typeof activeOffers>();
  for (const o of activeOffers) grouped.set(slotKey(o.slot), [...(grouped.get(slotKey(o.slot)) ?? []), o]);
  const competing = [...grouped.values()].filter((g) => g.length > 1);
  const outbox = s.outbox.filter((o) => !outFilter || o.status === outFilter).slice().reverse();

  return (
    <section className="page">
      <PageHeader eyebrow="M12 · Recepción" title="Lista de espera y recordatorios">
        Una oferta no es una reserva: retiene el cupo {s.settings.holdMinutes} min de muestra y gana la primera aceptación válida. Rechazar no penaliza. Nada se envía de verdad.
      </PageHeader>
      {view}
      <div className="ops">
        <div className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Vacantes liberadas</h2>
            {vacancies.length === 0 ? <p className="muted">No hay cupos liberados por cancelación todavía. Cancelá un turno para ver A06.</p> : vacancies.map((a) => {
              const slot = { start: a.start, end: a.end, professionalId: a.professionalId, chairId: a.chairId, locationId: a.locationId, serviceTypeId: a.serviceTypeId };
              const cands = s.waitlist.filter((w) => w.status === 'activa' && w.serviceTypeId === a.serviceTypeId && (!w.locationId || w.locationId === a.locationId) && (!w.professionalId || w.professionalId === a.professionalId) && !w.rejectedSlotKeys.includes(slotKey(slot)));
              return (
                <div key={a.id} className="list-item">
                  <strong className="tabular">{fmtShort(a.start)} · {serviceName(s, a.serviceTypeId)} · {proName(s, a.professionalId)}</strong>
                  <span className="small muted">Liberado por cancelación de {a.id}. Candidatos compatibles: {cands.length}</span>
                  <div className="row wrap">{cands.map((w) => <Button key={w.id} size="sm" variant="quiet" onClick={() => show(dispatch({ type: 'offerCreate', waitlistEntryId: w.id, slot }))}>Ofrecer a {personLabel(s, w.personId)}</Button>)}</div>
                </div>
              );
            })}
          </div>

          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Ofertas</h2>
            {competing.length > 0 && (
              <Notice tone="warn" title="Ofertas compitiendo por el mismo cupo" action={<Button variant="primary" onClick={() => {
                const g = competing[0];
                const results = g.map((o) => ({ o, r: dispatch({ type: 'offerAccept', offerId: o.id }) }));
                const text = results.map(({ o, r }) => `${o.personId}: ${r.ok ? 'obtuvo el cupo' : r.message}`).join(' · ');
                show({ ok: true, message: `Aceptación simultánea simulada → ${text}` }); announce(text);
              }}>Simular aceptación simultánea</Button>}>
                {competing[0].map((o) => o.personId).join(' y ')} recibieron el mismo cupo. Solo una aceptación puede ganar.
              </Notice>
            )}
            {s.offers.length === 0 ? <p className="muted">Sin ofertas.</p> : (
              <ul className="list">{s.offers.slice().reverse().map((o) => {
                const left = diffMinutes(o.holdUntil, s.clock);
                return (
                  <li key={o.id} className="list-item">
                    <div className="row between"><strong>{o.id} · {personLabel(s, o.personId)}</strong><StatusBadge status={o.status} /></div>
                    <span className="small tabular">{fmtShort(o.slot.start)} · {serviceName(s, o.slot.serviceTypeId)} · {proName(s, o.slot.professionalId)}{o.status === 'activa' ? ` · vence en ${Math.max(0, left)} min de muestra` : ''}{o.appointmentId ? ` · turno ${o.appointmentId}` : ''}</span>
                    {o.status === 'activa' && <div className="hold" role="img" aria-label={`Retención: quedan ${Math.max(0, left)} de ${s.settings.holdMinutes} minutos de muestra`}><span style={{ width: `${Math.max(0, Math.min(100, (left / s.settings.holdMinutes) * 100))}%` }} /></div>}
                    {o.status === 'activa' && <div className="row wrap"><Button size="sm" variant="primary" onClick={() => show(dispatch({ type: 'offerAccept', offerId: o.id }))}>Aceptar (como paciente)</Button><Button size="sm" onClick={() => show(dispatch({ type: 'offerReject', offerId: o.id }))}>Rechazar sin penalización</Button></div>}
                    {o.status === 'tomada_por_otro' && <span className="small muted">Sigue en lista de espera; recepción puede ofrecer otra opción.</span>}
                  </li>
                );
              })}</ul>
            )}
          </div>

          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Lista de espera</h2>
            {entries.length === 0 ? <EmptyState title="Nadie en espera" /> : (
              <ul className="list">{entries.map((w) => {
                const slots = w.status === 'activa' ? findSlots(s, { serviceTypeId: w.serviceTypeId, professionalId: w.professionalId, locationId: w.locationId, period: w.period, limit: 2, personId: w.personId, excludeKeys: w.rejectedSlotKeys }) : [];
                return (
                  <li key={w.id} className="list-item">
                    <div className="row between"><strong>{w.id} · {personLabel(s, w.personId)}</strong><StatusBadge status={w.status} /></div>
                    <span className="small muted">{serviceName(s, w.serviceTypeId)} · {w.locationId ? byId(s.locations, w.locationId)?.name : 'cualquier sede'} · {w.period} · vigente hasta {fmtShort(w.validUntil)}{w.rejectedSlotKeys.length ? ` · rechazó ${w.rejectedSlotKeys.length}` : ''}</span>
                    {w.status === 'activa' && (
                      <div className="row wrap">
                        {slots.map((x) => <Button key={slotKey(x)} size="sm" variant="quiet" onClick={() => show(dispatch({ type: 'offerCreate', waitlistEntryId: w.id, slot: x }))}>Ofrecer {fmtShort(x.start)}</Button>)}
                        {slots.length === 0 && <span className="small muted">Sin cupos compatibles ahora.</span>}
                        <Button size="sm" variant="ghost" onClick={() => show(dispatch({ type: 'waitlistRemove', entryId: w.id }))}>Retirar</Button>
                      </div>
                    )}
                  </li>
                );
              })}</ul>
            )}
            <fieldset className="stack">
              <legend>Sumar a la lista</legend>
              <div className="form-grid">
                <Field label="Persona">{(p) => <select {...p} value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })}><option value="">Elegí</option>{s.persons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName}</option>)}</select>}</Field>
                <Field label="Motivo">{(p) => <select {...p} value={form.serviceTypeId} onChange={(e) => setForm({ ...form, serviceTypeId: e.target.value })}>{s.serviceTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
                <Field label="Sede">{(p) => <select {...p} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">Cualquiera</option>{s.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
                <Field label="Franja">{(p) => <select {...p} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as typeof form.period })}><option value="cualquiera">Cualquiera</option><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select>}</Field>
                <Field label="Vigencia (días)">{(p) => <input {...p} inputMode="numeric" value={form.validDays} onChange={(e) => setForm({ ...form, validDays: e.target.value.replace(/\D/g, '') })} />}</Field>
              </div>
              <Button disabled={!form.personId} onClick={() => show(dispatch({ type: 'waitlistAdd', personId: form.personId, serviceTypeId: form.serviceTypeId, professionalId: null, locationId: form.locationId || null, period: form.period, validDays: Number(form.validDays) }))}>Sumar</Button>
            </fieldset>
          </div>
        </div>

        <aside className="stack">
          <ClockControls />
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Outbox simulado</h2>
            <p className="small">Cupo de muestra restante: <strong className="tabular">{s.settings.reminderQuota}</strong></p>
            <Field label="Estado">{(p) => <select {...p} value={outFilter} onChange={(e) => setOutFilter(e.target.value)}><option value="">Todos</option>{['programado', 'entregado_simulado', 'anulado', 'bloqueado_optout', 'sin_cupo'].map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>}</Field>
            <ul className="list" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {outbox.slice(0, 40).map((o) => {
                const a = byId(s.appointments, o.appointmentId);
                return (
                  <li key={o.id} className="list-item">
                    <div className="row between"><span className="small"><span className="code">{o.id}</span> {o.kind.replace('_', ' ')}</span><StatusBadge status={o.status} /></div>
                    <span className="small muted tabular">{o.appointmentId} v{o.appointmentVersion}{a && isActive(a) && a.version !== o.appointmentVersion ? ' (versión vieja)' : ''} · {o.kind === 'recordatorio_24h' ? `vence ${fmtShort(o.dueAt)}` : fmtShort(o.createdAt)} · {o.ruleId}</span>
                    <OutboxPipeline o={o} />
                  </li>
                );
              })}
            </ul>
            <p className="small muted">Mostrando {Math.min(40, outbox.length)} de {outbox.length}. Hold de oferta: {s.settings.holdMinutes} min · próximo vencimiento {activeOffers[0] ? fmtShort(addMinutes(activeOffers[0].holdUntil, 0)) : '—'}.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
