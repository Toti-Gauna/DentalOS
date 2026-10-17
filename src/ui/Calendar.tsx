// Calendario mensual para elegir fecha (reserva del portal). Semana de lunes a domingo, días con la cantidad de
// horarios libres y navegación por teclado: flechas (día / semana), Inicio y Fin (semana), RePág y AvPág (mes).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, at, parts } from '../domain/time';
import { Icon } from './kit';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const HEAD = [['L', 'lunes'], ['M', 'martes'], ['M', 'miércoles'], ['J', 'jueves'], ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo']];

const monthOf = (date: string) => date.slice(0, 7);
const firstOf = (month: string) => `${month}-01`;
const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
/** El mismo número de día en otro mes; un 31 que no existe ahí pasa al último día de ese mes. */
const sameDayIn = (month: string, date: string) => {
  const last = addDays(firstOf(shiftMonth(month, 1)), -1);
  return date.slice(8) > last.slice(8) ? last : `${month}-${date.slice(8)}`;
};
/** Lunes = 0 … domingo = 6. */
const mondayIndex = (date: string) => (parts(at(date, '12:00')).weekday + 6) % 7;

interface CalendarProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  min: string;
  max: string;
  today: string;
  /** Horarios libres del día; `null` si la clínica no atiende ese día. */
  count: (date: string) => number | null;
}

export function MonthCalendar({ label, value, onChange, min, max, today, count }: CalendarProps) {
  const [month, setMonth] = useState(monthOf(value));
  const [focusDate, setFocusDate] = useState(value);
  const grid = useRef<HTMLTableElement>(null);
  const wantFocus = useRef(false);
  useEffect(() => { setMonth(monthOf(value)); setFocusDate(value); }, [value]);
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`button[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, month]);

  const start = firstOf(month);
  const lead = mondayIndex(start);
  const days: string[] = [];
  for (let d = start; monthOf(d) === month; d = addDays(d, 1)) days.push(d);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const inRange = (d: string) => d >= min && d <= max;
  const free = (d: string) => (inRange(d) ? count(d) : null);
  const canPrev = monthOf(min) < month;
  const canNext = monthOf(max) > month;
  const [y, m] = month.split('-').map(Number);

  const moveFocus = (target: string) => {
    const clamped = target < min ? min : target > max ? max : target;
    wantFocus.current = true;
    setFocusDate(clamped);
    if (monthOf(clamped) !== month) setMonth(monthOf(clamped));
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: string) => {
    const k = e.key;
    const target = k === 'ArrowRight' ? addDays(d, 1) : k === 'ArrowLeft' ? addDays(d, -1) : k === 'ArrowDown' ? addDays(d, 7) : k === 'ArrowUp' ? addDays(d, -7)
      : k === 'Home' ? addDays(d, -mondayIndex(d)) : k === 'End' ? addDays(d, 6 - mondayIndex(d))
        : k === 'PageDown' ? sameDayIn(shiftMonth(monthOf(d), 1), d) : k === 'PageUp' ? sameDayIn(shiftMonth(monthOf(d), -1), d) : null;
    if (!target) return;
    e.preventDefault();
    moveFocus(target);
  };
  const tabbable = days.includes(focusDate) ? focusDate : days.find((d) => inRange(d)) ?? days[0];

  return (
    <div className="calendar" role="group" aria-labelledby="cal-label">
      <div className="calendar-head">
        <span id="cal-label" className="calendar-label">{label}</span>
        <div className="calendar-nav">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMonth(shiftMonth(month, -1))} disabled={!canPrev} aria-label="Mes anterior"><Icon name="back" /></button>
          <p className="calendar-month" aria-live="polite"><span>{MONTHS[m - 1]}</span> <span className="tabular">{y}</span></p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canNext} aria-label="Mes siguiente"><Icon name="arrow" /></button>
        </div>
      </div>
      <table className="calendar-grid" ref={grid} role="grid" aria-label={`${MONTHS[m - 1]} de ${y}`}>
        <thead><tr>{HEAD.map(([s, l], i) => <th key={i} scope="col" abbr={l}><span aria-hidden="true">{s}</span><span className="sr-only">{l}</span></th>)}</tr></thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={i}>
              {w.map((d, j) => {
                if (!d) return <td key={j} />;
                const n = free(d);
                const p = parts(at(d, '12:00'));
                const disabled = !n;
                const note = !inRange(d) ? 'fuera del plazo para reservar' : n === null ? 'sin atención' : n === 0 ? 'sin horarios libres' : `${n} horario${n === 1 ? '' : 's'} libre${n === 1 ? '' : 's'}`;
                return (
                  <td key={j}>
                    <button type="button" data-date={d} className={`calendar-day${d === today ? ' is-today' : ''}`} aria-pressed={d === value} aria-disabled={disabled || undefined}
                      tabIndex={d === tabbable ? 0 : -1} onKeyDown={(e) => onKey(e, d)} onFocus={() => setFocusDate(d)}
                      onClick={() => { if (!disabled) onChange(d); }}
                      aria-label={`${DOW_LONG[p.weekday]} ${p.day} de ${MONTHS[p.month - 1]}${d === today ? ', hoy' : ''}: ${note}`}>
                      <span className="calendar-num tabular" aria-hidden="true">{p.day}</span>
                      <span className="calendar-free tabular" aria-hidden="true">{n ? n : n === 0 ? '—' : ''}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="calendar-legend small muted"><span className="calendar-dot" aria-hidden="true" /> Número: horarios libres ese día · Días apagados: sin atención o sin horarios.</p>
    </div>
  );
}
