import type { AppState, FixtureId } from '../types'
import { emptySeed as emptyRaw, serviceSeed } from './seed'

export function makeSeed(id: FixtureId): AppState {
  if (id === 'vacio') {
    const s = emptyRaw()
    // stock sano: el seed vacío no trae alertas
    for (const [ing, qty] of [['I-07', 3000], ['I-13', 8000], ['I-14', 20]] as const) {
      const i = s.ingredients.find((x) => x.id === ing)!
      i.onHand = qty
      i.alertState = 'ok'
    }
    return s
  }
  return serviceSeed()
}
export { serviceSeed }
