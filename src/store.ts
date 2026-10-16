import { useSyncExternalStore } from 'react'
import { applyCommand, type Command } from './domain/reducer'
import type { Outcome } from './domain/core'
import {
  backupRaw,
  buildDiagnostic,
  getBrowserStorage,
  KEY_STATE,
  loadPrefs,
  loadState,
  resetProduct,
  saveState,
  savePrefs,
  type LoadResult,
  type Prefs,
  type StorageLike,
} from './domain/persistence'
import { makeSeed } from './domain/fixtures'
import type { AppState, FixtureId } from './domain/types'

export type RecoveryInfo = Extract<LoadResult, { kind: 'corrupt' | 'future' | 'needs-migration' }>

export interface Snapshot {
  phase: 'ready' | 'recovery'
  state: AppState
  recovery: RecoveryInfo | null
  storageMode: 'local' | 'memory'
  warning: string | null
  notice: string | null
  prefs: Prefs
  rev: number
}

let storage: StorageLike | null = null
let snap: Snapshot
const listeners = new Set<() => void>()

function emitChange() {
  for (const l of listeners) l()
}
function set(patch: Partial<Snapshot>) {
  snap = { ...snap, ...patch, rev: snap.rev + 1 }
  emitChange()
}

export function initStore(custom?: StorageLike | null) {
  storage = custom === undefined ? getBrowserStorage() : custom
  const prefs = loadPrefs(storage)
  const res = loadState(storage)
  const base: Snapshot = {
    phase: 'ready',
    state: res.kind === 'ok' || res.kind === 'fresh' ? res.state : makeSeed('servicio'),
    recovery: null,
    storageMode: storage ? 'local' : 'memory',
    warning: storage ? null : 'El almacenamiento del navegador no está disponible: la demo funciona en memoria y se pierde al recargar.',
    notice: null,
    prefs,
    rev: 0,
  }
  if (res.kind === 'corrupt' || res.kind === 'future' || res.kind === 'needs-migration') {
    base.phase = 'recovery'
    base.recovery = res
  }
  snap = base
  if (res.kind === 'fresh' && storage) persist()
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    ;(window as any).__tableflow = {
      getState: () => snap.state,
      dispatch,
      snapshot: () => snap,
    }
  }
}

function persist() {
  if (snap.phase !== 'ready' || snap.storageMode === 'memory') return
  const r = saveState(storage, snap.state, snap.state.clock.nowMs)
  if (!r.ok) {
    snap = {
      ...snap,
      storageMode: 'memory',
      warning: `${r.reason} La demo sigue en memoria: se pierde al recargar. Exportá el diagnóstico si necesitás conservar algo.`,
    }
  }
}

/** Otra pestaña modificó el estado: consistencia de la demo (último escritor gana), no concurrencia productiva. */
function onStorage(e: StorageEvent) {
  if (e.key !== KEY_STATE || snap.phase !== 'ready' || snap.storageMode === 'memory') return
  const res = loadState(storage)
  if (res.kind === 'ok') {
    set({ state: res.state, notice: 'Otra pestaña actualizó la demo; se cargó su versión (último guardado gana).' })
  }
}

export function getSnapshot(): Snapshot {
  return snap
}
export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
export function useApp(): AppState {
  return useSnapshot().state
}

export function dispatch(cmd: Command): Outcome {
  if (snap.phase !== 'ready') return { ok: false, code: 'recuperacion', message: 'La demo está en modo de recuperación.' }
  const { state, outcome } = applyCommand(snap.state, cmd)
  if (state !== snap.state) {
    snap = { ...snap, state, rev: snap.rev + 1 }
    persist()
    emitChange()
  }
  return outcome
}

export function dismissNotice() {
  set({ notice: null })
}

export function setPrefs(patch: Partial<Prefs>) {
  const prefs = { ...snap.prefs, ...patch }
  savePrefs(storage, prefs)
  set({ prefs })
}

/** Reinicio explícito (el diálogo de confirmación vive en la UI). Borra solo claves TableFlow. */
export function resetDemo(fixtureId: FixtureId) {
  const r = resetProduct(storage, fixtureId, 0)
  snap = {
    ...snap,
    phase: 'ready',
    recovery: null,
    state: r.state,
    storageMode: storage && r.persisted ? 'local' : 'memory',
    warning: r.persisted ? null : (r.reason ?? snap.warning),
    prefs: loadPrefs(storage),
    notice: `Demo reiniciada con el seed “${fixtureId === 'servicio' ? 'servicio cargado' : 'vacío'}”.`,
    rev: snap.rev + 1,
  }
  emitChange()
}

// ---- recuperación -------------------------------------------------------
export function recoveryDiagnostic() {
  if (!snap.recovery) return null
  return buildDiagnostic(snap.recovery, 'TableFlow demo')
}
export function recoverWith(fixtureId: FixtureId) {
  if (snap.recovery) backupRaw(storage, snap.recovery.raw)
  resetDemo(fixtureId)
}
export function recoverInMemory() {
  snap = {
    ...snap,
    phase: 'ready',
    recovery: null,
    state: makeSeed('servicio'),
    storageMode: 'memory',
    warning: 'Seguís en memoria: no se escribe en el navegador y el estado guardado original no se tocó.',
    rev: snap.rev + 1,
  }
  emitChange()
}
