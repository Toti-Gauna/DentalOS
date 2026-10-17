// Presupuestos en el portal (lote 5 · R-FLW-02): ver, consultar y aceptar administrativamente.
// Aceptar no es pagar ni tener el tratamiento hecho. Un menor no decide: lo hace su adulto responsable.
import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import type { Estimate } from '../../domain';
import { byId, decidersFor, dependentsOf, estimateTotals, money, personLabel, proName } from '../../domain/selectors';
import { fmtShort } from '../../domain/time';
import { Button, ConfirmDialog, Notice, StatusBadge, announce } from '../../ui/kit';
import { MoneySummary } from '../../ui/components';

function EstimateCard({ e, actingId, onResult }: { e: Estimate; actingId: string; onResult: (ok: boolean, msg: string) => void }) {
  const s = useDemo();
  const [ask, setAsk] = useState<null | 'aceptado' | 'rechazado'>(null);
  const lines = s.estimateLines.filter((l) => l.estimateId === e.id);
  const t = estimateTotals(s, e);
  const deciders = decidersFor(s, e.personId);
  const canDecide = deciders.some((d) => d.id === actingId);
  const patient = byId(s.persons, e.personId);
  const forDependent = e.personId !== actingId;
  const decide = (to: 'aceptado' | 'rechazado') => {
    const r = dispatch({ commandId: `portal-est:${e.id}:${to}`, type: 'estimateTransition', estimateId: e.id, to, actorId: actingId });
    announce(r.message); onResult(r.ok, r.message); setAsk(null);
  };
  return (
    <article className="estimate-card" aria-labelledby={`est-${e.id}`}>
      <header className="estimate-head">
        <div>
          <h3 id={`est-${e.id}`}>Presupuesto <span className="tabular">{e.id}</span>{forDependent && <> · para {patient?.firstName}</>}</h3>
          <p className="small muted">{proName(s, e.professionalId)}{e.issuedAt ? ` · emitido ${fmtShort(e.issuedAt)}` : ''}{e.validUntil && e.status === 'emitido' ? ` · vigente hasta ${fmtShort(e.validUntil)}` : ''}</p>
        </div>
        <StatusBadge status={e.status} />
      </header>
      <table className="estimate-lines">
        <caption className="sr-only">Detalle del presupuesto {e.id}</caption>
        <thead><tr><th scope="col">Concepto</th><th scope="col">Cant.</th><th scope="col">Importe</th></tr></thead>
        <tbody>
          {lines.map((l) => <tr key={l.id}><td>{l.description}{l.tooth ? <span className="muted"> · pieza {l.tooth}</span> : null}</td><td className="tabular">{l.qty}</td><td className="tabular">{money(l.qty * l.unitMinor)}</td></tr>)}
        </tbody>
        <tfoot><tr><th scope="row" colSpan={2}>Total presupuestado</th><td className="tabular"><strong>{money(t.total)}</strong></td></tr></tfoot>
      </table>
      <p className="small muted">{e.coverageNote} Importes ficticios de la demo.</p>
      {e.status === 'aceptado' && (
        <section aria-label="Saldo y pagos simulados" className="stack">
          <h4 className="estimate-sub">Saldo y pagos simulados (aparte de la aceptación)</h4>
          <MoneySummary total={t.total} accepted paid={t.paid} balance={t.balance} />
          {e.decidedBy && <p className="small muted">Aceptó: {personLabel(s, e.decidedBy)}{e.decidedAt ? ` · ${fmtShort(e.decidedAt)}` : ''}. Aceptar no es pagar ni tener el tratamiento hecho.</p>}
        </section>
      )}
      {e.status === 'rechazado' && e.decidedBy && <p className="small muted">No aceptado por {personLabel(s, e.decidedBy)}.</p>}
      {e.status === 'emitido' && (
        canDecide ? (
          <div className="row wrap">
            <Button variant="primary" icon="check" onClick={() => setAsk('aceptado')}>Aceptar presupuesto</Button>
            <Button onClick={() => setAsk('rechazado')}>No aceptar</Button>
            <Button variant="ghost" icon="chat" onClick={() => { const r = dispatch({ commandId: `portal-est:${e.id}:consulta`, type: 'estimateFollowUp', estimateId: e.id }); announce(r.message); onResult(r.ok, r.ok ? 'Recepción te contacta para explicarlo (simulado).' : r.message); }}>Tengo una consulta</Button>
          </div>
        ) : (
          <Notice tone="info" title="Lo decide su adulto responsable">
            {patient?.kind === 'menor'
              ? `Es un presupuesto de una persona menor de edad. Puede aceptarlo ${deciders.map((d) => `${d.firstName} ${d.lastName}`).join(' o ') || 'su adulto responsable (no hay uno registrado)'}.`
              : 'Solo puede decidirlo la persona titular.'}
          </Notice>
        )
      )}
      <ConfirmDialog open={!!ask} title={ask === 'aceptado' ? `¿Aceptar el presupuesto ${e.id}?` : `¿No aceptar el presupuesto ${e.id}?`} confirmLabel={ask === 'aceptado' ? 'Aceptar' : 'No aceptar'}
        onCancel={() => setAsk(null)} onConfirm={() => ask && decide(ask)}>
        {ask === 'aceptado'
          ? <>Es una aceptación administrativa de la demo{forDependent ? `, como responsable de ${patient?.firstName}` : ''}. <strong>No es un pago</strong> ni deja el tratamiento hecho: la profesional coordina cada paso en consulta.</>
          : <>Queda registrado que no aceptás este presupuesto. Podés consultar a recepción si tenés dudas.</>}
      </ConfirmDialog>
    </article>
  );
}

/** Presupuestos emitidos o decididos (los borradores no se muestran). `viewerId` es el adulto que usa el portal y decide;
 *  `personId` es la persona elegida en “Gestionar turnos de”: si es el propio adulto, se ven también los de sus dependientes. */
export function PatientEstimates({ personId, viewerId }: { personId: string; viewerId: string }) {
  const s = useDemo();
  const actingId = viewerId;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ids = personId === viewerId ? [viewerId, ...dependentsOf(s, viewerId).map((d) => d.person.id)] : [personId];
  const list = s.estimates.filter((e) => ids.includes(e.personId) && e.status !== 'borrador');
  return (
    <section className="stack" aria-labelledby="est-title">
      <h2 id="est-title">Presupuestos</h2>
      {msg && <Notice tone={msg.ok ? 'ok' : 'error'} title={msg.text} />}
      {list.length === 0
        ? <p className="muted">No hay presupuestos emitidos{ids.length > 1 ? ' para vos ni para quienes tenés a cargo' : personId !== viewerId ? ' para esta persona' : ''}.</p>
        : list.map((e) => <EstimateCard key={e.id} e={e} actingId={actingId} onResult={(ok, text) => setMsg({ ok, text })} />)}
    </section>
  );
}
