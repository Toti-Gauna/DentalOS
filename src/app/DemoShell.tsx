// Shell de la demostración (lote 3): indicador “Demo” compacto en la cabecera, botonera flotante y selector inicial de
// vista. Son herramientas de la demo, no del producto: nada de esto es inicio de sesión ni permisos.
import { useState } from 'react';
import { PRESETS, type ViewRole } from '../domain';
import { fmtShort } from '../domain/time';
import { Button, ConfirmDialog, Icon, announce, useNativeDialog } from '../ui/kit';
import { sound } from '../ui/sound';
import { navigate } from './router';
import { ROLES, roleById } from './roles';
import { store, useStore } from './store';
import { chooseRole, clearDrafts, resetUi, setRole, setSoundPref, useUi } from './ui-state';

/** Indicador permanente y compacto: dice que es una demo y dónde se guarda; el detalle se abre a pedido. */
export function DemoBadge() {
  const snap = useStore();
  const local = snap.mode === 'local';
  return (
    <>
      <button type="button" className={`demo-badge${local ? '' : ' is-warn'}`} popoverTarget="demo-badge-info"
        aria-label={local ? 'Demo con datos ficticios, guardada en este dispositivo. Ver detalles' : 'Demo con datos ficticios, solo en memoria: no se guarda. Ver detalles'}>
        <Icon name={local ? 'info' : 'alert'} size={14} /> <span>Demo</span>{!local && <span className="demo-badge-extra"> · sin guardar</span>}
      </button>
      <div id="demo-badge-info" popover="auto" className="menu-pop demo-badge-pop" role="dialog" aria-label="Qué es esta demo">
        <p className="menu-pop-title">Demo · Clínica Brisa ficticia</p>
        <ul className="demo-facts storage-status">
          <li><Icon name="user" size={16} /> Personas, turnos y montos son de muestra.</li>
          <li><Icon name="chat" size={16} /> Sin envíos reales: WhatsApp, llamadas y recordatorios son simulados.</li>
          <li><Icon name={local ? 'check' : 'alert'} size={16} /> {local ? 'Guardado en este dispositivo.' : 'Solo en memoria: no se guarda.'}</li>
          <li><Icon name="clock" size={16} /> <span>Reloj de muestra: <span className="tabular">{fmtShort(snap.state.clock)}</span></span></li>
          <li><Icon name="tooth" size={16} /> No diagnostica ni recomienda tratamientos.</li>
        </ul>
        <p className="small muted">Vista, caso, sonido y reinicio están en el botón <strong>Demo</strong> de abajo a la derecha.</p>
      </div>
    </>
  );
}

