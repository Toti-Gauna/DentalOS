import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { navigate } from '../../app/router';
import { useDraft } from '../../app/ui-state';
import { isValidTooth, PROCEDURES, surfacesFor, type Surface } from '../../domain';
import { byId, personLabel } from '../../domain/selectors';
import { fmtShort } from '../../domain/time';
import { Button, EmptyState, Field, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { ToothGlyph } from '../../ui/components';

const PERM = { upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] };
const TEMP = { upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65], lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] };
const SURFACE_LABEL: Record<Surface, string> = { V: 'Vestibular', L: 'Lingual/palatina', M: 'Mesial', D: 'Distal', O: 'Oclusal', I: 'Incisal', pieza: 'Pieza completa' };

export function OdontogramPicker() {
  const s = useDemo();
  return (
    <section className="page">
      <PageHeader eyebrow="M09 · Profesional" title="Odontograma">Elegí la persona por ID. Registro administrativo de muestra: sin imágenes, sin IA y sin recomendaciones.</PageHeader>
      {s.persons.length === 0 ? <EmptyState title="No hay personas en este preset" /> : (
        <ul className="list">{s.persons.map((p) => <li key={p.id}><a className="list-item" href={`#/admin/personas/${p.id}/odontograma`}><strong>{p.id} · {p.firstName} {p.lastName}</strong><span className="small muted">{s.toothChart.filter((t) => t.personId === p.id && t.status === 'vigente').length} registros vigentes</span></a></li>)}</ul>
      )}
    </section>
  );
}

