// Motivos sintéticos de 150–350 ms con Web Audio, solo tras un gesto del usuario y a volumen bajo.
// Representan turnos, no lenguaje: no hay TTS, micrófono ni reconocimiento de voz.
let ctx: AudioContext | null = null
let nodes: OscillatorNode[] = []

export function audioSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext)
}

export type Motif = 'inicio' | 'turno' | 'respuesta' | 'fin'
const MOTIFS: Record<Motif, { f: number; at: number; d: number }[]> = {
  inicio: [{ f: 392, at: 0, d: 0.09 }, { f: 523, at: 0.1, d: 0.12 }],
  turno: [{ f: 440, at: 0, d: 0.15 }],
  respuesta: [{ f: 330, at: 0, d: 0.08 }, { f: 392, at: 0.09, d: 0.08 }, { f: 494, at: 0.18, d: 0.1 }],
  fin: [{ f: 523, at: 0, d: 0.1 }, { f: 330, at: 0.11, d: 0.16 }],
}

/** Devuelve false si el navegador bloquea el audio: la UI sigue funcionando con la transcripción. */
export async function playMotif(m: Motif, volume: number): Promise<boolean> {
  try {
    if (!audioSupported()) return false
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') await ctx.resume()
    if (ctx.state !== 'running') return false
    const base = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(0.3, volume * 0.3))
    gain.connect(ctx.destination)
    for (const n of MOTIFS[m]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = n.f
      o.connect(gain)
      o.start(base + n.at)
      o.stop(base + n.at + n.d)
      nodes.push(o)
      o.onended = () => {
        nodes = nodes.filter((x) => x !== o)
      }
    }
    return true
  } catch {
    return false
  }
}

/** Corta lo que suene y libera el contexto (al detener o salir de la pantalla). */
export function stopAudio() {
  for (const o of nodes) {
    try {
      o.stop()
    } catch {
      /* ya terminó */
    }
  }
  nodes = []
  if (ctx) {
    const c = ctx
    ctx = null
    void c.close().catch(() => undefined)
  }
}
