import { useDemo } from '../../app/store';
import { setActingPerson, useUi } from '../../app/ui-state';
import { byId, dependentsOf, homonymsOf, responsibleOf } from '../../domain/selectors';
import { Icon } from '../../ui/kit';

/** Elige la persona de muestra por ID (no por nombre: hay homónimos). No es autenticación. */
export function PersonPicker({ label = 'Persona de muestra' }: { label?: string }) {
  const s = useDemo();
  const ui = useUi();
  const acting = byId(s.persons, ui.actingPersonId);
  const roots = s.persons.filter((p) => !s.responsibleLinks.some((l) => l.dependentId === p.id));
  const responsible = acting ? (responsibleOf(s, acting.id)[0] ?? acting) : undefined;
  const deps = responsible ? dependentsOf(s, responsible.id) : [];
  const homs = acting ? homonymsOf(s, acting.id) : [];
  return (
    <div className="acting">
      <div className="field">
        <label htmlFor="acting">{label} · vista simulada, no es inicio de sesión</label>
        <select id="acting" value={responsible?.id ?? ''} onChange={(e) => setActingPerson(e.target.value)}>
          {!responsible && <option value="">Elegí una persona</option>}
          {roots.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.firstName} {p.lastName} ({p.birthYear})</option>)}
        </select>
      </div>
      {deps.length > 0 && responsible && (
        <fieldset style={{ flex: '2 1 320px', border: 0, padding: 0 }}>
          <legend className="label">Gestionar turnos de</legend>
          <div className="chips">
            {[responsible, ...deps.map((d) => d.person)].map((person) => (
              <button key={person.id} type="button" className="chip" aria-pressed={ui.actingPersonId === person.id} onClick={() => setActingPerson(person.id)}>
                {person.id === responsible.id ? 'Yo' : person.firstName} · {person.id}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {homs.length > 0 && acting && (
        <p className="small muted" role="note" style={{ margin: 0, flexBasis: '100%' }}><Icon name="info" size={14} /> Hay otra persona con el mismo nombre ({homs.map((h) => h.id).join(', ')}). La demo distingue siempre por ID: estás viendo {acting.id}.</p>
      )}
    </div>
  );
}
