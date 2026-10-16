import { dispatch, useDemo } from '../../app/store';
import { useDraft } from '../../app/ui-state';
import { byId, personLabel, staffName } from '../../domain/selectors';
import { fmtShort, toMs } from '../../domain/time';
import { Button, EmptyState, Field, PageHeader, StatusBadge, useResult } from '../../ui/kit';

const KINDS: Record<string, string> = { derivacion: 'Derivación humana', excepcion_cambio: 'Cambio fuera de ventana', contacto_manual: 'Contacto manual', seguimiento_presupuesto: 'Seguimiento de presupuesto', control_indicado: 'Control indicado', confirmar_solicitud: 'Confirmar solicitud', general: 'General' };

export function Tasks() {
  const s = useDemo();
  const [f, setF] = useDraft('tasks:f', { status: 'abiertas', assignee: '', kind: '', overdue: false });
  const { show, view } = useResult();
  const now = toMs(s.clock);
  const list = s.tasks.filter((t) =>
    (f.status === 'todas' || (f.status === 'abiertas' ? t.status !== 'resuelta' : t.status === 'resuelta')) &&
    (!f.assignee || (f.assignee === 'none' ? !t.assigneeId : t.assigneeId === f.assignee)) &&
    (!f.kind || t.kind === f.kind) && (!f.overdue || (t.dueAt && toMs(t.dueAt) < now && t.status !== 'resuelta')));
  return (
    <section className="page">
      <PageHeader eyebrow="M13 · Recepción / dirección" title="Tareas">Excepciones, derivaciones y seguimientos administrativos. Cada tarea tiene clave de deduplicación: los reintentos no la duplican.</PageHeader>
      <div className="agenda-toolbar">
        <Field label="Estado">{(p) => <select {...p} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="abiertas">Abiertas</option><option value="resueltas">Resueltas</option><option value="todas">Todas</option></select>}</Field>
        <Field label="Responsable">{(p) => <select {...p} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}><option value="">Todos</option><option value="none">Sin responsable</option>{s.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
        <Field label="Tipo">{(p) => <select {...p} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="">Todos</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
        <label className="choice"><input type="checkbox" checked={f.overdue} onChange={(e) => setF({ ...f, overdue: e.target.checked })} /> Solo vencidas</label>
        <Button size="sm" variant="ghost" onClick={() => setF({ status: 'abiertas', assignee: '', kind: '', overdue: false })}>Limpiar</Button>
      </div>
      <p className="small muted" role="status">{list.length} de {s.tasks.length} tareas.</p>
      {view}
      {list.length === 0 ? <EmptyState title="Sin tareas con estos filtros" icon="check" /> : (
        <ul className="list">{list.map((t) => {
          const overdue = t.dueAt && toMs(t.dueAt) < now && t.status !== 'resuelta';
          return (
            <li key={t.id} className="list-item">
              <div className="row between"><strong>{t.id} · {t.title}</strong><span className="row">{overdue && <StatusBadge status="vencido" label="Vencida" />}<StatusBadge status={t.status} /></span></div>
              <span className="small">{t.detail}</span>
              <span className="meta"><span>{KINDS[t.kind]}</span>{t.personId && <span>{personLabel(s, t.personId)}</span>}{t.requestId && <span>gestión {t.requestId}</span>}{t.appointmentId && <span>turno {t.appointmentId}</span>}{t.estimateId && <span>{t.estimateId}</span>}{t.dueAt && <span className="tabular">vence {fmtShort(t.dueAt)}</span>}{t.ruleId && <span>{t.ruleId}</span>}<span className="code">{t.dedupeKey}</span></span>
              {t.note && <span className="small muted">Nota: {t.note}</span>}
              <div className="row wrap" style={{ alignItems: 'end' }}>
                <Field label="Responsable">{(p) => <select {...p} value={t.assigneeId ?? ''} onChange={(e) => show(dispatch({ type: 'updateTask', taskId: t.id, assigneeId: e.target.value || null, status: t.status === 'abierta' && e.target.value ? 'en_curso' : undefined }))}><option value="">{staffName(s, null)}</option>{s.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
                {t.status !== 'resuelta' ? <Button size="sm" variant="primary" onClick={() => show(dispatch({ type: 'updateTask', taskId: t.id, status: 'resuelta', note: t.note || 'Resuelta por recepción (muestra).' }))}>Marcar resuelta</Button>
                  : <Button size="sm" variant="ghost" onClick={() => show(dispatch({ type: 'updateTask', taskId: t.id, status: 'abierta' }))}>Reabrir</Button>}
                {t.appointmentId && byId(s.appointments, t.appointmentId) && <a className="btn btn-ghost btn-sm" href="#/admin">Ver agenda</a>}
              </div>
            </li>
          );
        })}</ul>
      )}
    </section>
  );
}
