// Paleta de comandos (⌘K / Ctrl+K): <dialog> nativo con combobox + listbox accesibles.
// Solo navega: no ejecuta comandos de dominio ni cambia datos.
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useDemo } from '../app/store';
import { navigate } from '../app/router';
import { Icon, useNativeDialog } from './kit';

export interface PaletteRoute { to: string; label: string; icon: string; m: string }
interface Item { id: string; label: string; hint: string; icon: string; to: string; group: string }

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CommandPalette({ open, onClose, routes }: { open: boolean; onClose: () => void; routes: { group: string; items: PaletteRoute[] }[] }) {
  const ref = useNativeDialog(open, onClose);
  const s = useDemo();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const lid = useId();

  const all = useMemo<Item[]>(() => [
    ...routes.flatMap((g) => g.items.map((r) => ({ id: `r:${r.to}`, label: r.label, hint: `${g.group} · ${r.m}`, icon: r.icon, to: r.to, group: g.group }))),
    ...s.persons.map((p) => ({ id: `p:${p.id}`, label: `${p.firstName} ${p.lastName}`, hint: `${p.id} · ficha administrativa`, icon: 'user', to: `/admin/personas/${p.id}`, group: 'Personas' })),
    ...s.persons.map((p) => ({ id: `o:${p.id}`, label: `Odontograma de ${p.firstName} ${p.lastName}`, hint: `${p.id} · M09`, icon: 'tooth', to: `/admin/personas/${p.id}/odontograma`, group: 'Personas' })),
  ], [routes, s.persons]);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const list = terms.length ? all.filter((it) => terms.every((t) => norm(`${it.label} ${it.hint}`).includes(t))) : all.filter((it) => !it.id.startsWith('o:'));
    return list.slice(0, 12);
  }, [all, q]);

  if (!open) return null;
  const go = (it: Item | undefined) => { if (!it) return; onClose(); setQ(''); setActive(0); navigate(it.to); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
  };
  const current = Math.min(active, Math.max(0, results.length - 1));

  return (
    <dialog ref={ref} className="palette-dialog" aria-label="Buscar e ir a" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette">
        <div className="palette-search">
          <Icon name="search" />
          <input data-autofocus role="combobox" aria-expanded="true" aria-controls={lid} aria-autocomplete="list"
            aria-activedescendant={results[current] ? `${lid}-${current}` : undefined} aria-label="Buscar módulo o persona (nombre o ID)"
            placeholder="Buscar módulo o persona (nombre o ID)…" value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} />
          <kbd>Esc</kbd>
        </div>
        <ul id={lid} role="listbox" aria-label="Resultados" className="palette-list">
          {results.length === 0 && <li className="palette-empty" role="presentation">Sin resultados para “{q}”.</li>}
          {results.map((it, i) => (
            <li key={it.id} id={`${lid}-${i}`} role="option" aria-selected={i === current} className="palette-item"
              onMouseMove={() => setActive(i)} onClick={() => go(it)}>
              <span className="palette-ico"><Icon name={it.icon} size={16} /></span>
              <span className="palette-text"><strong>{it.label}</strong><small>{it.hint}</small></span>
              <span className="palette-group">{it.group}</span>
            </li>
          ))}
        </ul>
        <p className="palette-foot"><kbd>↑</kbd><kbd>↓</kbd> para moverte · <kbd>Enter</kbd> para ir · Solo navega, no cambia datos.</p>
      </div>
    </dialog>
  );
}