function RoleList({ current, onPick, name }: { current: ViewRole | null; onPick: (r: ViewRole) => void; name: string }) {
  return (
    <ul className="role-list" role="list">
      {ROLES.map((r) => (
        <li key={r.id}>
          <button type="button" className="role-option" aria-pressed={current === r.id} data-role={r.id} name={name} onClick={() => onPick(r.id)}>
            <span className="role-ico"><Icon name={r.icon} size={20} /></span>
            <span><strong>{r.label}</strong><small>{r.description}</small></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Primera visita: elegir una vista de partida es opcional; se recuerda en este dispositivo y se cambia desde la botonera. */
export function RoleGate() {
  const ui = useUi();
  const open = !ui.roleChosen;
  const skip = () => chooseRole(null);
  const ref = useNativeDialog(open, skip);
  if (!open) return null;
  return (
    <dialog ref={ref} className="dialog-native role-gate" aria-labelledby="role-gate-title" aria-describedby="role-gate-desc">
      <div className="dialog">
        <p className="eyebrow">Demo · Clínica Brisa ficticia</p>
        <h2 id="role-gate-title">¿Cómo querés recorrer la demo?</h2>
        <p id="role-gate-desc" className="muted">Elegí un punto de partida. No es un inicio de sesión: todas las vistas comparten los mismos datos de muestra y podés cambiarla cuando quieras desde el botón <strong>Demo</strong>.</p>
        <RoleList current={null} name="gate-role" onPick={(r) => { chooseRole(r); navigate(roleById(r).home); announce(`Vista ${roleById(r).label}.`); }} />
        <div className="row end"><Button variant="ghost" onClick={skip} data-autofocus>Explorar sin elegir</Button></div>
      </div>
    </dialog>
  );
}

/** Botonera flotante de la demo (abajo a la derecha): vista, caso, ayuda, sonido y reinicio confirmado. */
export function DemoDock() {
  const ui = useUi();
  const snap = useStore();
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [confirm, setConfirm] = useState<null | 'preset' | 'reset'>(null);
  const hide = () => document.getElementById('demo-dock-panel')?.hidePopover?.();
  const pick = PRESETS.find((p) => p.id === preset)!;
  return (
    <div className="demo-dock">
      <button type="button" className="demo-dock-btn" popoverTarget="demo-dock-panel" aria-label={`Controles de la demo · vista ${roleById(ui.role).label}`}>
        <Icon name="settings" size={18} /> <span>Demo</span>
      </button>
      <div id="demo-dock-panel" popover="auto" className="demo-dock-panel" role="dialog" aria-labelledby="demo-dock-title">
        <header className="demo-dock-head">
          <div><p id="demo-dock-title" className="menu-pop-title">Controles de la demo</p><p className="small muted">Herramientas de la demostración, no del producto.</p></div>
          <Button variant="ghost" size="sm" icon="x" aria-label="Cerrar" onClick={hide} />
        </header>

        <section aria-labelledby="dock-role">
          <h3 id="dock-role">Vista <small className="muted">· no es inicio de sesión</small></h3>
          <RoleList current={ui.role} name="dock-role" onPick={(r) => { setRole(r); chooseRole(r); hide(); navigate(roleById(r).home); announce(`Vista ${roleById(r).label}: mismos datos y preferencias.`); }} />
        </section>

        <section aria-labelledby="dock-case">
          <h3 id="dock-case">Caso de muestra</h3>
          <div className="field">
            <label htmlFor="dock-preset">Escenario</label>
            <select id="dock-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="hint">{pick.description} <span className="tabular">Activo: {snap.state.preset}.</span></p>
          </div>
          <Button size="sm" icon="play" onClick={() => setConfirm('preset')}>Cargar caso</Button>
        </section>

        <section aria-labelledby="dock-help">
          <h3 id="dock-help">Ayuda</h3>
          <ul className="demo-facts small">
            <li><Icon name="search" size={16} /> <span><kbd>Ctrl</kbd> <kbd>K</kbd> busca módulos y personas en el panel.</span></li>
            <li><Icon name="link" size={16} /> <span>Portal y panel muestran los mismos turnos: lo que hagas en uno se ve en el otro.</span></li>
            <li><Icon name="info" size={16} /> <span>Sin backend, IA ni envíos reales. Todo queda en este dispositivo.</span></li>
          </ul>
        </section>

        <footer className="demo-dock-foot">
          <button type="button" className="btn btn-sm sound-toggle" aria-pressed={ui.sound}
            onClick={() => { const on = !ui.sound; sound.setEnabled(on); setSoundPref(on); if (on && sound.ensure()) sound.play('toggle'); }}>
            <Icon name={ui.sound ? 'volume' : 'mute'} size={16} /> <span>Sonidos: {ui.sound ? 'sí' : 'no'}</span>
          </button>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => setConfirm('reset')}>Reiniciar demo</Button>
        </footer>
      </div>

      <ConfirmDialog open={confirm === 'preset'} title={`¿Cargar el caso “${pick.name}”?`} confirmLabel="Cargar caso" onCancel={() => setConfirm(null)}
        onConfirm={() => { store.loadPreset(pick.id); clearDrafts(); setConfirm(null); hide(); announce(`Caso ${pick.name} cargado.`); if (pick.id !== 'storage_invalido') navigate(pick.route.replace('#', '')); }}>
        Reemplaza los datos de la demo en este dispositivo por los del caso. Se conservan la vista, el tema y el sonido.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'reset'} title="¿Reiniciar la demo?" confirmLabel="Reiniciar" tone="danger" onCancel={() => setConfirm(null)}
        onConfirm={() => { store.reset(); resetUi(); setConfirm(null); hide(); navigate('/'); announce('Demo reiniciada.'); }}>
        Se borra solo el espacio de la demo en este dispositivo (dentalos.demo.v1): turnos, mensajes y preferencias vuelven al inicio.
      </ConfirmDialog>
    </div>
  );
}
