import { useDemo } from '../../app/store';
import { setActingPerson, useUi } from '../../app/ui-state';
import { byId, dependentsOf, responsibleOf } from '../../domain/selectors';

/** Elige la persona de muestra por ID (no por nombre: hay homónimos). No es autenticación. */
export function PersonPicker({ label = 'Persona de muestra' }: { label?: string }) {
  const s = useDemo();
  const ui = useUi();
  const acting = byId(s.persons, ui.actingPersonId);
  const adults = s.persons.filter((p) => !s.responsibleLinks.some((l) => l.dependentId === p.id));
  const responsible = acting ? (responsibleOf(s, acting.id)[0] ?? acting) : undefined;
  const deps = responsible ? dependentsOf(s, responsible.id) : [];
  return (
    <div className="card sand stack" style={{ padding: 16 }}>
      <div className="row wrap" style={{ alignItems: 'end' }}>
        <div className="field" style={{ minWidth: 240, flex: 1 }}>
          <label htmlFor="acting">{label} <span className="muted small">(vista simulada, no es inicio de sesión)</span></label>
          <select id="acting" value={responsible?.id ?? ''} onChange={(e) => setActingPerson(e.target.value)}>
            {!responsible && <option value="">Elegí una persona</option>}
            {adults.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.firstName} {p.lastName} ({p.birthYear})</option>)}
          </select>
        </div>
        {deps.length > 0 && responsible && (
          <fieldset style={{ flex: 2 }}>
            <legend>Gestionar como responsable</legend>
            <div className="row wrap">
              {[{ person: responsible, label: 'Yo' }, ...deps.map((d) => ({ person: d.person, label: d.link.relation.replace(' (muestra)', '') }))].map(({ person, label: l }) => (
                <label key={person.id} className="choice">
                  <input type="radio" name="dependent" checked={ui.actingPersonId === person.id} onChange={() => setActingPerson(person.id)} />
                  {person.firstName} · {person.id} <span className="muted small">{person.id === responsible.id ? '' : `(${l === 'Yo' ? '' : 'dependiente'})`}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
      {acting && s.persons.some((p) => p.id !== acting.id && p.firstName === acting.firstName && p.lastName === acting.lastName) && (
        <p className="small muted" role="note">Hay otra persona con el mismo nombre. La demo distingue siempre por ID ({acting.id}).</p>
      )}
    </div>
  );
}
