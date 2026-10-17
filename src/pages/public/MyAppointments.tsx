import { useState } from 'react';
import { dispatch, useDemo, useLastChange } from '../../app/store';
import { navigate } from '../../app/router';
import { useUi } from '../../app/ui-state';
import type { Appointment } from '../../domain';
import { byId, pastFor, personLabel, serviceName, upcomingFor } from '../../domain/selectors';
import { fmtLong, toMs } from '../../domain/time';
import { Button, ConfirmDialog, EmptyState, Icon, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { RescheduleDrawer } from '../../ui/RescheduleDrawer';
import { TurnoCard, agendaLink } from '../../ui/components';
import { PersonPicker } from './PersonPicker';

export function MyAppointments() {
  const s = useDemo();
  const ui = useUi();
  const last = useLastChange();
  const person = byId(s.persons, ui.actingPersonId);
  const [moving, setMoving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');
  const { show, view } = useResult();

  const upcoming = person ? upcomingFor(s, person.id) : [];
  const past = person ? pastFor(s, person.id) : [];
  const requests = person ? s.requests.filter((r) => r.personId === person.id && (r.status === 'pendiente' || r.status === 'asignada')) : [];
  const changed = last && upcoming.find((a) => a.id === last.appointmentId);

  return (
    <section className="page">
      <PageHeader eyebrow="M03 · Mis turnos" title="Mis turnos" actions={<Button variant="primary" icon="calendar" onClick={() => navigate('/reservar')}>Pedir turno</Button>}>
        Tus próximos pasos, con el mismo número de turno que ve recepción. Si sos responsable, elegí de quién: cada persona ve solo sus turnos.
      </PageHeader>
      <PersonPicker />
      {view}
      {changed && (
        <Notice tone="ok" title={`${changed.id} quedó guardado en esta demo (versión ${changed.version})`} action={<a className="btn btn-sm btn-secondary" href={agendaLink(changed)}><Icon name="calendar" size={16} /> Ver el mismo turno en recepción</a>}>
          Recepción ve exactamente este turno. No enviamos mensajes reales.
        </Notice>
      )}
      {!person ? <EmptyState title="Elegí una persona de muestra" /> : (
        <div className="ops">
          <div className="stack-lg">
            <section className="stack" aria-labelledby="up-title">
              <div className="section-title"><h2 id="up-title">Próximos</h2><span className="muted small tabular">{upcoming.length} activo(s)</span></div>
              {upcoming.length === 0 ? <EmptyState title={`${person.firstName} no tiene turnos próximos`} icon="calendar" action={<Button variant="primary" onClick={() => navigate('/reservar')}>Pedir turno</Button>} /> : (
                <ul className="turno-list">
                  {upcoming.map((a) => {
                    const hours = (toMs(a.start) - toMs(s.clock)) / 3_600_000;
                    const reminder = s.outbox.filter((o) => o.appointmentId === a.id && o.kind === 'recordatorio_24h').at(-1);
                    const actionable = a.status === 'confirmada' || a.status === 'solicitada';
                    return (
                      <li key={a.id}>
                        <TurnoCard a={a} headingLevel="h3"
                          extra={<>
                            {a.status === 'solicitada' && <p className="small" style={{ margin: '4px 0 0' }}><Icon name="clock" size={14} /> Solicitud pendiente: el cupo está reservado y recepción la confirma.</p>}
                            {reminder && <p className="small muted" style={{ margin: 0 }}>Recordatorio simulado: {reminder.status === 'programado' ? `programado para la versión ${reminder.appointmentVersion}` : <StatusBadge status={reminder.status} />}</p>}
                            {actionable && hours < s.settings.changeWindowHours && <p className="small muted" style={{ margin: 0 }}>Faltan menos de {s.settings.changeWindowHours} h: el cambio lo revisa recepción.</p>}
                          </>}
                          actions={actionable ? <>
                            {a.status === 'confirmada' && a.patientConfirmedVersion !== a.version && <Button size="sm" variant="quiet" icon="check" onClick={() => show(dispatch({ type: 'patientConfirm', appointmentId: a.id }))}>Confirmar asistencia</Button>}
                            <Button size="sm" icon="calendar" onClick={() => setMoving(a.id)}>{hours < s.settings.changeWindowHours ? 'Pedir cambio' : 'Cambiar'}</Button>
                            <Button size="sm" variant="ghost" icon="x" onClick={() => { setCancelling(a); setReason(''); }}>Cancelar</Button>
                          </> : undefined} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="stack" aria-labelledby="past-title">
              <h2 id="past-title">Pasados y cancelados</h2>
              {past.length === 0 ? <p className="muted">Sin historial.</p> : <ul className="turno-list">{past.map((a) => <li key={a.id}><TurnoCard a={a} /></li>)}</ul>}
            </section>
          </div>
          <aside className="stack">
            <div className="card stack">
              <h2 style={{ fontSize: 20 }}>{personLabel(s, person.id)}</h2>
              <label className="choice">
                <input type="checkbox" checked={person.reminderOptIn} onChange={(e) => show(dispatch({ type: 'setReminderOptIn', personId: person.id, optIn: e.target.checked }))} />
                Quiero recordatorios simulados 24 h antes
              </label>
              <p className="small muted" style={{ margin: 0 }}>Opt-in ficticio: nada se envía de verdad.</p>
            </div>
            {requests.length > 0 && (
              <div className="card stack">
                <h3>Gestiones abiertas</h3>
                <ul className="list">{requests.map((r) => <li key={r.id} className="list-item"><span className="row between"><span className="code">{r.id}</span><StatusBadge status={r.status} /></span><span className="small">{r.summary}</span></li>)}</ul>
                <p className="small muted" style={{ margin: 0 }}>Una solicitud pendiente no es un turno confirmado.</p>
              </div>
            )}
            <Notice tone="info" title="¿Algo clínico?">El portal y los canales automáticos son administrativos. Para síntomas o medicación, pedí hablar con recepción.</Notice>
          </aside>
        </div>
      )}
      {moving && <RescheduleDrawer appointmentId={moving} channel="web" onClose={() => setMoving(null)} />}
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
