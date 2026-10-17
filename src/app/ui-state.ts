// Estado de interfaz (vista de muestra, persona elegida, borradores y filtros). No es seguridad ni sesión.
import { useCallback, useSyncExternalStore } from 'react';
import { NAMESPACE } from '../domain/storage';
import type { ViewRole } from '../domain';

const UI_KEY = `${NAMESPACE}:ui`;
interface UiState { role: ViewRole; actingPersonId: string; sound: boolean; drafts: Record<string, unknown> }
const DEFAULT: UiState = { role: 'paciente', actingPersonId: 'P-001', sound: false, drafts: {} };

function read(): UiState {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<UiState>;
    return { ...DEFAULT, ...v, drafts: typeof v.drafts === 'object' && v.drafts ? v.drafts : {} };
  } catch { return DEFAULT; }
}
let ui: UiState = read();
const listeners = new Set<() => void>();
function write(next: UiState) {
  ui = next;
  try { globalThis.localStorage?.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* memoria */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useUi() {
  return useSyncExternalStore(subscribe, () => ui);
}
export const setRole = (role: ViewRole) => write({ ...ui, role });
export const setActingPerson = (actingPersonId: string) => write({ ...ui, actingPersonId });
export const resetUi = () => write(DEFAULT);
export const setSoundPref = (sound: boolean) => write({ ...ui, sound });

/** Borrador persistente por clave: sobrevive a navegar y recargar; se limpia al confirmar o con reset. */
export function useDraft<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, () => void] {
  const state = useUi();
  const value = (key in state.drafts ? state.drafts[key] : initial) as T;
  const set = useCallback((v: T | ((p: T) => T)) => {
    const prev = (key in ui.drafts ? ui.drafts[key] : initial) as T;
    const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
    write({ ...ui, drafts: { ...ui.drafts, [key]: next } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const clear = useCallback(() => { const d = { ...ui.drafts }; delete d[key]; write({ ...ui, drafts: d }); }, [key]);
  return [value, set, clear];
}
