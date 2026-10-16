import { useState } from 'react';
import { dispatch, useDemo } from '../../app/store';
import { navigate } from '../../app/router';
import { useDraft } from '../../app/ui-state';
import { validateNewPerson } from '../../domain';
import { byId, dependentsOf, estimateTotals, homonymsOf, ledgerNet, money, pastFor, proName, responsibleOf, serviceName, upcomingFor } from '../../domain/selectors';
import { fmtShort } from '../../domain/time';
import { Button, Drawer, EmptyState, ErrorSummary, Field, Notice, PageHeader, StatusBadge, announce, useResult } from '../../ui/kit';

export function People() {
  const s = useDemo();
  const [q, setQ] = useDraft('people:q', '');
  const [creating, setCreating] = useState(false);
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = s.persons.filter((p) => !q.trim() || norm(`${p.id} ${p.firstName} ${p.lastName}`).includes(norm(q.trim())));
  return (
    <section className="page">
      <PageHeader eyebrow="M08 · Recepción / profesional" title="Personas y familias" actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Nueva persona</Button>}>
        Datos administrativos ficticios. IDs P-001… en lugar de documentos. Sin teléfonos ni emails entregables.
      </PageHeader>
      <Field label="Buscar por ID o nombre">{(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} placeholder="P-001 o Sosa" />}</Field>
      {list.length === 0 ? <EmptyState title="Sin coincidencias" action={<Button onClick={() => setQ('')}>Limpiar búsqueda</Button>} /> : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Personas</caption>
            <thead><tr><th>ID</th><th>Nombre</th><th>Año</th><th>Vínculos</th><th>Próximo turno</th><th><span className="sr-only">Abrir</span></th></tr></thead>
            <tbody>
              {list.map((p) => {
                const next = upcomingFor(s, p.id)[0];
                const deps = dependentsOf(s, p.id);
                const resp = responsibleOf(s, p.id);
                return (
                  <tr key={p.id}>
                    <td className="code">{p.id}</td>
                    <td>{p.firstName} {p.lastName}{homonymsOf(s, p.id).length > 0 && <> <span className="tag">homónimo</span></>}</td>
                    <td className="tabular">{p.birthYear || '—'}</td>
                    <td className="small">{deps.length ? `Responsable de ${deps.map((d) => d.person.id).join(', ')}` : resp.length ? `Dependiente de ${resp.map((r) => r!.id).join(', ')}` : '—'}</td>
                    <td className="small tabular">{next ? `${fmtShort(next.start)} · ${next.id}` : '—'}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => navigate(`/admin/personas/${p.id}`)}>Abrir ficha</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewPersonDrawer onClose={() => setCreating(false)} />}
    </section>
  );
}

function NewPersonDrawer({ onClose }: { onClose: () => void }) {
  const s = useDemo();
  const [d, setD, clear] = useDraft('people:new', { firstName: '', lastName: '', birthYear: '', preferredChannel: '', responsibleId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const input = { firstName: d.firstName, lastName: d.lastName, birthYear: d.birthYear ? Number(d.birthYear) : null, preferredChannel: d.preferredChannel };
    const e = validateNewPerson(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = dispatch({ type: 'createPerson', input, responsibleId: d.responsibleId || undefined });
    announce(r.message);
    if (r.ok) { clear(); onClose(); navigate(`/admin/personas/${r.ids!.personId}`); }
  };
  return (
    <Drawer open title="Nueva persona (ficticia)" onClose={onClose} footer={<><Button onClick={onClose}>Cerrar (se conserva el borrador)</Button><Button variant="primary" onClick={submit}>Crear</Button></>}>
      <ErrorSummary errors={errors} labels={{ firstName: 'Nombre', lastName: 'Apellido', birthYear: 'Año', preferredChannel: 'Canal' }} />
      <Field label="Nombre" id="firstName" error={errors.firstName}>{(p) => <input {...p} value={d.firstName} onChange={(e) => setD({ ...d, firstName: e.target.value })} />}</Field>
      <Field label="Apellido" id="lastName" error={errors.lastName}>{(p) => <input {...p} value={d.lastName} onChange={(e) => setD({ ...d, lastName: e.target.value })} />}</Field>
      <Field label="Año de nacimiento (opcional)" id="birthYear" error={errors.birthYear}>{(p) => <input {...p} inputMode="numeric" value={d.birthYear} onChange={(e) => setD({ ...d, birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} />}</Field>
      <Field label="Canal preferido (simulado)" id="preferredChannel" error={errors.preferredChannel}>{(p) => <select {...p} value={d.preferredChannel} onChange={(e) => setD({ ...d, preferredChannel: e.target.value })}><option value="">Elegí</option><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="portal">Portal</option></select>}</Field>
      <Field label="Responsable (si es dependiente)">{(p) => <select {...p} value={d.responsibleId} onChange={(e) => setD({ ...d, responsibleId: e.target.value })}><option value="">Ninguno</option>{s.persons.filter((x) => x.kind === 'adulto').map((x) => <option key={x.id} value={x.id}>{x.id} · {x.firstName} {x.lastName}</option>)}</select>}</Field>
    </Drawer>
  );
}

export function PersonDetail({ id }: { id: string }) {
  const s = useDemo();
  const p = byId(s.persons, id);
  const [edit, setEdit] = useState<null | { firstName: string; lastName: string; preferredChannel: string; adminNote: string; version: number }>(null);
  const { show, view } = useResult();
  if (!p) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1} data-page-title>Persona no encontrada</h1>
        <EmptyState title={`No existe ${id} en la demo actual.`} action={<Button variant="primary" onClick={() => navigate('/admin/personas')}>Volver a personas</Button>} />
      </section>
    );
  }
  const deps = dependentsOf(s, p.id);
  const resp = responsibleOf(s, p.id);
  const homs = homonymsOf(s, p.id);
  const up = upcomingFor(s, p.id);
  const past = pastFor(s, p.id);
  const episodes = s.careEpisodes.filter((e) => e.personId === p.id);
  const estimates = s.estimates.filter((e) => e.personId === p.id);
  const tooth = s.toothChart.filter((t) => t.personId === p.id && t.status === 'vigente');
  const events = s.audit.filter((e) => e.entityId === p.id || (e.entity === 'ToothChartEntry' && e.detail.includes(`(${p.id})`))).slice(-8).reverse();
  const save = () => {
    if (!edit) return;
    const r = dispatch({ type: 'updatePerson', personId: p.id, expectedVersion: edit.version, patch: { firstName: edit.firstName, lastName: edit.lastName, preferredChannel: (edit.preferredChannel || null) as never, adminNote: edit.adminNote } });
    show(r);
    if (r.ok) setEdit(null);
  };
  return (
    <section className="page">
      <PageHeader eyebrow={`Ficha administrativa · ${p.id} · versión ${p.version}`} title={`${p.firstName} ${p.lastName}`} actions={<>
        <Button icon="tooth" onClick={() => navigate(`/admin/personas/${p.id}/odontograma`)}>Odontograma</Button>
        <Button icon="back" onClick={() => navigate('/admin/personas')}>Personas</Button>
      </>}>
        {p.kind === 'menor' ? 'Dependiente' : 'Adulto'} · año {p.birthYear || '—'} · canal preferido {p.preferredChannel ?? 'sin definir'} · recordatorios {p.reminderOptIn ? 'sí' : 'no (opt-out)'}
      </PageHeader>
      {homs.length > 0 && <Notice tone="warn" title="Homónimo">Existe {homs.map((h) => `${h.id} (${h.birthYear})`).join(', ')} con el mismo nombre. Historias separadas por ID; nunca se fusionan.</Notice>}
      {view}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <div className="row between"><h2 style={{ fontSize: 20, margin: 0 }}>Datos administrativos</h2>{!edit && <Button size="sm" onClick={() => setEdit({ firstName: p.firstName, lastName: p.lastName, preferredChannel: p.preferredChannel ?? '', adminNote: p.adminNote, version: p.version })}>Editar</Button>}</div>
          {edit ? (
            <div className="stack">
              {edit.version !== p.version && <Notice tone="warn" title={`La ficha cambió (ahora versión ${p.version}).`}>Guardar fallará para no pisar cambios; cancelá y volvé a editar.</Notice>}
              <Field label="Nombre">{(pp) => <input {...pp} value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} />}</Field>
              <Field label="Apellido">{(pp) => <input {...pp} value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} />}</Field>
              <Field label="Canal preferido">{(pp) => <select {...pp} value={edit.preferredChannel} onChange={(e) => setEdit({ ...edit, preferredChannel: e.target.value })}><option value="">Sin definir</option><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="portal">Portal</option></select>}</Field>
              <Field label="Nota administrativa">{(pp) => <textarea {...pp} value={edit.adminNote} maxLength={300} onChange={(e) => setEdit({ ...edit, adminNote: e.target.value })} />}</Field>
              <div className="row"><Button variant="primary" onClick={save}>Guardar (v{edit.version}→v{edit.version + 1})</Button><Button onClick={() => setEdit(null)}>Cancelar</Button></div>
            </div>
          ) : (
            <dl className="kv"><dt>ID</dt><dd className="code">{p.id}</dd><dt>Nota</dt><dd>{p.adminNote || '—'}</dd><dt>Contacto</dt><dd className="muted">Solo de muestra: sin teléfono ni email entregables.</dd></dl>
          )}
          <label className="choice"><input type="checkbox" checked={p.reminderOptIn} onChange={(e) => show(dispatch({ type: 'setReminderOptIn', personId: p.id, optIn: e.target.checked }))} /> Recordatorios simulados (opt-in ficticio)</label>
        </div>
        <div className="card stack">
          <h2 style={{ fontSize: 20 }}>Familia y vínculos</h2>
          {resp.length > 0 && <p>Responsable: {resp.map((r) => <a key={r!.id} href={`#/admin/personas/${r!.id}`}>{r!.firstName} {r!.lastName} ({r!.id})</a>)}</p>}
          {deps.length > 0 ? (
            <ul className="list">{deps.map((d) => <li key={d.person.id} className="list-item"><a href={`#/admin/personas/${d.person.id}`}><strong>{d.person.firstName} {d.person.lastName}</strong> · {d.person.id}</a><span className="small muted">{d.link.relation} · próximos: {upcomingFor(s, d.person.id).map((a) => a.id).join(', ') || 'ninguno'}</span></li>)}</ul>
          ) : resp.length === 0 && <p className="muted">Sin vínculos.</p>}
          <p className="small muted">Cada dependiente conserva sus propios turnos; cambiar de dependiente no mezcla citas.</p>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <h2 style={{ fontSize: 20 }}>Turnos</h2>
          {[...up, ...past].length === 0 ? <p className="muted">Sin turnos.</p> : (
            <ul className="plain">{[...up, ...past].map((a) => <li key={a.id}><span className="code">{a.id}</span> v{a.version} · {serviceName(s, a.serviceTypeId)} · <span className="tabular">{fmtShort(a.start)}</span> · {proName(s, a.professionalId)} <StatusBadge status={a.status} /></li>)}</ul>
          )}
        </div>
        <div className="card stack">
          <h2 style={{ fontSize: 20 }}>Registros vinculados</h2>
          <p><strong>Odontograma:</strong> {tooth.length} registro(s) vigente(s). <a href={`#/admin/personas/${p.id}/odontograma`}>Abrir</a></p>
          {episodes.map((e) => <p key={e.id}><strong>{e.title}</strong> ({e.id}) · {e.controls.filter((c) => c.status === 'indicado').length} control(es) indicado(s) sin turno. <a href="#/admin/ortodoncia">Ver timeline</a></p>)}
          {estimates.map((e) => { const t = estimateTotals(s, e); return <p key={e.id}><span className="code">{e.id}</span> <StatusBadge status={e.status} /> total {money(t.total)}{t.balance !== null ? ` · saldo ${money(t.balance)}` : ''}</p>; })}
          <p><strong>Caja ficticia (neto de la persona):</strong> <span className="tabular">{money(ledgerNet(s, p.id))}</span></p>
          <h3>Eventos recientes</h3>
          <ul className="plain small">{events.map((e) => <li key={e.id}><span className="tabular">{fmtShort(e.at)}</span> · {e.type.replace(/_/g, ' ')} · {e.detail}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
