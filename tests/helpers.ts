import { applyCommand, type Command } from '../src/domain/reducer'
import { makeSeed } from '../src/domain/fixtures'
import { atLocal } from '../src/domain/time'
import type { AppState, FixtureId, Role } from '../src/domain/types'
import { expect } from 'vitest'

export class T {
  constructor(public s: AppState) {}
  static seed(id: FixtureId = 'servicio') {
    return new T(makeSeed(id))
  }
  /** Ejecuta y devuelve el outcome; actualiza el estado. */
  run(cmd: Command, actor: Role = 'encargado') {
    const r = applyCommand(this.s, { actor, ...cmd })
    this.s = r.state
    return r.outcome
  }
  ok(cmd: Command, actor: Role = 'encargado') {
    const o = this.run(cmd, actor)
    if (!o.ok) throw new Error(`${cmd.type} debía andar: ${o.message}`)
    return o
  }
  fail(cmd: Command, code?: string, actor: Role = 'encargado') {
    const before = this.s
    const o = this.run(cmd, actor)
    expect(o.ok, `${cmd.type} debía fallar`).toBe(false)
    if (code && !o.ok) expect(o.code).toBe(code)
    if (!o.ok && !o.commit) expect(this.s).toBe(before) // transaccional: sin cambios parciales
    return o
  }
  at(dateKey: string, h: number, m = 0) {
    this.s.clock.nowMs = atLocal(dateKey, h * 60 + m)
  }
  get(coll: keyof AppState, id: string): any {
    return (this.s[coll] as any[]).find((x) => x.id === id)
  }
  count(coll: keyof AppState) {
    return (this.s[coll] as any[]).length
  }
}
export const MON = '2026-10-19'
export const fmt = (s: string) => s.replace(/ /g, ' ')
