import { makeSeed } from './fixtures'
import { SCHEMA_VERSION, STORAGE_NS, type AppState, type FixtureId } from './types'
import { validateState } from './validate'

/** Subconjunto de Storage que usamos; permite inyectar un fake en tests y en modo memoria. */
export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
  key(i: number): string | null
  readonly length: number
}

export const KEY_STATE = STORAGE_NS
export const KEY_PREFS = `${STORAGE_NS}.prefs`
export const KEY_BACKUP = `${STORAGE_NS}.corrupt-backup`

export interface Envelope {
  schemaVersion: number
  savedAt: number
  state: AppState
}

export type LoadResult =
  | { kind: 'ok'; state: AppState }
  | { kind: 'fresh'; state: AppState }
  | { kind: 'corrupt'; errors: string[]; raw: string; byteLength: number }
  | { kind: 'future'; version: number; raw: string; byteLength: number }
  | { kind: 'needs-migration'; version: number; raw: string; byteLength: number }

/** Migraciones explícitas entre versiones de esquema. Vacío: la v1 es la primera. */
export const MIGRATIONS: Record<number, (old: unknown) => unknown> = {}

export function getBrowserStorage(): StorageLike | null {
  try {
    const st = globalThis.localStorage
    if (!st) return null
    // sonda: algunos navegadores lanzan recién al escribir
    const probe = `${STORAGE_NS}.probe`
    st.setItem(probe, '1')
    st.removeItem(probe)
    return st
  } catch {
    return null
  }
}

export function loadState(storage: StorageLike | null): LoadResult {
  let raw: string | null = null
  try {
    raw = storage ? storage.getItem(KEY_STATE) : null
  } catch {
    raw = null
  }
  if (raw === null) return { kind: 'fresh', state: makeSeed('servicio') }
  const byteLength = raw.length
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { kind: 'corrupt', errors: [`JSON inválido: ${(e as Error).message}`], raw, byteLength }
  }
  const env = parsed as Partial<Envelope> | null
  if (!env || typeof env !== 'object' || typeof env.schemaVersion !== 'number' || !env.state) {
    return { kind: 'corrupt', errors: ['El contenido no tiene la forma esperada (schemaVersion/state).'], raw, byteLength }
  }
  if (env.schemaVersion > SCHEMA_VERSION) return { kind: 'future', version: env.schemaVersion, raw, byteLength }
  if (env.schemaVersion < SCHEMA_VERSION) {
    const mig = MIGRATIONS[env.schemaVersion]
    if (!mig) return { kind: 'needs-migration', version: env.schemaVersion, raw, byteLength }
    const migrated = mig(env.state)
    const errs = validateState(migrated)
    if (errs.length) return { kind: 'corrupt', errors: errs, raw, byteLength }
    return { kind: 'ok', state: migrated as AppState }
  }
  const errors = validateState(env.state)
  if (errors.length) return { kind: 'corrupt', errors, raw, byteLength }
  return { kind: 'ok', state: env.state }
}

export type SaveResult = { ok: true } | { ok: false; reason: string }

export function saveState(storage: StorageLike | null, state: AppState, savedAt: number): SaveResult {
  if (!storage) return { ok: false, reason: 'El almacenamiento del navegador no está disponible.' }
  try {
    const env: Envelope = { schemaVersion: SCHEMA_VERSION, savedAt, state }
    storage.setItem(KEY_STATE, JSON.stringify(env))
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: `No se pudo guardar (${(e as Error).name || 'error'}): cuota agotada o permiso denegado.` }
  }
}

/** Claves que pertenecen a TableFlow. Nunca se usa localStorage.clear(). */
export function tableflowKeys(storage: StorageLike): string[] {
  const out: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && (k === STORAGE_NS || k.startsWith(`${STORAGE_NS}.`))) out.push(k)
  }
  return out
}

/** Reinicio explícito: borra solo las claves TableFlow y deja el fixture elegido. */
export function resetProduct(storage: StorageLike | null, fixtureId: FixtureId, savedAt: number): { state: AppState; persisted: boolean; reason?: string } {
  const state = makeSeed(fixtureId)
  if (!storage) return { state, persisted: false, reason: 'Sin almacenamiento: la demo sigue en memoria.' }
  try {
    for (const k of tableflowKeys(storage)) storage.removeItem(k)
  } catch {
    /* sigue */
  }
  const r = saveState(storage, state, savedAt)
  return { state, persisted: r.ok, reason: r.ok ? undefined : r.reason }
}

/** Antes de reemplazar un estado corrupto se resguarda el texto original (no hay borrado silencioso). */
export function backupRaw(storage: StorageLike | null, raw: string): boolean {
  if (!storage) return false
  try {
    storage.setItem(KEY_BACKUP, raw)
    return true
  } catch {
    return false
  }
}

export function loadPrefs(storage: StorageLike | null): Prefs {
  try {
    const raw = storage?.getItem(KEY_PREFS)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    /* ignora */
  }
  return { ...DEFAULT_PREFS }
}
export function savePrefs(storage: StorageLike | null, prefs: Prefs) {
  try {
    storage?.setItem(KEY_PREFS, JSON.stringify(prefs))
  } catch {
    /* preferencias no críticas */
  }
}
export interface Prefs {
  reducedMotion: 'auto' | 'on'
  audio: boolean
  volume: number
  favorites: string[]
}
export const DEFAULT_PREFS: Prefs = { reducedMotion: 'auto', audio: false, volume: 0.2, favorites: [] }

/** Diagnóstico exportable: errores y conteos, sin contenido operable. */
export function buildDiagnostic(result: Extract<LoadResult, { kind: 'corrupt' | 'future' | 'needs-migration' }>, app: string) {
  return {
    app,
    namespace: STORAGE_NS,
    kind: result.kind,
    schemaVersionEsperada: SCHEMA_VERSION,
    bytes: result.byteLength,
    errores: result.kind === 'corrupt' ? result.errors : [],
    version: 'version' in result ? result.version : null,
    nota: 'Diagnóstico sintético: datos de demostración ficticios, sin información real.',
  }
}
