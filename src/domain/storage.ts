// Adaptador local de persistencia. Namespace propio "dentalos.demo.v1"; nunca toca otras claves.
import { SCHEMA_VERSION, SEED, type DemoState } from './types';

export const NAMESPACE = 'dentalos.demo.v1';
export const STATE_KEY = NAMESPACE;

export interface Envelope { schemaVersion: number; seed: string; clock: string; revision: number; state: DemoState }

export type LoadResult =
  | { status: 'ok'; state: DemoState }
  | { status: 'empty' }
  | { status: 'corrupt'; raw: string; reason: string }
  | { status: 'unavailable'; reason: string };

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; readonly length: number }

export function getStorage(): KV | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = `${NAMESPACE}:probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

const COLLECTIONS: (keyof DemoState)[] = [
  'locations', 'professionals', 'chairs', 'serviceTypes', 'availabilityRules', 'blocks', 'staff', 'persons', 'responsibleLinks', 'appointments',
  'requests', 'conversations', 'messages', 'callSessions', 'automationRules', 'outbox', 'tasks', 'waitlist', 'offers', 'careEpisodes',
  'toothChart', 'estimates', 'estimateLines', 'ledger', 'learning', 'audit',
];
const APPT_STATUS = new Set(['solicitada', 'confirmada', 'en_sala', 'en_atencion', 'finalizada', 'ausente', 'cancelada']);

/** Validación estructural al hidratar. Devuelve el motivo del rechazo o null si es válido. */
export function validateState(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'No es un objeto.';
  const s = x as Record<string, unknown>;
  if (s.schemaVersion !== SCHEMA_VERSION) return `Versión de esquema ${String(s.schemaVersion)} no soportada.`;
  if (s.seed !== SEED) return 'Seed desconocida.';
  if (typeof s.clock !== 'string' || Number.isNaN(Date.parse(s.clock))) return 'Reloj inválido.';
  if (typeof s.revision !== 'number') return 'Revisión inválida.';
  if (!s.settings || typeof s.settings !== 'object' || !s.seq || typeof s.seq !== 'object' || !s.processed || typeof s.processed !== 'object') return 'Faltan ajustes o secuencias.';
  for (const c of COLLECTIONS) if (!Array.isArray(s[c])) return `Falta la colección ${String(c)}.`;
  for (const a of s.appointments as Record<string, unknown>[]) {
    if (typeof a?.id !== 'string' || typeof a.start !== 'string' || typeof a.end !== 'string' || Number.isNaN(Date.parse(a.start)) || !APPT_STATUS.has(String(a.status)) || typeof a.version !== 'number') return `Turno inválido ${String(a?.id)}.`;
  }
  for (const p of s.persons as Record<string, unknown>[]) if (typeof p?.id !== 'string' || typeof p.firstName !== 'string') return 'Persona inválida.';
  const ids = new Set<string>();
  for (const a of s.appointments as { id: string }[]) { if (ids.has(a.id)) return `ID duplicado ${a.id}.`; ids.add(a.id); }
  return null;
}

// Migraciones explícitas por versión de esquema (vacío: v1 es la primera).
const MIGRATIONS: Record<number, (env: Envelope) => Envelope> = {};

export function parseEnvelope(raw: string): LoadResult {
  let env: Envelope;
  try {
    env = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', raw, reason: 'JSON inválido.' };
  }
  let guard = 0;
  while (env && typeof env.schemaVersion === 'number' && env.schemaVersion < SCHEMA_VERSION && MIGRATIONS[env.schemaVersion] && guard++ < 10) env = MIGRATIONS[env.schemaVersion](env);
  const reason = validateState(env?.state);
  if (reason) return { status: 'corrupt', raw, reason };
  return { status: 'ok', state: env.state };
}

export function loadState(kv: KV | null): LoadResult {
  if (!kv) return { status: 'unavailable', reason: 'El almacenamiento local no está disponible (modo privado o bloqueado).' };
  let raw: string | null;
  try { raw = kv.getItem(STATE_KEY); } catch { return { status: 'unavailable', reason: 'No se pudo leer el almacenamiento local.' }; }
  if (raw === null) return { status: 'empty' };
  return parseEnvelope(raw);
}

export function serialize(state: DemoState): string {
  const env: Envelope = { schemaVersion: state.schemaVersion, seed: state.seed, clock: state.clock, revision: state.revision, state };
  return JSON.stringify(env);
}

export function saveState(kv: KV | null, state: DemoState): 'ok' | 'memory' {
  if (!kv) return 'memory';
  try { kv.setItem(STATE_KEY, serialize(state)); return 'ok'; } catch { return 'memory'; }
}

/** Borra SOLO las claves del namespace propio. */
export function clearNamespace(kv: KV | null): number {
  if (!kv) return 0;
  const keys: string[] = [];
  for (let i = 0; i < kv.length; i++) { const k = kv.key(i); if (k && (k === NAMESPACE || k.startsWith(`${NAMESPACE}:`))) keys.push(k); }
  for (const k of keys) { try { kv.removeItem(k); } catch { /* ignorar */ } }
  return keys.length;
}

export function readRevision(raw: string | null): number | null {
  if (!raw) return null;
  try { const env = JSON.parse(raw) as Envelope; return typeof env.revision === 'number' ? env.revision : null; } catch { return null; }
}
