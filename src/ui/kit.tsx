import { useEffect, useId, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { STATUS_LABEL } from '../domain/selectors';

// ---------- Iconos propios (SVG inline, sin assets remotos) ----------
const PATHS: Record<string, string> = {
  check: 'M4 12.5l5 5L20 6.5',
  clock: 'M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  info: 'M12 11v6M12 7.5v.5M12 21a9 9 0 110-18 9 9 0 010 18z',
  x: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  calendar: 'M4 7h16M8 3v4M16 3v4M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  chat: 'M4 5h16v11H9l-5 4V5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0',
  tooth: 'M7 3c-2.2 0-4 1.8-4 4.5 0 3 1.5 4.5 2 7 .5 2.6 1 6.5 2.8 6.5 1.6 0 1.7-4.5 4.2-4.5s2.6 4.5 4.2 4.5c1.8 0 2.3-3.9 2.8-6.5.5-2.5 2-4 2-7C21 4.8 19.2 3 17 3c-2 0-3 1.2-5 1.2S9 3 7 3z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  inbox: 'M3 13l3-8h12l3 8v6H3v-6zM3 13h5l1 2h6l1-2h5',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a7.5 7.5 0 000-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 00-1.7-1L15 3h-4l-.3 3a7.5 7.5 0 00-1.7 1l-2.4-1-2 3.5 2 1.5a7.5 7.5 0 000 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 001.7 1l.3 3h4l.3-3a7.5 7.5 0 001.7-1l2.4 1 2-3.5-2-1.5z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7l12-4v4M16 13.5h.01',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13',
  volume: 'M4 9h4l5-4v14l-5-4H4V9zM16 9a4 4 0 010 6',
  mute: 'M4 9h4l5-4v14l-5-4H4V9zM17 9l4 6M21 9l-4 6',
  stop: 'M6 6h12v12H6z',
  play: 'M7 5l12 7-12 7V5z',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  plus: 'M12 5v14M5 12h14',
  home: 'M3 11l9-7 9 7M5 10v10h14V10',
  map: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  family: 'M8 11a3 3 0 100-6 3 3 0 000 6zM17 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 20a6 6 0 0112 0M13 20a4.5 4.5 0 019 0',
  pause: 'M8 5v14M16 5v14',
};
export function Icon({ name, size = 18, title }: { name: keyof typeof PATHS | string; size?: number; title?: string }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false">
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

// ---------- Botón ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'; icon?: string; size?: 'sm' | 'md' | 'lg' };
export function Button({ variant = 'secondary', icon, size = 'md', className = '', children, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
    </button>
  );
}

// ---------- Estados: siempre texto + icono ----------
const TONE: Record<string, { tone: string; icon: string }> = {
  confirmada: { tone: 'ok', icon: 'check' }, solicitada: { tone: 'warn', icon: 'clock' }, en_sala: { tone: 'info', icon: 'user' },
  en_atencion: { tone: 'info', icon: 'tooth' }, finalizada: { tone: 'muted', icon: 'check' }, ausente: { tone: 'muted', icon: 'info' },
  cancelada: { tone: 'muted', icon: 'x' }, pendiente: { tone: 'warn', icon: 'clock' }, asignada: { tone: 'info', icon: 'user' },
  resuelta: { tone: 'ok', icon: 'check' }, descartada: { tone: 'muted', icon: 'x' }, abierta: { tone: 'warn', icon: 'clock' }, en_curso: { tone: 'info', icon: 'refresh' },
  programado: { tone: 'info', icon: 'clock' }, entregado_simulado: { tone: 'ok', icon: 'check' }, anulado: { tone: 'muted', icon: 'x' },
  bloqueado_optout: { tone: 'muted', icon: 'stop' }, sin_cupo: { tone: 'warn', icon: 'alert' }, borrador: { tone: 'muted', icon: 'list' },
  emitido: { tone: 'info', icon: 'arrow' }, aceptado: { tone: 'ok', icon: 'check' }, rechazado: { tone: 'muted', icon: 'x' }, vencido: { tone: 'warn', icon: 'clock' },
  activa: { tone: 'info', icon: 'hourglass' }, vencida: { tone: 'muted', icon: 'clock' }, aceptada: { tone: 'ok', icon: 'check' },
  rechazada: { tone: 'muted', icon: 'x' }, tomada_por_otro: { tone: 'muted', icon: 'user' }, retirada: { tone: 'muted', icon: 'x' },
  derivada: { tone: 'warn', icon: 'user' }, cerrada: { tone: 'muted', icon: 'check' }, indicado: { tone: 'warn', icon: 'info' },
  reservado: { tone: 'info', icon: 'calendar' }, realizado: { tone: 'ok', icon: 'check' }, planificado: { tone: 'info', icon: 'clock' },
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const t = TONE[status] ?? { tone: 'muted', icon: 'info' };
  return <span className={`badge badge-${t.tone}`}><Icon name={t.icon} size={14} />{label ?? STATUS_LABEL[status] ?? status}</span>;
}

// ---------- Avisos ----------
export function Notice({ tone = 'info', title, children, action }: { tone?: 'info' | 'ok' | 'warn' | 'error'; title?: string; children?: ReactNode; action?: ReactNode }) {
  const icon = tone === 'ok' ? 'check' : tone === 'error' ? 'alert' : tone === 'warn' ? 'alert' : 'info';
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} />
      <div className="notice-body">{title && <strong>{title}</strong>}{children && <div>{children}</div>}{action && <div className="notice-action">{action}</div>}</div>
    </div>
  );
}

