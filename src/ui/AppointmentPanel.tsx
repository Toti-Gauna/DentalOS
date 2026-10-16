import { useState } from 'react';
import { dispatch, useDemo } from '../app/store';
import { navigate } from '../app/router';
import type { Appointment } from '../domain';
import { byId, chairName, locName, personLabel, proName, serviceName } from '../domain/selectors';
import { fmtLong, fmtShort, parts, toMs } from '../domain/time';
import { Button, ConfirmDialog, Drawer, StatusBadge, announce, useResult } from './kit';
import { RescheduleDrawer } from './RescheduleDrawer';

/** Acciones de recepción sobre un turno, según estado permitido. */
export function AppointmentActions({ a, compact = false, onOpen }: { a: Appointment; compact?: boolean; onOpen?: () => void }) {
  const s = useDemo();
  const [moving, setMoving] = useState(false);
  const [cancel, setCancel] = useState(false);
  const { show, view } = useResult();
  const isToday = parts(a.start).date === parts(s.clock).date;
  const ended = toMs(a.end) <= toMs(s.clock);
  const run = (cmd: Parameters<typeof dispatch>[0]) => show(dispatch(cmd));
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row wrap">
        {a.status === 'solicitada' && <Button size="sm" variant="primary" icon="check" onClick={() => run({ type: 'confirmAppointment', appointmentId: a.id })}>Confirmar</Button>}
        {a.status === 'confirmada' && isToday && !ended && <Button size="sm" variant="quiet" icon="user" onClick={() => run({ type: 'transition', appointmentId: a.id, to: 'en_sala' })}>Check-in</Button>}
        {a.status === 'en_sala' && <Button size="sm" variant="quiet" icon="tooth" onClick={() => run({ type: 'transition', appointmentId: a.id, to: 'en_atencion' })}>En atención</Button>}
        {a.status === 'en_atencion' && <Button size="sm" variant="quiet" icon="check" onClick={() => run({ type: 'transition', appointmentId: a.id, to: 'finalizada' })}>Finalizar</Button>}
        {(a.status === 'confirmada' || a.status === 'solicitada') && ended && <Button size="sm" icon="info" onClick={() => run({ type: 'transition', appointmentId: a.id, to: 'ausente' })}>Registrar ausencia</Button>}
        {(a.status === 'confirmada' || a.status === 'solicitada') && !ended && <Button size="sm" icon="calendar" onClick={() => setMoving(true)}>Cambiar</Button>}
        {(a.status === 'confirmada' || a.status === 'solicitada') && !ended && !compact && <Button size="sm" variant="ghost" icon="x" onClick={() => setCancel(true)}>Cancelar</Button>}
        {onOpen && <Button size="sm" variant="ghost" onClick={onOpen}>Detalle</Button>}
      </div>
      {view}
      {moving && <RescheduleDrawer appointmentId={a.id} channel="recepcion" onClose={() => setMoving(false)} />}
      <ConfirmDialog open={cancel} title={`¿Cancelar ${a.id}?`} confirmLabel="Sí, cancelar" cancelLabel="No, mantener" tone="danger" onCancel={() => setCancel(false)}
        onConfirm={() => { setCancel(false); const r = dispatch({ commandId: `cancel:${a.id}:v${a.version}`, type: 'cancel', appointmentId: a.id, reason: 'Cancelado por recepción (muestra)', channel: 'recepcion' }); show(r); announce(r.message); }}>
        {personLabel(s, a.personId)} · {serviceName(s, a.serviceTypeId)} · {fmtLong(a.start)}. El cupo queda libre y se anula el recordatorio.
      </ConfirmDialog>
    </div>
  );
}

export function AppointmentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useDemo();
  const a = byId(s.appointments, id);
  if (!a) {
    return <Drawer open title="Turno no encontrado" onClose={onClose}><p>El turno {id} ya no existe (¿se restableció la demo?).</p></Drawer>;
  }
  const events = s.audit.filter((e) => e.entityId === a.id).slice().reverse();
  const outbox = s.outbox.filter((o) => o.appointmentId === a.id).slice().reverse();
  const req = byId(s.requests, a.requestId);
  return (
    <Drawer open title={`${serviceName(s, a.serviceTypeId)} · ${a.id}`} onClose={onClose}>
      <div className="row wrap"><StatusBadge status={a.status} /><span className="tag">versión {a.version}</span><span className="tag">origen {a.origin}</span>{a.patientConfirmedVersion === a.version && <span className="tag">asistencia confirmada por la persona</span>}</div>
      <dl className="kv">
        <dt>Persona</dt><dd><a href={`#/admin/personas/${a.personId}`}>{personLabel(s, a.personId)}</a></dd>
        <dt>Cuándo</dt><dd className="tabular">{fmtLong(a.start)} – {parts(a.end).hhmm}</dd>
        <dt>Recursos</dt><dd>{proName(s, a.professionalId)} · {locName(s, a.locationId)} · {chairName(s, a.chairId)}</dd>
        {req && <><dt>Solicitud</dt><dd><span className="code">{req.id}</span> <StatusBadge status={req.status} /> {req.summary}</dd></>}
        {a.episodeId && <><dt>Episodio</dt><dd><a href="#/admin/ortodoncia">{a.episodeId}</a> · control {a.controlId}</dd></>}
        {a.cancelReason && <><dt>Motivo</dt><dd>{a.cancelReason}</dd></>}
      </dl>
      <AppointmentActions a={a} />
      <section>
        <h3>Outbox simulado</h3>
        {outbox.length === 0 ? <p className="muted">Sin elementos.</p> : (
          <ul className="list">{outbox.map((o) => <li key={o.id} className="list-item"><div className="row between"><span><span className="code">{o.id}</span> {o.kind.replace('_', ' ')} · v{o.appointmentVersion}</span><StatusBadge status={o.status} /></div><span className="small muted">{o.text} · clave <span className="code">{o.dedupeKey}</span> · {o.ruleId}</span></li>)}</ul>
        )}
      </section>
      <section>
        <h3>Historial (auditoría local)</h3>
        <ul className="timeline">{events.map((e) => <li key={e.id}><strong className="tabular">{fmtShort(e.at)}</strong> · {e.type.replace(/_/g, ' ')}<br /><span className="small">{e.detail}</span></li>)}</ul>
      </section>
      <Button variant="ghost" onClick={() => { onClose(); navigate(`/admin/personas/${a.personId}`); }}>Abrir ficha</Button>
    </Drawer>
  );
}
