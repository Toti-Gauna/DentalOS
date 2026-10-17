// Selector de tema (Sistema / Claro / Oscuro) en un popover nativo. Guarda la preferencia en este dispositivo.
import { useEffect, useId } from 'react';
import { setThemePref, useUi, type ThemePref } from '../app/ui-state';
import { Icon } from './kit';

const OPTIONS: { id: ThemePref; label: string; icon: string; hint: string }[] = [
  { id: 'system', label: 'Sistema', icon: 'monitor', hint: 'Sigue la configuración del dispositivo' },
  { id: 'light', label: 'Claro', icon: 'sun', hint: 'Fondo cálido y claro' },
  { id: 'dark', label: 'Oscuro', icon: 'moon', hint: 'Fondo profundo, menos brillo' },
];

/** Aplica la preferencia al documento: con "sistema" manda prefers-color-scheme (sin atributo). */
export function useApplyTheme() {
  const { theme } = useUi();
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme]);
}

export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { theme } = useUi();
  const pid = useId().replace(/:/g, '');
  const current = OPTIONS.find((o) => o.id === theme) ?? OPTIONS[0];
  return (
    <>
      <button type="button" className={`theme-btn btn btn-ghost btn-sm ${className}`} popoverTarget={`theme-${pid}`} aria-label={`Tema: ${current.label}`}>
        <Icon name={current.icon} size={16} />
        <span className="theme-btn-label">{current.label}</span>
      </button>
      <div id={`theme-${pid}`} popover="auto" className="menu-pop" role="dialog" aria-label="Elegir tema">
        <p className="menu-pop-title">Tema</p>
        <div className="theme-options" role="group" aria-label="Tema">
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" className="theme-option" aria-pressed={theme === o.id}
              onClick={(e) => { setThemePref(o.id); (e.currentTarget.closest('[popover]') as HTMLElement | null)?.hidePopover?.(); }}>
              <Icon name={o.icon} size={18} />
              <span><strong>{o.label}</strong><small>{o.hint}</small></span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
