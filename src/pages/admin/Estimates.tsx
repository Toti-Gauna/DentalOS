import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { byId, estimateTotals, ledgerNet, money, personLabel, personName, proName } from '../../domain/selectors';
import { fmtShort } from '../../domain/time';
import { Button, ConfirmDialog, EmptyState, Field, Kpi, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { MoneySummary } from '../../ui/components';

const toMinor = (v: string) => { const t = v.trim().replace(/\./g, '').replace(',', '.'); if (!t) return NaN; const n = Number(t); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

export function Estimates() {
  const s = useDemo();
  const [sel, setSel] = useDraft<string>('est:sel', s.estimates[0]?.id ?? '');
  const [newFor, setNewFor] = useState('');
  const { show, view } = useResult();
  const e = byId(s.estimates, sel);
  const net = ledgerNet(s);
  const accepted = s.estimates.filter((x) => x.status === 'aceptado');
  const acceptedTotal = accepted.reduce((acc, x) => acc + estimateTotals(s, x).total, 0);
  const acceptedBalance = accepted.reduce((acc, x) => acc + (estimateTotals(s, x).balance ?? 0), 0);
  return (
    <section className="page">
      <PageHeader eyebrow="M11 · Profesional / dirección" title="Presupuestos y caja ficticia">
        Importes de muestra en centavos enteros. Aceptado no es cobrado ni tratamiento realizado. Cobertura siempre "a verificar". Ningún cobro real.
      </PageHeader>
      <div className="kpis">
        <Kpi label="Caja ficticia neta" value={money(net)} detail={`${s.ledger.length} movimientos (incluye contrapartidas)`} />
        <Kpi label="Aceptado (no cobrado)" value={money(acceptedTotal)} detail={`${accepted.length} presupuesto(s) aceptado(s)`} />
        <Kpi label="Saldo pendiente de aceptados" value={money(acceptedBalance)} detail="total aceptado − movimientos vinculados" />
      </div>
      {view}
      <div className="ops">
        <div className="stack">
          {e ? <EstimateDetail id={e.id} show={show} /> : <EmptyState title="Elegí o creá un presupuesto" icon="wallet" />}
          <LedgerPanel show={show} />
        </div>
        <aside className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Presupuestos</h2>
            {s.estimates.length === 0 ? <p className="muted">Ninguno.</p> : (
              <ul className="list">{s.estimates.map((x) => { const t = estimateTotals(s, x); return (
                <li key={x.id}><button className="list-item" style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', borderColor: x.id === sel ? 'var(--primary)' : undefined }} aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>
                  <span className="row between"><strong>{x.id}</strong><StatusBadge status={x.status} /></span>
                  <span className="small">{personLabel(s, x.personId)} · <span className="tabular">{money(t.total)}</span></span>
                </button></li>); })}</ul>
            )}
            <div className="row wrap" style={{ alignItems: 'end' }}>
              <Field label="Nuevo borrador para">{(p) => <select {...p} value={newFor} onChange={(ev) => setNewFor(ev.target.value)}><option value="">Elegí persona</option>{s.persons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName}</option>)}</select>}</Field>
              <Button disabled={!newFor} onClick={() => { const r = dispatch({ type: 'estimateCreate', personId: newFor, professionalId: 'PR-01' }); show(r); if (r.ok) setSel(r.ids!.estimateId); }}>Crear</Button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

type Show = (r: { ok: boolean; message: string; conflicts?: { code: string; message: string }[] }) => void;

function EstimateDetail({ id, show }: { id: string; show: Show }) {
  const s = useDemo();
  const e = byId(s.estimates, id)!;
  const lines = s.estimateLines.filter((l) => l.estimateId === e.id);
  const t = estimateTotals(s, e);
  const [line, setLine] = useState({ description: '', tooth: '', qty: '1', amount: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const add = () => {
    const unit = toMinor(line.amount);
    const r = dispatch({ type: 'estimateAddLine', estimateId: e.id, description: line.description, tooth: line.tooth ? Number(line.tooth) : null, qty: Number(line.qty), unitMinor: Number.isNaN(unit) ? -1 : unit });
    if (!r.ok && r.conflicts) setErrors(Object.fromEntries(r.conflicts.map((c) => [c.code, c.message])));
    else setErrors({});
    show(r);
    if (r.ok) setLine({ description: '', tooth: '', qty: '1', amount: '' });
  };
  const tr = (to: 'emitido' | 'aceptado' | 'rechazado' | 'vencido') => show(dispatch({ type: 'estimateTransition', estimateId: e.id, to }));
  return (
    <div className="card stack">
      <div className="row between"><h2 style={{ fontSize: 20, margin: 0 }}>{e.id} · {personLabel(s, e.personId)}</h2><StatusBadge status={e.status} /></div>
      <p className="small muted">{proName(s, e.professionalId)} · creado {fmtShort(e.createdAt)}{e.issuedAt ? ` · emitido ${fmtShort(e.issuedAt)}` : ''}{e.validUntil ? ` · vigente hasta ${fmtShort(e.validUntil)}` : ''} · {e.coverageNote}</p>
      <MoneySummary total={t.total} accepted={e.status === 'aceptado'} paid={t.paid} balance={t.balance} />
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Líneas</caption>
          <thead><tr><th>Descripción</th><th>Pieza</th><th>Cant.</th><th>Unitario</th><th>Subtotal</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={6} className="muted">Sin líneas.</td></tr>}
            {lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="tabular">{l.tooth ?? '—'}</td><td className="tabular">{l.qty}</td><td className="tabular">{money(l.unitMinor)}</td><td className="tabular">{money(l.qty * l.unitMinor)}</td><td>{e.status === 'borrador' && <Button size="sm" variant="ghost" onClick={() => show(dispatch({ type: 'estimateRemoveLine', lineId: l.id }))}>Quitar</Button>}</td></tr>)}
            <tr><td colSpan={4}><strong>Total</strong></td><td className="tabular"><strong>{money(t.total)}</strong></td><td /></tr>
          </tbody>
        </table>
      </div>
      {e.status === 'borrador' && (
        <fieldset className="stack">
          <legend>Agregar línea manual</legend>
          <div className="form-grid">
            <Field label="Descripción" id="description" error={errors.description}>{(p) => <input {...p} value={line.description} maxLength={120} onChange={(ev) => setLine({ ...line, description: ev.target.value })} />}</Field>
            <Field label="Pieza FDI (opcional)" id="tooth" error={errors.tooth}>{(p) => <input {...p} inputMode="numeric" value={line.tooth} onChange={(ev) => setLine({ ...line, tooth: ev.target.value.replace(/\D/g, '').slice(0, 2) })} />}</Field>
            <Field label="Cantidad" id="qty" error={errors.qty}>{(p) => <input {...p} inputMode="numeric" value={line.qty} onChange={(ev) => setLine({ ...line, qty: ev.target.value.replace(/[^\d-]/g, '') })} />}</Field>
            <Field label="Importe unitario ficticio (ARS)" id="unitMinor" error={errors.unitMinor} hint="Ej. 12500,50. Se guarda en centavos enteros.">{(p) => <input {...p} inputMode="decimal" value={line.amount} onChange={(ev) => setLine({ ...line, amount: ev.target.value })} />}</Field>
          </div>
          <Button onClick={add}>Agregar línea</Button>
        </fieldset>
      )}
      <div className="row wrap">
        {e.status === 'borrador' && <Button variant="primary" onClick={() => tr('emitido')}>Emitir</Button>}
        {e.status === 'emitido' && <><Button variant="primary" onClick={() => tr('aceptado')}>Registrar aceptación (simulada)</Button><Button onClick={() => tr('rechazado')}>Registrar rechazo</Button><Button variant="ghost" onClick={() => tr('vencido')}>Marcar vencido</Button></>}
        {(e.status === 'emitido' || e.status === 'vencido') && <Button variant="ghost" onClick={() => show(dispatch({ type: 'estimateFollowUp', estimateId: e.id }))}>La persona pide una explicación</Button>}
      </div>
      {e.status === 'aceptado' && <Notice tone="info" title="Aceptado no es cobrado">La aceptación no registró ningún movimiento ni marcó tratamientos como realizados. Para un movimiento ficticio usá la caja.</Notice>}
    </div>
  );
}

function LedgerPanel({ show }: { show: Show }) {
  const s = useDemo();
  const [form, setForm, clearForm] = useDraft('ledger:form', { personId: '', estimateId: '', amount: '', note: '', formId: `f${s.revision}` });
  const [reverse, setReverse] = useState<string | null>(null);
  const record = () => {
    const minor = toMinor(form.amount);
    const r = dispatch({ commandId: `ledger:${form.formId}`, type: 'ledgerRecord', personId: form.personId, estimateId: form.estimateId || null, amountMinor: Number.isNaN(minor) ? -1 : minor, note: form.note });
    show(r.replayed ? { ok: true, message: `Reintento detectado: el movimiento ya existía (${r.ok ? r.ids?.entryId : ''}). No se duplicó.` } : r);
  };
  const personEstimates = s.estimates.filter((x) => x.personId === form.personId);
  return (
    <div className="card stack">
      <h2 style={{ fontSize: 20 }}>Caja ficticia</h2>
      <p className="small muted">Solo movimientos simulados. Una reversión se registra como contrapartida trazable; nunca se borra un movimiento.</p>
      <div className="form-grid">
        <Field label="Persona">{(p) => <select {...p} value={form.personId} onChange={(ev) => setForm({ ...form, personId: ev.target.value, estimateId: '' })}><option value="">Elegí</option>{s.persons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName}</option>)}</select>}</Field>
        <Field label="Presupuesto (opcional)">{(p) => <select {...p} value={form.estimateId} onChange={(ev) => setForm({ ...form, estimateId: ev.target.value })}><option value="">Ninguno</option>{personEstimates.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.status}</option>)}</select>}</Field>
        <Field label="Importe ficticio (ARS)" id="amountMinor">{(p) => <input {...p} inputMode="decimal" value={form.amount} onChange={(ev) => setForm({ ...form, amount: ev.target.value })} />}</Field>
        <Field label="Nota">{(p) => <input {...p} value={form.note} maxLength={120} onChange={(ev) => setForm({ ...form, note: ev.target.value })} />}</Field>
      </div>
      <div className="row wrap"><Button variant="primary" disabled={!form.personId} onClick={record}>Registrar movimiento simulado</Button><Button variant="ghost" onClick={clearForm}>Nuevo movimiento</Button><span className="small muted">Intención <span className="code">ledger:{form.formId}</span>: volver a tocar Registrar no duplica.</span></div>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Movimientos</caption>
          <thead><tr><th>ID</th><th>Fecha</th><th>Persona</th><th>Tipo</th><th className="num">Importe</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {[...s.ledger].reverse().map((l) => (
              <tr key={l.id}>
                <td className="code">{l.id}</td><td className="tabular small nowrap">{fmtShort(l.at)}</td><td className="small">{personName(s, l.personId)} · <span className="nowrap">{l.personId}</span>{l.estimateId ? <> · <span className="nowrap">{l.estimateId}</span></> : ''}</td>
                <td className="small">{l.kind === 'contrapartida' ? `Contrapartida de ${l.reversesId}` : 'Movimiento simulado'}{l.reversedById ? ` · revertido por ${l.reversedById}` : ''}</td>
                <td className={`tabular num${l.amountMinor < 0 ? ' neg' : ''}`}>{money(l.amountMinor)}</td>
                <td>{l.kind === 'pago_simulado' && !l.reversedById && <Button size="sm" variant="ghost" onClick={() => setReverse(l.id)}>Revertir</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog open={!!reverse} title={`¿Revertir ${reverse}?`} confirmLabel="Registrar contrapartida" onCancel={() => setReverse(null)} onConfirm={() => { const r = dispatch({ commandId: `reverse:${reverse}`, type: 'ledgerReverse', entryId: reverse! }); show(r); announce(r.message); setReverse(null); }}>
        Se agrega un movimiento negativo enlazado. El original queda visible y auditado.
      </ConfirmDialog>
    </div>
  );
}