// ---------- Región viva global ----------
let liveText = '';
const liveListeners = new Set<() => void>();
export function announce(text: string) {
  liveText = '';
  liveListeners.forEach((l) => l());
  setTimeout(() => { liveText = text; liveListeners.forEach((l) => l()); }, 30);
}
export function LiveRegion() {
  const text = useSyncExternalStore((l) => { liveListeners.add(l); return () => liveListeners.delete(l); }, () => liveText);
  return <div className="sr-only" aria-live="polite" aria-atomic="true">{text}</div>;
}

// ---------- Formularios ----------
export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [hint ? `${fid}-hint` : '', error ? `${fid}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      {hint && <p className="hint" id={`${fid}-hint`}>{hint}</p>}
      {children({ id: fid, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error && <p className="field-msg" id={`${fid}-err`}><Icon name="alert" size={14} />{error}</p>}
    </div>
  );
}

export function ErrorSummary({ errors, labels }: { errors: Record<string, string>; labels: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const keys = Object.keys(errors);
  useEffect(() => { if (keys.length) ref.current?.focus(); }, [keys.length, errors]);
  if (!keys.length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <strong><Icon name="alert" /> Revisá {keys.length === 1 ? 'un dato' : `${keys.length} datos`} antes de seguir</strong>
      <ul>{keys.map((k) => <li key={k}><a href={`#${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(k)?.focus(); }}>{labels[k] ?? k}: {errors[k]}</a></li>)}</ul>
    </div>
  );
}

// ---------- Drawer / diálogo con foco atrapado y Escape ----------
function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    (node?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => { node?.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return ref;
}

export function Drawer({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useFocusTrap(open, onClose);
  const tid = useId();
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={tid} ref={ref} tabIndex={-1}>
        <header className="drawer-head"><h2 id={tid}>{title}</h2><Button variant="ghost" icon="x" onClick={onClose} aria-label="Cerrar" /></header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancelar', tone = 'primary', onConfirm, onCancel }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: 'primary' | 'danger'; onConfirm: () => void; onCancel: () => void }) {
  const ref = useFocusTrap(open, onCancel);
  const tid = useId();
  if (!open) return null;
  return (
    <div className="overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={tid} ref={ref} tabIndex={-1}>
        <h2 id={tid}>{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="row end">
          <Button variant="secondary" onClick={onCancel} data-autofocus>{cancelLabel}</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action, icon = 'info' }: { title: string; children?: ReactNode; action?: ReactNode; icon?: string }) {
  return <div className="empty"><Icon name={icon} size={28} /><strong>{title}</strong>{children && <p>{children}</p>}{action}</div>;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 tabIndex={-1} data-page-title>{title}</h1>{children && <div className="lede">{children}</div>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Kpi({ label, value, detail, n }: { label: string; value: string; detail: string; n?: string }) {
  return <div className="kpi"><span className="kpi-label">{label}</span><span className="kpi-value tabular">{value}</span><span className="kpi-detail">{detail}{n && <> · <span className="tabular">{n}</span></>}</span></div>;
}

/** Feedback de resultado de comando: éxito solo tras cambio real; error recuperable inline. */
export function useResult() {
  const [res, setRes] = useState<{ ok: boolean; message: string; conflicts?: { code: string; message: string }[] } | null>(null);
  const show = (r: { ok: boolean; message: string; conflicts?: { code: string; message: string }[] }) => { setRes(r); announce(r.message); };
  const view = res ? (
    <Notice tone={res.ok ? 'ok' : 'error'} title={res.message}>
      {!res.ok && res.conflicts?.length ? <ul className="plain">{res.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul> : null}
    </Notice>
  ) : null;
  return { show, view, clear: () => setRes(null), res };
}
