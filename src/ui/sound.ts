// Sonidos de interfaz sintetizados con Web Audio: sin archivos, sin voz, sin red.
// Apagados por defecto. El AudioContext se crea solo dentro de un gesto (clic/tecla) del usuario.
type AC = typeof AudioContext;
export type Sfx = 'tap' | 'toggle' | 'success' | 'error' | 'message' | 'stamp' | 'tick' | 'fanfare' | 'pop';

interface Note { f: number; d: number; t?: number; type?: OscillatorType; g?: number }
const SFX: Record<Sfx, Note[]> = {
  tap: [{ f: 880, d: 0.035, g: 0.025 }],
  toggle: [{ f: 660, d: 0.06 }, { f: 990, d: 0.08, t: 0.07 }],
  success: [{ f: 659.25, d: 0.09, type: 'triangle' }, { f: 987.77, d: 0.15, t: 0.09, type: 'triangle' }],
  error: [{ f: 330, d: 0.12 }, { f: 247, d: 0.16, t: 0.12 }],
  message: [{ f: 1046.5, d: 0.06, g: 0.035 }, { f: 1318.5, d: 0.08, t: 0.06, g: 0.035 }],
  stamp: [{ f: 140, d: 0.08, g: 0.08 }, { f: 1568, d: 0.14, t: 0.06, type: 'triangle', g: 0.04 }],
  tick: [{ f: 1200, d: 0.025, g: 0.018 }],
  pop: [{ f: 520, d: 0.05, g: 0.04 }, { f: 780, d: 0.06, t: 0.04, g: 0.03 }],
  fanfare: [
    { f: 523.25, d: 0.11, type: 'triangle' }, { f: 659.25, d: 0.11, t: 0.12, type: 'triangle' },
    { f: 783.99, d: 0.11, t: 0.24, type: 'triangle' }, { f: 1046.5, d: 0.26, t: 0.36, type: 'triangle' },
  ],
};

class SoundBus {
  private ctx: AudioContext | null = null;
  private nodes = new Set<OscillatorNode>();
  enabled = false;
  volume = 0.7;
  played: Sfx[] = []; // registro para pruebas y depuración (no se persiste)

  /** Llamar solo desde un gesto del usuario. */
  ensure(): boolean {
    if (!this.enabled) return false;
    try {
      const Ctor: AC | undefined = (globalThis as unknown as { AudioContext?: AC; webkitAudioContext?: AC }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
      if (!Ctor) return false;
      if (!this.ctx || this.ctx.state === 'closed') this.ctx = new Ctor();
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  get available() { return !!this.ctx && this.ctx.state !== 'closed'; }

  play(sfx: Sfx) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running' && ctx.state !== 'suspended') return;
    this.played.push(sfx);
    if (this.played.length > 50) this.played.shift();
    const t0 = ctx.currentTime + 0.01;
    for (const n of SFX[sfx]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.f;
      const start = t0 + (n.t ?? 0);
      const peak = (n.g ?? 0.05) * this.volume;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + Math.min(0.015, n.d / 3));
      gain.gain.linearRampToValueAtTime(0, start + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); this.nodes.delete(osc); };
      this.nodes.add(osc);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.shutdown();
  }

  /** Corta todo y cierra el contexto (pestaña oculta, apagado o reset). */
  shutdown() {
    this.nodes.forEach((o) => { try { o.stop(); } catch { /* ya detenido */ } try { o.disconnect(); } catch { /* ignorar */ } });
    this.nodes.clear();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }
}

export const sound = new SoundBus();
if (typeof window !== 'undefined') {
  (window as unknown as { __sound?: SoundBus }).__sound = sound;
  document.addEventListener('visibilitychange', () => { if (document.hidden) sound.shutdown(); });
  // Si la preferencia está activa, el contexto se crea en el próximo gesto (nunca autoplay).
  const onGesture = () => { if (sound.enabled && !sound.available) sound.ensure(); };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
}
