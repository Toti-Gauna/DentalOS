// Dos tonos sintéticos suaves (120–180 ms), sin voz ni melodía reconocible. AudioContext solo tras un gesto.
type AC = typeof AudioContext;

export class ToneEngine {
  private ctx: AudioContext | null = null;
  private nodes = new Set<OscillatorNode>();
  volume = 0.5;
  muted = false;

  /** Debe llamarse desde un gesto del usuario. Devuelve false si el audio no está disponible o fue bloqueado. */
  start(): boolean {
    try {
      const Ctor: AC | undefined = (globalThis as unknown as { AudioContext?: AC; webkitAudioContext?: AC }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
      if (!Ctor) return false;
      if (!this.ctx) this.ctx = new Ctor();
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  get available() { return !!this.ctx && this.ctx.state !== 'closed'; }

  chime() {
    const ctx = this.ctx;
    if (!ctx || this.muted || this.volume <= 0 || ctx.state === 'closed') return;
    const t0 = ctx.currentTime + 0.01;
    [[523.25, 0], [659.25, 0.17]].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + offset; const dur = 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06 * this.volume, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); this.nodes.delete(osc); };
      this.nodes.add(osc);
      osc.start(start);
      osc.stop(start + dur + 0.01);
    });
  }

  /** Desmonta osciladores y cierra el contexto: nada suena después de detener. */
  stop() {
    this.nodes.forEach((o) => { try { o.stop(); } catch { /* ya detenido */ } try { o.disconnect(); } catch { /* ignorar */ } });
    this.nodes.clear();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }

  get activeNodes() { return this.nodes.size; }
}
