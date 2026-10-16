import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { navigate } from '../../app/router';
import { useUi } from '../../app/ui-state';
import type { Appointment } from '../../domain';
import { byId, chairName, locName, pastFor, personLabel, proName, serviceName, upcomingFor } from '../../domain/selectors';
import { fmtLong, fmtShort, toMs } from '../../domain/time';
import { Button, ConfirmDialog, EmptyState, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { RescheduleDrawer } from '../../ui/RescheduleDrawer';
import { PersonPicker } from './PersonPicker';

export function MyAppointments() {
  const s = useDemo();
  const ui = useUi();
  const person = byId(s.persons, ui.actingPersonId);
  const [moving, setMoving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const { show, view } = useResult();

  const upcoming = person ? upcomingFor(s, person.id) : [];
  const past = person ? pastFor(s, person.id) : [];
  const requests = person ? s.requests.filter((r) => r.personId === person.id && (r.status === 'pendiente' || r.status === 'asignada')) : [];

  return (
    <section className="page">
      <PageHeader eyebrow="M03 · Mis turnos" title="Mis turnos" actions={<Button variant="primary" icon="calendar" onClick={() => navigate('/reservar')}>Pedir turno</Button>}>
        Ves los turnos de la persona elegida por ID. Si sos responsable, cambiá de dependiente: cada uno ve solo los suyos.
      </PageHeader>
      <PersonPicker />
      {view}
      {!person ? <EmptyState title="Elegí una persona de muestra" /> : (
        <div className="ops">
          <div className="stack">
            <h2>Próximos</h2>
            {upcoming.length === 0 ? <EmptyState title={`${person.firstName} no tiene turnos próximos`} action={<Button variant="primary" onClick={() => navigate('/reservar')}>Pedir turno</Button>} /> : (
              <ul className="list">
                {upcoming.map((a) => {
                  const hours = (toMs(a.start) - toMs(s.clock)) / 3_600_000;
                  const reminder = s.outbox.filter((o) => o.appointmentId === a.id && o.kind === 'recordatorio_24h').at(-1);
                  return (
                    <li key={a.id} className={`list-item appt st-${a.status} ${highlight === a.id ? 'highlight' : ''}`}>
                      <div className="row between">
                        <h3 style={{ margin: 0 }}>{serviceName(s, a.serviceTypeId)}</h3>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="tabular" style={{ margin: 0 }}><strong>{fmtLong(a.start)}</strong></p>
                      <div className="meta">
                        <span>{proName(s, a.professionalId)}</span><span>{locName(s, a.locationId)} · {chairName(s, a.chairId)}</span>
                        <span>Turno <span className="code">{a.id}</span> · versión {a.version}</span>
                        {reminder && <span>Recordatorio: {reminder.status === 'programado' ? `programado (v${reminder.appointmentVersion})` : reminder.status.replace('_', ' ')}</span>}
                        {a.patientConfirmedVersion === a.version && <span>Asistencia confirmada</span>}
                      </div>
                      {a.status === 'solicitada' && <p className="small muted" style={{ margin: 0 }}>Solicitud pendiente: el cupo está reservado y recepción la confirma.</p>}
                      {(a.status === 'confirmada' || a.status === 'solicitada') && (
                        <div className="row wrap">
                          {a.status === 'confirmada' && a.patientConfirmedVersion !== a.version && <Button size="sm" variant="quiet" icon="check" onClick={() => show(dispatch({ type: 'patientConfirm', appointmentId: a.id }))}>Confirmar asistencia</Button>}
                          <Button size="sm" icon="calendar" onClick={() => setMoving(a.id)}>{hours < s.settings.changeWindowHours ? 'Pedir cambio' : 'Cambiar'}</Button>
                          <Button size="sm" variant="ghost" icon="x" onClick={() => { setCancelling(a); setReason(''); }}>Cancelar</Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <h2>Pasados y cancelados</h2>
            {past.length === 0 ? <p className="muted">Sin historial.</p> : (
              <ul className="list">
                {past.map((a) => (
                  <li key={a.id} className={`list-item appt st-${a.status}`}>
                    <div className="row between"><strong>{serviceName(s, a.serviceTypeId)}</strong><StatusBadge status={a.status} /></div>
                    <div className="meta"><span className="tabular">{fmtShort(a.start)}</span><span>{proName(s, a.professionalId)}</span><span className="code">{a.id}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="stack">
            <div className="card stack">
              <h2>{personLabel(s, person.id)}</h2>
              <label className="choice">
                <input type="checkbox" checked={person.reminderOptIn} onChange={(e) => show(dispatch({ type: 'setReminderOptIn', personId: person.id, optIn: e.target.checked }))} />
                Quiero recordatorios simulados 24 h antes
              </label>
              <p className="small muted">Opt-in ficticio: nada se envía de verdad.</p>
            </div>
            {requests.length > 0 && (
              <div className="card stack">
                <h3>Gestiones abiertas</h3>
                <ul className="plain">{requests.map((r) => <li key={r.id}><span className="code">{r.id}</span> · {r.summary} <StatusBadge status={r.status} /></li>)}</ul>
                <p className="small muted">Una solicitud pendiente no es un turno confirmado.</p>
              </div>
            )}
            <Notice tone="info" title="¿Algo clínico?">El portal y los canales automáticos son administrativos. Para síntomas o medicación, pedí hablar con recepción.</Notice>
          </aside>
        </div>
      )}
      {moving && <RescheduleDrawer appointmentId={moving} channel="web" onClose={() => setMoving(null)} onDone={(id) => setHighlight(id)} />}
      <ConfirmDialog open={!!cancelling} title="¿Cancelar este turno?" confirmLabel="Sí, cancelar este turno" cancelLabel="No, mantenerlo" tone="danger"
        onCancel={() => setCancelling(null)}
        onConfirm={() => {
          if (!cancelling) return;
          const r = dispatch({ commandId: `cancel:${cancelling.id}:v${cancelling.version}`, type: 'cancel', appointmentId: cancelling.id, reason, channel: 'web' });
          show(r.ok ? { ok: true, message: 'Turno cancelado. Recepción ve el mismo estado; el recordatorio quedó anulado.' } : r);
          announce(r.message);
          setCancelling(null);
        }}>
        {cancelling && <>
          <p><strong>{serviceName(s, cancelling.serviceTypeId)}</strong> · {fmtLong(cancelling.start)} · <span className="code">{cancelling.id}</span></p>
          <div className="field"><label htmlFor="cancel-reason">Motivo administrativo (opcional)</label><input id="cancel-reason" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} /></div>
        </>}
      </ConfirmDialog>
    </section>
  );
}
