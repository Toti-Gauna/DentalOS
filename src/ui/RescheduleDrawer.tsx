import { useMemo, useState } from 'react';
import { dispatch, useDemo } from '../app/store';
import { findSlots, type Channel, type SlotRef } from '../domain';
import { slotKey } from '../domain/scheduling';
import { byId, chairName, locName, proName, serviceName } from '../domain/selectors';
import { addDays, at, fmtLong, fmtShort, parts, toMs } from '../domain/time';
import { Button, Drawer, EmptyState, Icon, Notice, announce } from './kit';
import { ConflictNotice, agendaLink } from './components';

/** Reprogramación atómica: mismo Appointment.id, versión +1, recordatorio viejo anulado. Ante fallo se conserva el original. */
export function RescheduleDrawer({ appointmentId, channel, onClose, onDone }: { appointmentId: string; channel: Channel; onClose: () => void; onDone?: (id: string) => void }) {
  const s = useDemo();
  const a = byId(s.appointments, appointmentId);
  const [chosen, setChosen] = useState<SlotRef | null>(null);
  const [from, setFrom] = useState(parts(s.clock).date);
  const [result, setResult] = useState<{ ok: boolean; message: string; conflicts?: { message: string }[] } | null>(null);
  const [pinnedVersion] = useState(a?.version ?? 0);
  const slots = useMemo(() => (a ? findSlots(s, { serviceTypeId: a.serviceTypeId, professionalId: a.professionalId, from: at(from, '00:00'), limit: 6, ignoreAppointmentId: a.id, personId: a.personId }).filter((x) => x.start !== a.start) : []), [s, a, from]);
  if (!a) return null;
  const hoursLeft = (toMs(a.start) - toMs(s.clock)) / 3_600_000;
  const inWindow = channel !== 'recepcion' && hoursLeft < s.settings.changeWindowHours;
  const changedMeanwhile = a.version !== pinnedVersion && !result?.ok;

  const confirm = () => {
    if (!chosen) return;
    const r = dispatch({ commandId: `resched:${a.id}:v${a.version}:${chosen.start}:${chosen.chairId}`, type: 'reschedule', appointmentId: a.id, start: chosen.start, chairId: chosen.chairId, channel, expectedVersion: a.version });
    setResult(r.ok ? { ok: true, message: `${r.message}` } : { ok: false, message: `${r.message.includes('Conservamos') ? r.message : r.message + ' Conservamos tu turno anterior.'}`, conflicts: r.conflicts });
    announce(r.ok ? 'Cambio guardado. Mismo turno, nueva versión.' : 'No se aplicó el cambio. Conservamos tu turno anterior.');
    if (r.ok) { setChosen(null); onDone?.(a.id); }
  };

  return (
    <Drawer open title={`Cambiar ${serviceName(s, a.serviceTypeId).toLowerCase()} · ${a.id}`} onClose={onClose} footer={
      result?.ok ? <Button variant="primary" onClick={onClose} data-autofocus>Listo</Button> : (
        <>
          <Button onClick={onClose}>Volver sin cambiar</Button>
          {!inWindow && <Button variant="primary" icon="check" disabled={!chosen} onClick={confirm}>{result && !result.ok ? 'Reintentar cambio' : 'Confirmar cambio'}</Button>}
        </>
      )}>
      <div className="box card" style={{ padding: 12 }}>
        <p className="eyebrow">Turno actual · versión {a.version}</p>
        <p><strong className="tabular">{fmtLong(a.start)}</strong><br />{proName(s, a.professionalId)} · {locName(s, a.locationId)} · {chairName(s, a.chairId)}</p>
      </div>
      {changedMeanwhile && <Notice tone="warn" title="El turno cambió mientras mirabas">Ahora es versión {a.version}. Revisá antes de confirmar.</Notice>}
      {result && (result.ok ? (
        <Notice tone="ok" title={result.message} action={channel !== 'recepcion' ? <a className="btn btn-sm btn-secondary" href={agendaLink(a)} onClick={onClose}><Icon name="calendar" size={16} /> Ver el mismo turno en recepción</a> : undefined}>
          Recepción ve el mismo turno <span className="code">{a.id}</span> actualizado (versión {a.version}). El recordatorio de la versión anterior quedó anulado. No enviamos mensajes reales.
        </Notice>
      ) : (
        <ConflictNotice title={result.message.replace(' Conservamos tu turno anterior.', '')} conflicts={result.conflicts} keptLabel={`Conservamos tu turno anterior: ${fmtShort(a.start)} (versión ${a.version}).`} />
      ))}
      {inWindow ? (
        <Notice tone="warn" title={`Faltan menos de ${s.settings.changeWindowHours} h para el turno`} action={
          <Button variant="primary" onClick={() => { const r = dispatch({ type: 'requestHumanChange', appointmentId: a.id, channel }); setResult({ ok: r.ok, message: r.message }); announce(r.message); }}>Pedir ayuda a recepción</Button>}>
          El cambio por autoservicio no está disponible en esta ventana de muestra. Recepción lo revisa; tu turno sigue igual hasta entonces.
        </Notice>
      ) : !result?.ok && (
        <>
          <div className="field">
            <label htmlFor="rs-from">Buscar desde</label>
            <input id="rs-from" type="date" min={parts(s.clock).date} max={addDays(parts(s.clock).date, s.settings.horizonDays - 1)} value={from} onChange={(e) => { setFrom(e.target.value || parts(s.clock).date); setChosen(null); }} />
          </div>
          {slots.length === 0 ? <EmptyState title="Sin horarios compatibles" icon="calendar">Probá otra fecha o pedí ayuda a recepción. Tu turno original sigue reservado.</EmptyState> : (
            <fieldset>
              <legend>Horarios compatibles con {proName(s, a.professionalId)}</legend>
              <ul className="list">
                {slots.map((x) => (
                  <li key={slotKey(x)}>
                    <label className="list-item" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="radio" name="rs-slot" checked={!!chosen && slotKey(chosen) === slotKey(x)} onChange={() => { setChosen(x); setResult(null); }} />
                      <span><strong className="tabular">{fmtShort(x.start)}</strong> <span className="muted small">· {locName(s, x.locationId)} · {chairName(s, x.chairId)}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {chosen && (
            <div className="compare" aria-label="Antes y después">
              <div className="box"><p className="eyebrow">Antes · v{a.version}</p><p className="tabular">{fmtShort(a.start)}</p></div>
              <span className="arrow"><Icon name="arrow" /></span>
              <div className="box after"><p className="eyebrow">Después · v{a.version + 1}</p><p className="tabular">{fmtShort(chosen.start)}</p></div>
            </div>
          )}
          {chosen && <p className="small muted">Mismo turno <span className="code">{a.id}</span>. El cambio se guarda solo al confirmar; volver o cerrar no cambia nada.</p>}
          {chosen && <Button variant="ghost" size="sm" onClick={() => {
            const r = dispatch({ type: 'addBlock', scope: 'professional', targetId: chosen.professionalId, start: chosen.start, end: chosen.end, reason: 'Ocupado por otra gestión (simulación de competencia)' });
            announce(r.ok ? 'Simulación: el horario se ocupó. Probá confirmar: tu turno original se conserva.' : r.message);
          }}><Icon name="user" size={14} /> Simular que el horario se ocupa antes de confirmar</Button>}
        </>
      )}
    </Drawer>
  );
}
