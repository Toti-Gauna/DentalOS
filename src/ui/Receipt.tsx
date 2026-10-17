// Comprobante de turno (lote 4): boleto de papel con talón, fecha en serif y los datos que recepción ve igual.
// No es un comprobante de pago ni de atención realizada, y lo dice. El código QR llega en el lote 7.
import type { Appointment } from '../domain';
import { useDemo } from '../app/store';
import { chairName, locName, personLabel, proName, serviceName } from '../domain/selectors';
import { fmtLong, fmtShort, parts } from '../domain/time';
import { StatusBadge } from './kit';
import { SpotArt } from './art/editorial';

const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function AppointmentReceipt({ a }: { a: Appointment }) {
  const s = useDemo();
  const p = parts(a.start);
  const end = parts(a.end);
  const requested = a.status === 'solicitada';
  return (
    <article className="receipt" aria-labelledby={`rc-${a.id}`}>
      <div className="receipt-main">
        <header className="receipt-head">
          <p className="eyebrow">Clínica Brisa · {requested ? 'solicitud de turno' : 'comprobante de turno'} · demo</p>
          <StatusBadge status={a.status} />
        </header>
        <div className="receipt-date">
          <span className="receipt-day tabular" aria-hidden="true">{p.day}</span>
          <p className="receipt-when"><span>{DOW[p.weekday]}</span><span>{MONTHS[p.month - 1]} {p.year}</span><strong className="tabular">{p.hhmm}–{end.hhmm} h</strong></p>
        </div>
        <h2 id={`rc-${a.id}`} className="receipt-service">{serviceName(s, a.serviceTypeId)}<span className="sr-only"> · {fmtLong(a.start)}</span></h2>
        <dl className="receipt-data">
          <div><dt>Profesional</dt><dd>{proName(s, a.professionalId)}</dd></div>
          <div><dt>Sede y sillón</dt><dd>{locName(s, a.locationId)} · {chairName(s, a.chairId)}</dd></div>
          <div><dt>Para</dt><dd>{personLabel(s, a.personId)}</dd></div>
          {a.requestId && <div><dt>Solicitud</dt><dd className="tabular">{a.requestId}</dd></div>}
        </dl>
        <p className="receipt-fine small">Emitido en este dispositivo · reloj de muestra {fmtShort(s.clock)}. No es un comprobante de pago ni de atención realizada.</p>
      </div>
      <div className="receipt-stub" aria-label={`Turno ${a.id}, versión ${a.version}`}>
        <SpotArt kind="comprobante" size={96} />
        <p className="receipt-id"><span className="small muted">Turno</span><strong className="tabular">{a.id}</strong><span className="small muted">versión {a.version}</span></p>
      </div>
    </article>
  );
}