export function Odontogram({ personId }: { personId: string }) {
  const s = useDemo();
  const person = byId(s.persons, personId);
  const [dentition, setDentition] = useDraft<'permanente' | 'temporal'>(`odo:${personId}:dent`, person?.kind === 'menor' ? 'temporal' : 'permanente');
  const [tooth, setTooth] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [surface, setSurface] = useState<Surface>('pieza');
  const [procedure, setProcedure] = useState<string>(PROCEDURES[0]);
  const [state, setState] = useState<'planificado' | 'realizado'>('planificado');
  const [amount, setAmount] = useState('');
  const { show, view } = useResult();
  if (!person) return <section className="page narrow"><h1 tabIndex={-1} data-page-title>Persona no encontrada</h1><Button onClick={() => navigate('/admin/odontograma')}>Volver</Button></section>;

  const entries = s.toothChart.filter((t) => t.personId === person.id);
  const vigentes = entries.filter((t) => t.status === 'vigente');
  const layout = dentition === 'permanente' ? PERM : TEMP;
  const toothEntries = tooth ? vigentes.filter((t) => t.tooth === tooth) : [];
  const lastVigente = [...vigentes].sort((a, b) => b.id.localeCompare(a.id))[0];
  const draftEstimate = s.estimates.find((e) => e.personId === person.id && e.status === 'borrador');

  const pick = (n: number) => { setTooth(n); setSurface('pieza'); };
  const mark = () => {
    if (!tooth) return;
    const r = dispatch({ type: 'toothMark', personId: person.id, dentition, tooth, surface, procedure, state });
    show(r); announce(r.message);
  };
  const addToEstimate = (desc: string, n: number) => {
    const minor = Math.round(Number(amount.replace(',', '.')) * 100);
    let estId = draftEstimate?.id;
    if (!estId) { const c = dispatch({ type: 'estimateCreate', personId: person.id, professionalId: 'PR-01' }); if (!c.ok) return show(c); estId = c.ids!.estimateId; }
    const r = dispatch({ type: 'estimateAddLine', estimateId: estId, description: desc, tooth: n, qty: 1, unitMinor: Number.isFinite(minor) && amount.trim() ? minor : -1 });
    show(r.ok ? { ok: true, message: `Línea agregada al borrador ${estId}. No es cobro ni tratamiento realizado.` } : r);
  };

  const arch = (teeth: number[]) => (
    <div className="arch">
      {teeth.map((n, i) => {
        const es = vigentes.filter((t) => t.tooth === n);
        return (
          <span key={n} style={{ display: 'contents' }}>
            {i === teeth.length / 2 && <span className="mid" aria-hidden="true" />}
            <button className="tooth-btn" aria-pressed={tooth === n} onClick={() => pick(n)} aria-label={`Pieza ${n}${es.length ? `, ${es.length} registro(s): ${es.map((e) => `${e.procedure} ${e.state}`).join('; ')}` : ''}`}>
              <ToothGlyph tooth={n} entries={es} />
              <span className="tabular">{n}</span>
            </button>
          </span>
        );
      })}
    </div>
  );

  return (
    <section className="page">
      <PageHeader eyebrow={`M09 · ${personLabel(s, person.id)}`} title="Odontograma" actions={<Button icon="back" onClick={() => navigate(`/admin/personas/${person.id}`)}>Ficha</Button>}>
        Registro administrativo de muestra por la profesional. No interpreta imágenes, no diagnostica ni recomienda tratamientos.
      </PageHeader>
      <div className="row wrap">
        <div className="seg" role="group" aria-label="Dentición">
          {(['permanente', 'temporal'] as const).map((d) => <button key={d} aria-pressed={dentition === d} onClick={() => { setDentition(d); setTooth(null); }}>{d === 'permanente' ? 'Permanente' : 'Temporal'}</button>)}
        </div>
        <ul className="legend" aria-label="Leyenda del odontograma">
          <li><ToothGlyph tooth={16} entries={[]} /> Sin registro</li>
          <li><ToothGlyph tooth={16} entries={[{ surface: 'pieza', state: 'planificado' } as never]} /> Planificado</li>
          <li><ToothGlyph tooth={16} entries={[{ surface: 'pieza', state: 'realizado' } as never]} /> Realizado</li>
          <li className="muted">Centro: oclusal (posteriores) o incisal (anteriores). Bordes: vestibular, lingual/palatina, mesial y distal. Deshacer conserva el evento en la auditoría.</li>
        </ul>
      </div>
      <div className="card odonto" role="group" aria-label={`Dentición ${dentition}, numeración FDI`}>
        <p className="small muted" style={{ margin: 0 }}>Superior (derecha de la persona a la izquierda)</p>
        {arch(layout.upper)}
        {arch(layout.lower)}
        <p className="small muted" style={{ margin: 0 }}>Inferior</p>
      </div>
      <div className="row wrap" style={{ alignItems: 'end' }}>
        <Field label="O escribí la pieza (FDI)" hint={dentition === 'permanente' ? '11–48' : '51–85'}>{(p) => <input {...p} inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ maxWidth: 120 }} />}</Field>
        <Button onClick={() => { const n = Number(typed); if (!isValidTooth(dentition, n)) { show({ ok: false, message: `La pieza ${typed || '—'} no corresponde a la dentición ${dentition} (FDI). Elegí una válida.` }); return; } pick(n); }}>Seleccionar</Button>
      </div>
      {view}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          {!tooth ? <p className="muted">Elegí una pieza para registrar.</p> : (
            <>
              <h2 style={{ fontSize: 20 }}>Pieza {tooth}</h2>
              <fieldset>
                <legend>Superficie</legend>
                <div className="row wrap">{surfacesFor(tooth).map((sf) => <label key={sf} className="choice"><input type="radio" name="surface" checked={surface === sf} onChange={() => setSurface(sf)} /> {SURFACE_LABEL[sf]}</label>)}</div>
              </fieldset>
              <div className="form-grid">
                <Field label="Registro">{(p) => <select {...p} value={procedure} onChange={(e) => setProcedure(e.target.value)}>{PROCEDURES.map((x) => <option key={x}>{x}</option>)}</select>}</Field>
                <Field label="Estado">{(p) => <select {...p} value={state} onChange={(e) => setState(e.target.value as 'planificado' | 'realizado')}><option value="planificado">Planificado</option><option value="realizado">Realizado</option></select>}</Field>
              </div>
              <Button variant="primary" onClick={mark}>Guardar en la ficha</Button>
              <h3>Registros vigentes de la pieza</h3>
              {toothEntries.length === 0 ? <p className="muted">Ninguno.</p> : (
                <ul className="list">{toothEntries.map((t) => (
                  <li key={t.id} className="list-item">
                    <div className="row between"><span>{t.procedure} · {SURFACE_LABEL[t.surface]}</span><StatusBadge status={t.state} /></div>
                    <div className="row wrap">
                      {t.state === 'planificado' && <Button size="sm" onClick={() => show(dispatch({ type: 'toothDone', entryId: t.id }))}>Marcar realizado</Button>}
                      <Button size="sm" variant="ghost" icon="undo" onClick={() => show(dispatch({ type: 'toothUndo', entryId: t.id }))}>Deshacer</Button>
                    </div>
                    {t.state === 'planificado' && (
                      <div className="row wrap" style={{ alignItems: 'end' }}>
                        <Field label="Importe ficticio (ARS)" hint="Lo carga la profesional.">{(p) => <input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ maxWidth: 160 }} />}</Field>
                        <Button size="sm" variant="quiet" onClick={() => addToEstimate(`${t.procedure} pieza ${t.tooth}`, t.tooth)}>Agregar línea al presupuesto</Button>
                      </div>
                    )}
                  </li>
                ))}</ul>
              )}
            </>
          )}
        </div>
        <div className="card stack">
          <h2 style={{ fontSize: 20, margin: 0 }}>Resumen por pieza</h2>
          {vigentes.length === 0 ? <p className="muted" style={{ margin: 0 }}>Sin registros vigentes en la ficha.</p> : (
            <ul className="list" aria-label="Registros vigentes por pieza">
              {[...new Set(vigentes.map((t) => t.tooth))].sort((x, y) => x - y).map((n) => (
                <li key={n} className="list-item">
                  <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => { if (isValidTooth(dentition, n)) pick(n); else { setDentition(dentition === 'permanente' ? 'temporal' : 'permanente'); pick(n); } }}>Pieza {n}</button>
                  <span className="small">{vigentes.filter((t) => t.tooth === n).map((t) => `${t.procedure} · ${SURFACE_LABEL[t.surface]} · ${t.state}`).join(' / ')}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row between"><h2 style={{ fontSize: 20, margin: 0 }}>Historial</h2>{lastVigente && <Button size="sm" variant="ghost" icon="undo" onClick={() => show(dispatch({ type: 'toothUndo', entryId: lastVigente.id }))}>Deshacer último</Button>}</div>
          {entries.length === 0 ? <p className="muted">Sin registros.</p> : (
            <div className="table-wrap"><table><caption className="sr-only">Registros</caption><thead><tr><th>Pieza</th><th>Registro</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
              {[...entries].reverse().map((t) => <tr key={t.id} style={t.status === 'deshecho' ? { opacity: 0.6, textDecoration: 'line-through' } : undefined}><td className="tabular">{t.tooth} {t.surface}</td><td>{t.procedure}</td><td>{t.status === 'deshecho' ? 'Deshecho' : <StatusBadge status={t.state} />}</td><td className="tabular small">{fmtShort(t.createdAt)}</td></tr>)}
            </tbody></table></div>
          )}
          <Notice tone="info" title="Alcance">Sin radiografías ni imágenes reales. Las líneas de presupuesto se agregan solo por acción explícita de la profesional.</Notice>
        </div>
      </div>
    </section>
  );
}
