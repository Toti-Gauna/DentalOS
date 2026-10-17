// Store único de la demo: un estado compartido por todos los roles y canales.
import { useSyncExternalStore } from 'react';
import { createSeedState, execute, presetById, type CommandInput, type CommandResult, type DemoState } from '../domain';
import { clearNamespace, getStorage, loadState, readRevision, saveState, STATE_KEY, type KV } from '../domain/storage';

export type StorageMode = 'local' | 'memory';
export interface StoreSnapshot {
  state: DemoState;
  mode: StorageMode;
  corrupt: { raw: string; reason: string } | null;
  externalChange: boolean;
  notice: string | null;
  /** Último turno creado o modificado (transitorio, no se persiste): permite resaltar la misma cita en portal y recepción. */
  lastChange: { appointmentId: string; revision: number; kind: 'nuevo' | 'cambio' | 'estado' } | null;
}

function diffAppointment(prev: DemoState, next: DemoState): StoreSnapshot['lastChange'] {
  const before = new Map(prev.appointments.map((a) => [a.id, a]));
  for (const a of next.appointments) {
    const b = before.get(a.id);
    if (!b) return { appointmentId: a.id, revision: next.revision, kind: 'nuevo' };
    if (b.version !== a.version || b.start !== a.start || b.chairId !== a.chairId) return { appointmentId: a.id, revision: next.revision, kind: 'cambio' };
    if (b.status !== a.status || b.patientConfirmedVersion !== a.patientConfirmedVersion) return { appointmentId: a.id, revision: next.revision, kind: 'estado' };
  }
  return null;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v as object).sort().map((k) => `${k}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

class DemoStore {
  private kv: KV | null = null;
  private listeners = new Set<() => void>();
  snap!: StoreSnapshot;

  init() {
    this.kv = getStorage();
    const loaded = loadState(this.kv);
    if (loaded.status === 'ok') this.snap = { state: loaded.state, mode: 'local', corrupt: null, externalChange: false, notice: null, lastChange: null };
    else if (loaded.status === 'empty') { this.snap = { state: createSeedState(), mode: 'local', corrupt: null, externalChange: false, notice: null, lastChange: null }; this.persist(); }
    else if (loaded.status === 'corrupt') this.snap = { state: createSeedState(), mode: 'memory', corrupt: { raw: loaded.raw, reason: loaded.reason }, externalChange: false, notice: null, lastChange: null };
    else this.snap = { state: createSeedState(), mode: 'memory', corrupt: null, externalChange: false, notice: loaded.reason, lastChange: null };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== STATE_KEY) return;
        const rev = readRevision(e.newValue);
        if (rev !== this.snap.state.revision) this.set({ externalChange: true });
      });
    }
  }

  private set(patch: Partial<StoreSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private persist() {
    if (this.snap.corrupt) return; // no pisar datos dañados sin que la persona decida
    const mode: StorageMode = saveState(this.kv, this.snap.state) === 'ok' ? 'local' : 'memory';
    if (mode !== this.snap.mode) this.snap = { ...this.snap, mode, notice: mode === 'memory' ? 'No se pudo guardar en este dispositivo (cuota o permiso). La demo sigue en memoria.' : null };
  }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  getSnapshot = () => this.snap;

  /** commandId estable por intención: si no se pasa, se deriva de tipo+payload+revisión (doble clic = mismo id). */
  dispatch = (cmd: CommandInput & { commandId?: string }): CommandResult & { replayed?: boolean } => {
    const { commandId, ...rest } = cmd as CommandInput & { commandId?: string };
    const id = commandId ?? `ui:${this.snap.state.revision}:${stableStringify(rest)}`;
    const r = execute(this.snap.state, { ...(rest as CommandInput), commandId: id } as never);
    if (r.state !== this.snap.state) {
      const changed = diffAppointment(this.snap.state, r.state);
      this.snap = { ...this.snap, state: r.state, lastChange: changed ?? this.snap.lastChange };
      this.persist();
      this.listeners.forEach((l) => l());
    }
    return { ...r.result, replayed: r.replayed };
  };

  reset() {
    clearNamespace(this.kv);
    this.snap = { state: createSeedState(), mode: this.kv ? 'local' : 'memory', corrupt: null, externalChange: false, notice: null, lastChange: null };
    this.persist();
    this.listeners.forEach((l) => l());
  }

  loadPreset(id: string) {
    const p = presetById(id);
    if (!p) return;
    if (id === 'storage_invalido') {
      try { this.kv?.setItem(STATE_KEY, '{"schemaVersion":1,"seed":"dentalos-v1","state":{"dañado":tru'); } catch { /* sin storage */ }
      const loaded = loadState(this.kv);
      this.set({ corrupt: loaded.status === 'corrupt' ? { raw: loaded.raw, reason: loaded.reason } : { raw: '', reason: 'Simulado' }, mode: 'memory', state: createSeedState() });
      return;
    }
    this.snap = { ...this.snap, state: p.build(), corrupt: null, externalChange: false, lastChange: null };
    this.persist();
    this.listeners.forEach((l) => l());
  }

  reloadFromStorage() {
    const loaded = loadState(this.kv);
    if (loaded.status === 'ok') this.set({ state: loaded.state, externalChange: false, corrupt: null });
    else if (loaded.status === 'corrupt') this.set({ corrupt: { raw: loaded.raw, reason: loaded.reason }, externalChange: false });
    else this.set({ externalChange: false });
  }

  keepMemoryOnly() { this.set({ externalChange: false, notice: 'Otra pestaña cambió la demo; esta pestaña sigue con su propia copia hasta que recargues.' }); }
}

export const store = new DemoStore();
store.init();

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
export function useDemo() {
  return useStore().state;
}
export const dispatch = store.dispatch;
export function useLastChange() {
  return useStore().lastChange;
}
