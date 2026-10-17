import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { findSlots } from '../../domain';
import { byId, personLabel, proName, STATUS_LABEL } from '../../domain/selectors';
import { fmtShort } from '../../domain/time';
import { Button, EmptyState, Field, Icon, Notice, PageHeader, StatusBadge, useResult } from '../../ui/kit';
import { RescheduleDrawer } from '../../ui/RescheduleDrawer';
import { APPLIANCES, OrthoArt } from '../../ui/art/ortho';

export function Ortho() {
  const s = useDemo();
  const [sel, setSel] = useDraft<string>('ortho:sel', s.careEpisodes[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [indication, setIndication] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const { show, view } = useResult();
  const ep = byId(s.careEpisodes, sel) ?? s.careEpisodes[0];
  return (
    <section className="page">
      <PageHeader eyebrow="M10 · Profesional / recepción" title="Continuidad de ortodoncia">
        Seguimiento administrativo: controles indicados manualmente por la profesional, próximas citas y tareas. No calcula avance biológico, frecuencia ni fecha final.
      </PageHeader>
      {!ep ? <EmptyState title="No hay episodios en este preset" /> : (
        <div className="ops">
          <div className="stack">
            <div className="pill-tabs" role="tablist" aria-label="Episodios">
              {s.careEpisodes.map((e) => <button key={e.id} role="tab" aria-selected={e.id === ep.id} className={`btn btn-sm ${e.id === ep.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSel(e.id)}>{e.id} · {personLabel(s, e.personId)}</button>)}
            </div>
            {view}
            <div className="card stack">
              <div className="row between"><h2 style={{ fontSize: 20, margin: 0 }}>{ep.title}</h2><StatusBadge status={ep.status === 'activo' ? 'activa' : 'cerrada'} label={ep.status === 'activo' ? 'Activo' : 'Cerrado'} /></div>
              <p className="muted">{personLabel(s, ep.personId)} · {proName(s, ep.professionalId)} · desde {fmtShort(ep.startedAt)}</p>
              <div className="appliance">
                <div className="appliance-art"><OrthoArt kind={ep.appliance ?? 'brackets_metalicos'} width={260} title={`Ilustración: ${APPLIANCES.find((x) => x.id === (ep.appliance ?? 'brackets_metalicos'))?.label}`} /></div>
                <div className="stack" style={{ gap: 6 }}>
                  <p className="eyebrow" style={{ margin: 0 }}>Aparatología registrada</p>
                  <strong>{ep.appliance ? APPLIANCES.find((x) => x.id === ep.appliance)?.label : 'Sin registrar'}</strong>
                  <span className="small muted">{ep.appliance ? APPLIANCES.find((x) => x.id === ep.appliance)?.detail : 'La profesional la registra; la ilustración muestra brackets metálicos como referencia.'}</span>
                  <Field label="Cambiar registro (profesional)">{(p) => (
                    <select {...p} value={ep.appliance ?? ''} onChange={(e) => show(dispatch({ type: 'episodeSetAppliance', episodeId: ep.id, appliance: e.target.value }))}>
                      {!ep.appliance && <option value="" disabled>Elegí una opción</option>}
                      {APPLIANCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  )}</Field>
                </div>
              </div>
              <h3>Controles indicados</h3>
              <p className="small muted" style={{ margin: 0 }}>Cada control lo indica la profesional. La demo no calcula frecuencia, avance ni fecha de finalización.</p>
              <ol className="ctl-steps">
                {ep.controls.map((c) => {
                  const a = byId(s.appointments, c.appointmentId);
                  const slots = c.status === 'indicado' ? findSlots(s, { serviceTypeId: 'ST-ORTO-CTRL', professionalId: ep.professionalId, limit: 3, personId: ep.personId }) : [];
                  return (
                    <li key={c.id} className={`ctl-step is-${c.status}`}>
                      <span className="ctl-dot" aria-hidden="true"><Icon name={c.status === 'realizado' ? 'check' : c.status === 'reservado' ? 'calendar' : 'info'} size={16} /></span>
                      <div className="list-item">
                      <div className="row between"><strong>{c.id} · {c.note}</strong><StatusBadge status={c.status} /></div>
                      <span className="small muted">Indicado por {proName(s, c.indicatedBy)} el {fmtShort(c.indicatedAt)}</span>
                      {a && <span className="small">Turno <span className="code">{a.id}</span> v{a.version} · {fmtShort(a.start)} · {STATUS_LABEL[a.status]}</span>}
                      {a && (a.status === 'confirmada' || a.status === 'solicitada') && <div><Button size="sm" icon="calendar" onClick={() => setMoving(a.id)}>Reprogramar (mismo episodio)</Button></div>}
                      {c.status === 'indicado' && (
                        <div className="stack" style={{ gap: 6 }}>
                          <span className="small">Reservar con {proName(s, ep.professionalId)}:</span>
                          {slots.length === 0 ? <span className="muted small">Sin cupos en el horizonte; dejá la tarea abierta.</span> : (
                            <div className="row wrap">{slots.map((x) => <Button key={x.start} size="sm" variant="quiet" onClick={() => show(dispatch({ commandId: `book:ctl:${c.id}:${x.start}`, type: 'book', personId: ep.personId, serviceTypeId: 'ST-ORTO-CTRL', professionalId: x.professionalId, chairId: x.chairId, locationId: x.locationId, start: x.start, channel: 'recepcion', controlId: c.id }))}>{fmtShort(x.start)}</Button>)}</div>
                          )}
                        </div>
                      )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="card stack">
              <h3>Timeline administrativo</h3>
              <ul className="timeline">{[...ep.timeline].reverse().map((t, i) => <li key={i}><strong className="tabular">{fmtShort(t.at)}</strong> · <span className="tag">{t.kind}</span><br />{t.text}</li>)}</ul>
            </div>
          </div>
          <aside className="stack">
            <div className="card stack">
              <h3>Indicar control (profesional)</h3>
              <p className="small muted">La indicación la escribe la profesional. La demo no sugiere frecuencia. Crea una tarea para recepción; no reserva turno.</p>
              <Field label="Indicación administrativa">{(p) => <input {...p} value={indication} maxLength={200} onChange={(e) => setIndication(e.target.value)} placeholder="Ej.: control indicado en consulta" />}</Field>
              <Button variant="primary" onClick={() => { const r = dispatch({ type: 'episodeIndicateControl', episodeId: ep.id, note: indication }); show(r); if (r.ok) setIndication(''); }}>Registrar indicación</Button>
            </div>
            <div className="card stack">
              <h3>Nota al timeline</h3>
              <Field label="Nota administrativa">{(p) => <textarea {...p} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />}</Field>
              <Button onClick={() => { const r = dispatch({ type: 'episodeNote', episodeId: ep.id, text: note }); show(r); if (r.ok) setNote(''); }}>Agregar nota</Button>
            </div>
            <div className="card stack">
              <h3>Tareas del episodio</h3>
              {s.tasks.filter((t) => t.personId === ep.personId && t.kind === 'control_indicado').length === 0 ? <p className="small muted" style={{ margin: 0 }}>Sin tareas de control para esta persona.</p> : s.tasks.filter((t) => t.personId === ep.personId && t.kind === 'control_indicado').map((t) => <p key={t.id} className="small">{t.id} · {t.title} <StatusBadge status={t.status} /></p>)}
            </div>
            <details className="card appliance-catalog">
              <summary><strong>Catálogo de aparatología</strong></summary>
              <ul className="catalog-grid one">
                {APPLIANCES.map((a) => <li key={a.id} className="catalog-item"><OrthoArt kind={a.id} width={180} /><strong>{a.label}</strong><span className="small muted">{a.detail}</span></li>)}
              </ul>
            </details>
            <Notice tone="info" title="Sin progreso clínico">No mostramos porcentajes de avance ni fechas estimadas de finalización.</Notice>
          </aside>
        </div>
      )}
      {moving && <RescheduleDrawer appointmentId={moving} channel="recepcion" onClose={() => setMoving(null)} />}
    </section>
  );
}
