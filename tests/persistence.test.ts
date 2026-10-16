import { describe, expect, it } from 'vitest'
import { applyCommand } from '../src/domain/reducer'
import { makeSeed } from '../src/domain/fixtures'
import {
  backupRaw, buildDiagnostic, KEY_BACKUP, KEY_PREFS, KEY_STATE, loadState, resetProduct, saveState, tableflowKeys, type StorageLike,
} from '../src/domain/persistence'

class FakeStorage implements StorageLike {
  data = new Map<string, string>()
  failWrites = false
  get length() { return this.data.size }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) {
    if (this.failWrites) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    this.data.set(k, v)
  }
  removeItem(k: string) { this.data.delete(k) }
}

const withCart = () => {
  const { state } = applyCommand(makeSeed('servicio'), { type: 'cart/add', businessId: 'ritual-cafe', locationId: 'L-RC-norte', itemId: 'RC-01', qty: 2, selections: { 'MG-origen': ['or-huila'] } })
  return state
}

describe('Persistencia local tableflow.demo.v1', () => {
  it('S02: el carrito y la sede sobreviven a la recarga (rehidratación validada)', () => {
    const st = new FakeStorage()
    const s = withCart()
    s.session.locationByBusiness['ritual-cafe'] = 'L-RC-norte'
    expect(saveState(st, s, 1)).toEqual({ ok: true })
    const r = loadState(st)
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.state.carts[0].lines[0]).toMatchObject({ itemId: 'RC-01', qty: 2 })
    expect(r.state.session.locationByBusiness['ritual-cafe']).toBe('L-RC-norte')
    expect(r.state).toEqual(s)
  })
  it('sin datos guardados: arranca el seed de servicio', () => {
    const r = loadState(new FakeStorage())
    expect(r.kind).toBe('fresh')
  })
  it('S02/S45: almacenamiento denegado o sin cuota → resultado explícito (la UI pasa a memoria con aviso)', () => {
    const st = new FakeStorage()
    st.failWrites = true
    const r = saveState(st, makeSeed('servicio'), 1)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toMatch(/cuota|permiso/)
    expect(saveState(null, makeSeed('servicio'), 1).ok).toBe(false)
    expect(loadState(null).kind).toBe('fresh')
  })
  it('S45: JSON corrupto permite diagnóstico y no borra nada por su cuenta', () => {
    const st = new FakeStorage()
    st.data.set(KEY_STATE, '{"schemaVersion":1,"state":{oops')
    const r = loadState(st)
    expect(r.kind).toBe('corrupt')
    if (r.kind !== 'corrupt') return
    expect(st.data.get(KEY_STATE)).toBe('{"schemaVersion":1,"state":{oops') // sigue ahí
    const d = buildDiagnostic(r, 'TableFlow demo')
    expect(d.kind).toBe('corrupt')
    expect(d.errores.length).toBeGreaterThan(0)
    expect(JSON.stringify(d)).not.toMatch(/oops/) // el diagnóstico es sintético, no copia el contenido
    // resguardo antes de restaurar
    expect(backupRaw(st, r.raw)).toBe(true)
    expect(st.data.get(KEY_BACKUP)).toBe(r.raw)
  })
  it('S45: estado con forma válida pero referencias rotas también se detecta', () => {
    const st = new FakeStorage()
    const s = makeSeed('servicio')
    s.orders[0].sessionId = 'S-999'
    s.reservations[1].businessId = 'otro-negocio' as never
    saveState(st, s, 1)
    const r = loadState(st)
    expect(r.kind).toBe('corrupt')
    if (r.kind === 'corrupt') expect(r.errors.join(' ')).toMatch(/referencia rota|businessId inexistente/)
  })
  it('versión futura o sin migrador: no se pisa; se pide migrar o reiniciar', () => {
    const st = new FakeStorage()
    st.data.set(KEY_STATE, JSON.stringify({ schemaVersion: 2, savedAt: 0, state: {} }))
    expect(loadState(st).kind).toBe('future')
    st.data.set(KEY_STATE, JSON.stringify({ schemaVersion: 0, savedAt: 0, state: {} }))
    expect(loadState(st).kind).toBe('needs-migration')
    expect(st.data.has(KEY_STATE)).toBe(true)
  })
  it('S46: reiniciar borra solo las claves TableFlow, nunca localStorage.clear()', () => {
    const st = new FakeStorage()
    st.data.set('otra-app.token', 'x')
    st.data.set('tableflow.demo.v10', 'ajeno') // prefijo parecido pero otro namespace
    saveState(st, withCart(), 1)
    st.data.set(KEY_PREFS, '{"audio":true}')
    st.data.set(KEY_BACKUP, 'viejo')
    expect(tableflowKeys(st).sort()).toEqual([KEY_BACKUP, KEY_PREFS, KEY_STATE].sort())
    const r = resetProduct(st, 'servicio', 5)
    expect(r.persisted).toBe(true)
    expect(st.data.get('otra-app.token')).toBe('x')
    expect(st.data.get('tableflow.demo.v10')).toBe('ajeno')
    expect(st.data.has(KEY_PREFS)).toBe(false)
    const back = loadState(st)
    expect(back.kind).toBe('ok')
    if (back.kind === 'ok') {
      expect(back.state.carts).toHaveLength(0)
      expect(JSON.stringify(back.state)).toBe(JSON.stringify(makeSeed('servicio'))) // totales y conteos del seed original
    }
  })
  it('reiniciar al seed vacío y fallo de escritura → memoria sin romper', () => {
    const st = new FakeStorage()
    const r = resetProduct(st, 'vacio', 1)
    expect(r.state.fixtureId).toBe('vacio')
    st.failWrites = true
    const r2 = resetProduct(st, 'servicio', 1)
    expect(r2.persisted).toBe(false)
    expect(r2.reason).toMatch(/cuota|permiso/)
  })
})
