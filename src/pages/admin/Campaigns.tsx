// M16 · Campañas y seguimiento (lote 6). Segmentos administrativos, audiencia con baja/exclusión/frecuencia,
// economía con ND, aprobación y activación simuladas, calendario y resultados separados. Nada se envía ni se cobra.
import { useMemo, useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import type { Campaign, CampaignInput, ContactChannel, DemoState, SegmentId } from '../../domain';
import {
  CADENCE_LABEL, CHANNEL_LABEL, EXCLUSION_LABEL, SEGMENTS, TEMPLATES, campaignResults, emptyEconomics, occurrences,
  recentDeliveries, reviewCampaign, segmentMembers, type CampaignReview,
} from '../../domain/campaigns';
import { money, personLabel } from '../../domain/selectors';
import { addDays, at, fmtDateOnly, fmtShort, parts, startOfWeek } from '../../domain/time';
import { Button, ConfirmDialog, EmptyState, Field, Icon, Kpi, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';
import { SpotArt } from '../../ui/art/editorial';
import { DirectorAssistant } from './DirectorAssistant';

type Show = ReturnType<typeof useResult>['show'];

const toMinor = (v: string): number | null => { const t = v.trim().replace(/\./g, '').replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
const fromMinor = (m: number | null) => (m == null ? '' : (m / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }).replace(/\./g, ''));
const nd = (m: number | null | undefined) => (m == null ? 'ND' : money(m));
const pct = (x: number | null) => (x == null ? 'ND' : `${(x * 100).toFixed(1).replace('.', ',')} %`);
const KIND_LABEL: Record<Campaign['kind'], string> = { individual: 'Individual', segmentada: 'Segmentada', masiva: 'Masiva' };
const TRIGGER_LABEL: Record<Campaign['trigger'], string> = { manual: 'Manual (al activar)', programada: 'Programada', evento: 'Por evento (al entrar al segmento)' };
const statusLabel = (st: Campaign['status']) => (st === 'finalizada' ? 'Finalizada' : undefined);
/** Para que el asistente lleve a cada dato que falta. */
export const MISSING_FIELD: Record<string, string> = {
  'Costo fijo de la campaña': 'cmp-fixed', 'Precio de lista por atención': 'cmp-price', 'Costo de servicio cargado por atención': 'cmp-service-cost',
  'Otros costos variables por atención': 'cmp-other', 'Respuesta supuesta (%)': 'cmp-rate', 'Fecha programada': 'cmp-date', 'Persona de la campaña individual': 'cmp-person', 'Al menos un segmento': 'cmp-seg-0',
};

export function Campaigns() {
  const s = useDemo();
  const [sel, setSel] = useDraft<string>('cmp:sel', s.campaigns.find((c) => c.status !== 'finalizada')?.id ?? s.campaigns[0]?.id ?? '');
  const { show, view } = useResult();
  const c = s.campaigns.find((x) => x.id === sel) ?? null;
  const active = s.campaigns.filter((x) => x.status === 'activa').length;
  const from = addDays(parts(s.clock).date, -30);
  const sent30 = s.campaignDeliveries.filter((x) => x.status === 'entregado_simulado' && parts(x.dueAt).date >= from).length;
  const opted = s.persons.filter((p) => p.campaignOptOut || p.campaignExclusion).length;

  const createFor = (seg: SegmentId | null) => {
    const info = seg ? SEGMENTS.find((x) => x.id === seg)! : null;
    const input: CampaignInput = {
      name: info ? info.label : 'Aviso informativo', kind: info ? 'segmentada' : 'masiva', trigger: 'manual', cadence: 'unica', segmentIds: info ? [info.id] : [], personId: null,
      templateId: info ? info.templateId : 'horarios', extraNote: '', serviceTypeId: info?.serviceTypeId ?? null, scheduledFor: null, economics: emptyEconomics(),
    };
    const r = dispatch({ type: 'campaignCreate', input });
    show(r);
    if (r.ok) setSel(r.ids!.campaignId);
  };

  return (
    <section className="page campaigns">
      <PageHeader eyebrow="M16 · Dirección" title="Campañas y seguimiento" art={<SpotArt kind="campana" size={150} />}>
        Mensajes administrativos simulados a partir de los datos de la demo. Nada se envía, publica ni cobra. El software no decide controles ni ordena pacientes por rentabilidad.
      </PageHeader>
      <div className="kpis">
        <Kpi label="Campañas activas" value={String(active)} detail={`${s.campaigns.length} en total`} />
        <Kpi label="Mensajes simulados" value={String(sent30)} detail="registrados en los últimos 30 días" />
        <Kpi label="Baja o exclusión" value={String(opted)} detail="personas que no reciben campañas" />
      </div>
      {view}

      <section aria-labelledby="seg-title" className="stack">
        <h2 id="seg-title">Segmentos administrativos</h2>
        <ul className="seg-grid">
          {SEGMENTS.map((g) => {
            const m = segmentMembers(s, g.id);
            return (
              <li key={g.id} className="seg-card">
                <span className="seg-count tabular">{m.length}</span>
                <strong>{g.label}</strong>
                <span className="small muted">{g.description}</span>
                <Button size="sm" icon="plus" onClick={() => createFor(g.id)}>Crear borrador</Button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="ops">
        <div className="stack">
          {c ? <CampaignDetail key={`${c.id}:${c.version}`} c={c} show={show} /> : <EmptyState title="Elegí o creá una campaña" icon="send" />}
        </div>
        <aside className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: 20 }}>Campañas</h2>
            {s.campaigns.length === 0 ? <p className="muted">Ninguna todavía.</p> : (
              <ul className="list">
                {[...s.campaigns].reverse().map((x) => (
                  <li key={x.id}>
                    <button className="list-item cmp-item" aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>
                      <span className="row between"><strong>{x.id}</strong><StatusBadge status={x.status} label={statusLabel(x.status)} /></span>
                      <span className="small">{x.name}</span>
                      <span className="small muted">{KIND_LABEL[x.kind]} · {TRIGGER_LABEL[x.trigger].split(' (')[0]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button icon="plus" onClick={() => createFor(null)}>Nuevo aviso informativo</Button>
          </div>
        </aside>
      </div>

      <DirectorAssistant campaignId={c?.id ?? null} onCreated={(id) => setSel(id)} />
      <CampaignCalendar />
      <ContactPrefs show={show} />
    </section>
  );
}

// ---------- Detalle ----------
const STEPS: { id: string; label: string; on: Campaign['status'][] }[] = [
  { id: 'borrador', label: 'Borrador', on: ['borrador', 'lista', 'aprobada', 'activa', 'pausada', 'finalizada'] },
  { id: 'lista', label: 'Vista previa', on: ['lista', 'aprobada', 'activa', 'pausada', 'finalizada'] },
  { id: 'aprobada', label: 'Aprobación', on: ['aprobada', 'activa', 'pausada', 'finalizada'] },
  { id: 'activa', label: 'Activación simulada', on: ['activa', 'pausada', 'finalizada'] },
];

function CampaignDetail({ c, show }: { c: Campaign; show: Show }) {
  const s = useDemo();
  const review = useMemo(() => reviewCampaign(s, c), [s, c]);
  const [confirm, setConfirm] = useState(false);
  const editable = c.status === 'borrador' || c.status === 'lista' || c.status === 'aprobada';
  const act = (type: 'campaignPreview' | 'campaignApprove' | 'campaignActivate' | 'campaignPause' | 'campaignResume' | 'campaignClose') => show(dispatch({ type, campaignId: c.id }));
  const calls = review.audience.eligible.filter((e) => e.channel === 'llamada').length;
  return (
    <article className="card stack cmp-detail" aria-labelledby="cmp-title">
      <header className="row between wrap">
        <div>
          <h2 id="cmp-title" style={{ fontSize: 22, margin: 0 }}>{c.id} · {c.name}</h2>
          <p className="small muted" style={{ margin: 0 }}>{KIND_LABEL[c.kind]} · {TRIGGER_LABEL[c.trigger]} · {CADENCE_LABEL[c.cadence]} · versión {c.version}</p>
        </div>
        <StatusBadge status={c.status} label={statusLabel(c.status)} />
      </header>
      <ol className="cmp-steps" aria-label="Pasos de la campaña">
        {STEPS.map((st) => <li key={st.id} className={st.on.includes(c.status) ? 'is-done' : ''} aria-current={c.status === st.id || (st.id === 'activa' && c.status === 'pausada') ? 'step' : undefined}>{st.id === 'activa' && c.status === 'pausada' ? 'En pausa' : st.label}</li>)}
      </ol>

      {editable ? <CampaignEditor c={c} show={show} /> : <p className="small muted">Una campaña {c.status === 'finalizada' ? 'finalizada' : 'activa o en pausa'} no se edita: lo enviado (simulado) queda como historial.</p>}

      <Audience review={review} />
      <Economics c={c} review={review} />

      {review.blockers.length > 0 && c.status !== 'finalizada' && c.status !== 'activa' && c.status !== 'pausada' && (
        <Notice tone="warn" title="Antes de avanzar">
          <ul className="plain">{review.blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
        </Notice>
      )}

      <div className="row wrap">
        {c.status === 'borrador' && <Button variant="primary" icon="search" onClick={() => act('campaignPreview')}>Revisar vista previa</Button>}
        {c.status === 'lista' && <Button variant="primary" icon="check" onClick={() => act('campaignApprove')}>Aprobar (dirección)</Button>}
        {c.status === 'aprobada' && <Button variant="primary" icon="send" onClick={() => setConfirm(true)}>Activar (simulado)</Button>}
        {c.status === 'activa' && <Button icon="pause" onClick={() => act('campaignPause')}>Pausar</Button>}
        {c.status === 'pausada' && <Button variant="primary" icon="play" onClick={() => act('campaignResume')}>Reanudar</Button>}
        {(c.status === 'activa' || c.status === 'pausada') && <Button variant="ghost" icon="stop" onClick={() => act('campaignClose')}>Finalizar</Button>}
      </div>

      <Results c={c} review={review} />

      <ConfirmDialog open={confirm} title={`¿Activar ${c.id} (simulado)?`} confirmLabel="Activar (simulado)" onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); act('campaignActivate'); }}>
        Se registran {review.audience.eligible.length} mensaje(s) simulado(s){calls ? `, ${calls} como tarea de llamada para recepción` : ''}.
        {c.trigger === 'programada' && c.scheduledFor ? ` Quedan programados para ${fmtShort(c.scheduledFor)}.` : ''} <strong>No se envía nada real</strong>, no se publica ni se cobra.
      </ConfirmDialog>
    </article>
  );
}

function CampaignEditor({ c, show }: { c: Campaign; show: Show }) {
  const s = useDemo();
  const [f, setF] = useState(() => ({
    name: c.name, kind: c.kind, trigger: c.trigger, cadence: c.cadence, segmentIds: c.segmentIds, personId: c.personId ?? '', templateId: c.templateId,
    extraNote: c.extraNote, serviceTypeId: c.serviceTypeId ?? '', date: c.scheduledFor ? parts(c.scheduledFor).date : '', time: c.scheduledFor ? parts(c.scheduledFor).hhmm : '10:00',
    price: fromMinor(c.economics.listPriceMinor), discount: c.economics.discountMinor ? fromMinor(c.economics.discountMinor) : '', service: fromMinor(c.economics.serviceCostMinor),
    other: fromMinor(c.economics.otherVariableMinor), fixed: fromMinor(c.economics.fixedCostMinor), rate: c.economics.responseRatePct == null ? '' : String(c.economics.responseRatePct),
  }));
  const [err, setErr] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const perAttention = !!f.serviceTypeId;
  const save = () => {
    const e: Record<string, string> = {};
    const nums = { price: toMinor(f.price), discount: toMinor(f.discount) ?? 0, service: toMinor(f.service), other: toMinor(f.other), fixed: toMinor(f.fixed) };
    for (const [k, v] of Object.entries(nums)) if (Number.isNaN(v)) e[k] = 'Importe en pesos, por ejemplo 12500,50. Vacío = ND.';
    const rate = f.rate.trim() === '' ? null : Number(f.rate);
    if (rate != null && (!Number.isInteger(rate) || rate < 0 || rate > 100)) e.rate = 'Entero de 0 a 100. Vacío = ND.';
    if (f.trigger === 'programada' && f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = 'Fecha inválida.';
    setErr(e);
    if (Object.keys(e).length) { announce('Revisá los campos marcados.'); return; }
    const patch: Partial<CampaignInput> = {
      name: f.name, kind: f.kind, trigger: f.trigger, cadence: f.cadence, segmentIds: f.kind === 'segmentada' ? f.segmentIds : [], personId: f.kind === 'individual' ? f.personId || null : null,
      templateId: f.templateId, extraNote: f.extraNote, serviceTypeId: f.serviceTypeId || null, scheduledFor: f.trigger === 'programada' && f.date ? at(f.date, f.time || '10:00') : null,
      economics: { listPriceMinor: perAttention ? nums.price : null, discountMinor: perAttention ? nums.discount : 0, serviceCostMinor: perAttention ? nums.service : null, otherVariableMinor: perAttention ? nums.other : null, fixedCostMinor: nums.fixed, responseRatePct: perAttention ? rate : null },
    };
    show(dispatch({ type: 'campaignUpdate', campaignId: c.id, patch }));
  };
  return (
    <form className="stack cmp-editor" onSubmit={(e) => { e.preventDefault(); save(); }} aria-label="Editar campaña">
      <div className="form-grid">
        <Field label="Nombre" id="cmp-name">{(p) => <input {...p} value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Alcance" id="cmp-kind">{(p) => <select {...p} value={f.kind} onChange={(e) => set('kind', e.target.value as Campaign['kind'])}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
        <Field label="Disparo" id="cmp-trigger">{(p) => <select {...p} value={f.trigger} onChange={(e) => set('trigger', e.target.value as Campaign['trigger'])}>{Object.entries(TRIGGER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
        <Field label="Repetición (calendario)" id="cmp-cadence">{(p) => <select {...p} value={f.cadence} onChange={(e) => set('cadence', e.target.value as Campaign['cadence'])}>{Object.entries(CADENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
      </div>
      {f.kind === 'segmentada' && (
        <fieldset className="cmp-segs">
          <legend className="label">Segmentos</legend>
          {SEGMENTS.map((g, i) => (
            <label key={g.id} className="check"><input id={`cmp-seg-${i}`} type="checkbox" checked={f.segmentIds.includes(g.id)} onChange={(e) => set('segmentIds', e.target.checked ? [...f.segmentIds, g.id] : f.segmentIds.filter((x) => x !== g.id))} /> {g.label}</label>
          ))}
        </fieldset>
      )}
      <div className="form-grid">
        {f.kind === 'individual' && <Field label="Persona" id="cmp-person">{(p) => <select {...p} value={f.personId} onChange={(e) => set('personId', e.target.value)}><option value="">Elegí persona por ID</option>{s.persons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName}</option>)}</select>}</Field>}
        <Field label="Mensaje (plantilla discreta)" id="cmp-template">{(p) => <select {...p} value={f.templateId} onChange={(e) => set('templateId', e.target.value)}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>}</Field>
        <Field label="Invita a un turno de" id="cmp-service" hint="Si no elegís motivo, es informativa: solo tiene costo.">{(p) => <select {...p} value={f.serviceTypeId} onChange={(e) => set('serviceTypeId', e.target.value)}><option value="">Ninguno (informativa)</option>{s.serviceTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        {f.trigger === 'programada' && <>
          <Field label="Fecha programada" id="cmp-date" error={err.date}>{(p) => <input {...p} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />}</Field>
          <Field label="Hora" id="cmp-time">{(p) => <input {...p} type="time" value={f.time} step={900} onChange={(e) => set('time', e.target.value)} />}</Field>
        </>}
      </div>
      <Field label="Nota agregada (opcional)" id="cmp-note" hint="Se revisa: sin urgencias, miedo, ofertas ni datos clínicos.">{(p) => <input {...p} value={f.extraNote} maxLength={200} onChange={(e) => set('extraNote', e.target.value)} />}</Field>
      <fieldset className="stack">
        <legend className="label">Economía (importes ficticios en pesos; vacío = ND)</legend>
        <div className="form-grid">
          {perAttention && <>
            <Field label="Precio de lista por atención" id="cmp-price" error={err.price}>{(p) => <input {...p} inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} />}</Field>
            <Field label="Descuento por atención" id="cmp-discount" error={err.discount} hint="Opcional. Se resta del precio.">{(p) => <input {...p} inputMode="decimal" value={f.discount} onChange={(e) => set('discount', e.target.value)} />}</Field>
            <Field label="Costo de servicio cargado" id="cmp-service-cost" error={err.service}>{(p) => <input {...p} inputMode="decimal" value={f.service} onChange={(e) => set('service', e.target.value)} />}</Field>
            <Field label="Otros costos variables" id="cmp-other" error={err.other}>{(p) => <input {...p} inputMode="decimal" value={f.other} onChange={(e) => set('other', e.target.value)} />}</Field>
            <Field label="Respuesta supuesta (%)" id="cmp-rate" error={err.rate} hint="Supuesto para proyectar, no una medición.">{(p) => <input {...p} inputMode="numeric" value={f.rate} onChange={(e) => set('rate', e.target.value.replace(/\D/g, '').slice(0, 3))} />}</Field>
          </>}
          <Field label="Costo fijo de la campaña" id="cmp-fixed" error={err.fixed} hint="Diseño, horas de recepción, etc. No incluye la comunicación.">{(p) => <input {...p} inputMode="decimal" value={f.fixed} onChange={(e) => set('fixed', e.target.value)} />}</Field>
        </div>
      </fieldset>
      <div className="row"><Button type="submit" icon="check">Guardar borrador</Button>{c.status !== 'borrador' && <span className="small muted">Guardar cambios la vuelve a borrador.</span>}</div>
    </form>
  );
}

function Audience({ review }: { review: CampaignReview }) {
  const s = useDemo();
  const { audience: a, sample } = review;
  return (
    <section className="stack" aria-labelledby="aud-title">
      <h3 id="aud-title">Audiencia y mensaje</h3>
      <p className="small muted" style={{ margin: 0 }}>
        <span className="tabular">{a.members}</span> en los segmentos · <strong className="tabular">{a.eligible.length}</strong> contacto(s) elegible(s) · <span className="tabular">{a.excluded.length}</span> excluido(s) · <span className="tabular">{a.merged}</span> unificado(s) por duplicado. Orden por ID: sin ranking.
      </p>
      {a.eligible.length > 0 && (
        <table className="cmp-table">
          <caption className="sr-only">Contactos elegibles</caption>
          <thead><tr><th scope="col">Contacto</th><th scope="col">Por</th><th scope="col">Canal</th></tr></thead>
          <tbody>{a.eligible.map((e) => (
            <tr key={e.contactId}><td>{personLabel(s, e.contactId)}</td><td className="small">{e.forPersonIds.map((id) => (id === e.contactId ? 'sí mismo/a' : personLabel(s, id))).join(', ')}</td><td>{CHANNEL_LABEL[e.channel]}</td></tr>
          ))}</tbody>
        </table>
      )}
      {a.excluded.length > 0 && (
        <details className="cmp-excluded">
          <summary>Ver excluidos ({a.excluded.length})</summary>
          <ul className="plain small">{a.excluded.map((x, i) => <li key={i}>{x.contactId ? personLabel(s, x.contactId) : 'Sin identificar'}: <strong>{EXCLUSION_LABEL[x.reason]}</strong> · {x.detail}</li>)}</ul>
        </details>
      )}
      {sample && <figure className="cmp-sample"><figcaption className="small muted">Vista previa del mensaje (primer contacto)</figcaption><p>{sample}</p></figure>}
    </section>
  );
}

function Economics({ c, review }: { c: Campaign; review: CampaignReview }) {
  const e = review.economics;
  const cap = review.capacity;
  return (
    <section className="stack" aria-labelledby="eco-title">
      <h3 id="eco-title">Economía antes de activar</h3>
      <dl className="cmp-eco">
        {e.perAttention && <>
          <div><dt>Ingreso neto por atención</dt><dd className="tabular">{nd(e.unit?.netRevenue)}</dd><dd className="small muted">precio − descuento</dd></div>
          <div><dt>Contribución por atención</dt><dd className="tabular">{nd(e.unit?.contribution)}</dd><dd className="small muted">neto − servicio − otros variables</dd></div>
          <div><dt>Contribución / ingreso neto</dt><dd className="tabular">{pct(e.unit?.contributionPct ?? null)}</dd><dd className="small muted">no es ganancia neta</dd></div>
        </>}
        <div><dt>Comunicación</dt><dd className="tabular">{nd(e.commCostMinor)}</dd><dd className="small muted">{e.commByChannel.map((x) => `${x.count} × ${x.unitMinor == null ? 'ND' : money(x.unitMinor)} (${CHANNEL_LABEL[x.channel]})`).join(' · ') || 'sin contactos'}</dd></div>
        <div><dt>Costo de la campaña</dt><dd className="tabular">{nd(e.campaignCostMinor)}</dd><dd className="small muted">fijo + comunicación, una sola vez</dd></div>
        {e.perAttention && <div><dt>Equilibrio</dt><dd className="tabular">{e.noBreakeven ? 'Sin equilibrio' : e.breakevenAttentions == null ? 'ND' : `${e.breakevenAttentions} atención(es)`}</dd><dd className="small muted">{e.noBreakeven ? 'contribución ≤ 0: no se cubre por volumen' : 'costo ÷ contribución, hacia arriba'}</dd></div>}
        {cap && <div><dt>Capacidad de agenda</dt><dd className="tabular">{cap.slots} turno(s)</dd><dd className="small muted">libres en {cap.days} días · se proyectan {e.projectedAttentions ?? 'ND'}</dd></div>}
      </dl>
      {!e.perAttention && <p className="small muted" style={{ margin: 0 }}>{c.serviceTypeId ? '' : 'Campaña informativa: no hay ingreso por atención que proyectar.'}</p>}
    </section>
  );
}

function Results({ c, review }: { c: Campaign; review: CampaignReview }) {
  const s = useDemo();
  const r = campaignResults(s, c);
  const e = review.economics;
  return (
    <section className="stack" aria-labelledby="res-title">
      <h3 id="res-title">Resultados (no se suman entre sí)</h3>
      <div className="cmp-results">
        <div className="cmp-res" data-kind="proyectado">
          <p className="eyebrow">Proyectado · supuesto</p>
          <ul className="plain small">
            <li>Atenciones proyectadas: <strong className="tabular">{e.projectedAttentions ?? 'ND'}</strong></li>
            <li>Resultado proyectado: <strong className="tabular">{nd(e.projectedResultMinor)}</strong></li>
          </ul>
          <p className="small muted">Con la respuesta supuesta. No es una promesa ni una medición.</p>
        </div>
        <div className="cmp-res" data-kind="simulado">
          <p className="eyebrow">Simulado · demo</p>
          <ul className="plain small">
            <li>Mensajes registrados: <strong className="tabular">{r.simulated.delivered}</strong></li>
            <li>Programados: <span className="tabular">{r.simulated.scheduled}</span> · en pausa: <span className="tabular">{r.simulated.paused}</span> · no enviados: <span className="tabular">{r.simulated.blocked}</span></li>
            <li>Costo de comunicación: <span className="tabular">{nd(r.simulated.commCostMinor)}</span></li>
          </ul>
          <p className="small muted">Ningún mensaje salió de este dispositivo.</p>
        </div>
        <div className="cmp-res" data-kind="observado">
          <p className="eyebrow">Observado · agenda y caja ficticia</p>
          <ul className="plain small">
            <li>Turnos reservados después del mensaje: <strong className="tabular">{r.observed.booked}</strong></li>
            <li>Atenciones realizadas: <strong className="tabular">{r.observed.attended}</strong></li>
            <li>Cobros simulados registrados: <strong className="tabular">{money(r.observed.paidMinor)}</strong></li>
          </ul>
          <p className="small muted">Reservar no es atender ni cobrar. Que pase después del mensaje no prueba que la campaña lo causó.</p>
        </div>
      </div>
    </section>
  );
}

// ---------- Calendario ----------
type CalView = 'semana' | 'mes' | 'bimestre' | 'temporada';
const VIEW_LABEL: Record<CalView, string> = { semana: 'Semana', mes: 'Mes', bimestre: 'Bimestre', temporada: 'Temporada' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthStart(date: string, plus: number) {
  const [y, m] = date.split('-').map(Number);
  const t = y * 12 + (m - 1) + plus;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}
function rangeFor(view: CalView, today: string): { from: string; to: string; months: string[] } {
  if (view === 'semana') { const from = startOfWeek(today); return { from, to: addDays(from, 6), months: [] }; }
  const n = view === 'mes' ? 1 : view === 'bimestre' ? 2 : 3;
  const months = Array.from({ length: n }, (_, i) => monthStart(today, i));
  return { from: months[0], to: addDays(monthStart(today, n), -1), months };
}
function eventsByDay(s: DemoState, from: string, to: string) {
  const map = new Map<string, Campaign[]>();
  for (const c of s.campaigns) for (const d of occurrences(c, from, to)) map.set(d, [...(map.get(d) ?? []), c]);
  return map;
}

function CampaignCalendar() {
  const s = useDemo();
  const [view, setView] = useDraft<CalView>('cmp:cal', 'mes');
  const today = parts(s.clock).date;
  const { from, to, months } = rangeFor(view, today);
  const ev = eventsByDay(s, from, to);
  const total = [...ev.values()].reduce((n, x) => n + x.length, 0);
  const chip = (c: Campaign) => <li key={c.id} className={`cal-chip is-${c.status}`}><span className="tabular">{c.id}</span> {c.name}</li>;
  const day = (d: string, inMonth = true) => {
    const list = ev.get(d) ?? [];
    return (
      <div key={d} className={`cal-day${d === today ? ' is-today' : ''}${inMonth ? '' : ' is-out'}`} aria-label={`${fmtDateOnly(d)}${list.length ? `: ${list.map((c) => c.id).join(', ')}` : ''}`}>
        <span className="cal-num tabular" aria-hidden="true">{Number(d.slice(8))}</span>
        {list.length > 0 && <ul className="cal-chips" aria-hidden="true">{list.map(chip)}</ul>}
      </div>
    );
  };
  return (
    <section className="card stack" aria-labelledby="cal-title">
      <div className="row between wrap">
        <h2 id="cal-title" style={{ fontSize: 20, margin: 0 }}>Calendario de campañas</h2>
        <div className="segmented" role="group" aria-label="Vista del calendario">
          {(Object.keys(VIEW_LABEL) as CalView[]).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>)}
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{view === 'temporada' ? 'Temporada de 3 meses: ' : ''}{fmtDateOnly(from)} a {fmtDateOnly(to)} · <span className="tabular">{total}</span> fecha(s) prevista(s). Las repeticiones son simuladas: cada una se revisa antes de “enviarse”.</p>
      {view === 'semana' ? (
        <div className="cal-week">{Array.from({ length: 7 }, (_, i) => day(addDays(from, i)))}</div>
      ) : (
        <div className="cal-months">
          {months.map((m) => {
            const first = startOfWeek(m);
            const next = monthStart(m, 1);
            const cells: string[] = [];
            for (let d = first; d < next || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d);
            return (
              <div key={m} className="cal-month">
                <p className="cal-title">{MONTHS[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</p>
                <div className="cal-head" aria-hidden="true">{['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map((x) => <span key={x}>{x}</span>)}</div>
                <div className="cal-grid">{cells.map((d) => day(d, d.slice(0, 7) === m.slice(0, 7)))}</div>
              </div>
            );
          })}
        </div>
      )}
      {total > 0 && (
        <ul className="cal-list" aria-label="Fechas previstas">
          {[...ev.entries()].sort().flatMap(([d, list]) => list.map((c) => <li key={`${d}-${c.id}`}><span className="tabular">{fmtDateOnly(d)}</span> · <strong className="tabular">{c.id}</strong> {c.name} <StatusBadge status={c.status} label={statusLabel(c.status)} /></li>))}
        </ul>
      )}
    </section>
  );
}

// ---------- Preferencias de contacto y costos ----------
function ContactPrefs({ show }: { show: Show }) {
  const s = useDemo();
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [costs, setCosts] = useState(() => Object.fromEntries(Object.entries(s.campaignConfig.commCostMinor).map(([k, v]) => [k, fromMinor(v)])) as Record<ContactChannel, string>);
  const [max, setMax] = useState(String(s.campaignConfig.maxPer30d));
  const adults = s.persons.filter((p) => p.kind === 'adulto');
  const saveConfig = () => {
    const comm: Partial<Record<ContactChannel, number | null>> = {};
    for (const [k, v] of Object.entries(costs)) { const m = toMinor(v); if (Number.isNaN(m)) { show({ ok: false, message: `Costo inválido para ${CHANNEL_LABEL[k as ContactChannel]}.` }); return; } comm[k as ContactChannel] = m; }
    show(dispatch({ type: 'campaignConfigSet', commCostMinor: comm, maxPer30d: Number(max) }));
  };
  return (
    <section className="card stack" aria-labelledby="pref-title">
      <h2 id="pref-title" style={{ fontSize: 20, margin: 0 }}>Preferencias de contacto</h2>
      <p className="small muted" style={{ margin: 0 }}>La baja la pide la persona; la exclusión la decide la clínica con un motivo administrativo. Ambas se respetan también en lo ya programado. Los menores se contactan por su adulto responsable.</p>
      <div className="table-wrap">
        <table className="cmp-table">
          <caption className="sr-only">Preferencias de contacto por persona adulta</caption>
          <thead><tr><th scope="col">Persona</th><th scope="col">Canal preferido</th><th scope="col">Mensajes en 30 días</th><th scope="col">Baja</th><th scope="col">Exclusión</th></tr></thead>
          <tbody>{adults.map((p) => (
            <tr key={p.id}>
              <td>{personLabel(s, p.id)}</td>
              <td>{CHANNEL_LABEL[p.preferredChannel ?? 'portal']}</td>
              <td className="tabular">{recentDeliveries(s, p.id)} de {s.campaignConfig.maxPer30d}</td>
              <td><label className="check"><input type="checkbox" checked={!!p.campaignOptOut} onChange={(e) => show(dispatch({ type: 'contactPrefSet', personId: p.id, optOut: e.target.checked }))} /> <span className="sr-only">Baja de campañas de {p.firstName} {p.lastName}</span>{p.campaignOptOut ? 'Sí' : 'No'}</label></td>
              <td>{p.campaignExclusion ? <span className="row wrap"><span className="small">{p.campaignExclusion}</span><Button size="sm" variant="ghost" onClick={() => show(dispatch({ type: 'contactPrefSet', personId: p.id, exclusion: null }))}>Quitar</Button></span> : <span className="muted small">—</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <form className="row wrap" style={{ alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); const r = dispatch({ type: 'contactPrefSet', personId: who, exclusion: reason }); show(r); if (r.ok) { setReason(''); setWho(''); } }}>
        <Field label="Excluir de campañas a" id="pref-who">{(p) => <select {...p} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Elegí persona</option>{adults.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName}</option>)}</select>}</Field>
        <Field label="Motivo administrativo" id="pref-reason">{(p) => <input {...p} value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} />}</Field>
        <Button type="submit" disabled={!who || reason.trim().length < 3}>Excluir</Button>
      </form>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); saveConfig(); }} aria-labelledby="cost-title">
        <h3 id="cost-title" style={{ margin: 0 }}>Costos de comunicación y límite (ficticios)</h3>
        <div className="form-grid">
          {(Object.keys(costs) as ContactChannel[]).map((ch) => <Field key={ch} label={`Por contacto · ${CHANNEL_LABEL[ch]}`} id={`cost-${ch}`} hint="Vacío = ND">{(p) => <input {...p} inputMode="decimal" value={costs[ch]} onChange={(e) => setCosts({ ...costs, [ch]: e.target.value })} />}</Field>)}
          <Field label="Máximo de mensajes por persona en 30 días" id="cost-max">{(p) => <input {...p} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, '').slice(0, 2))} />}</Field>
        </div>
        <div className="row"><Button type="submit" icon="check">Guardar costos y límite</Button></div>
      </form>
      <Notice tone="info" title="Sin datos sensibles">Las plantillas no nombran tratamientos, diagnósticos ni importes, y no usan urgencias ni ofertas. <Icon name="info" size={14} /> Revisión de textos pendiente de la clínica real.</Notice>
    </section>
  );
}

