// Tres direcciones visuales para que Ignacio elija (lote 2). Ninguna está aprobada: sirven para comparar sobre
// el mismo contenido real. Tras la elección, los tokens de la elegida pasan al sistema de la app (lote 3).

export type PropId = 'a' | 'b' | 'c';
export type Mode = 'light' | 'dark';

export interface Palette {
  /** Fondo y su segundo tono (degradé o fondo alterno). */
  bg: string;
  bg2: string;
  /** Manchas de fondo decorativas (solo B): el texto sobre vidrio se mide contra todas. */
  blobs?: string[];
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
  /** Acento como texto o ícono sobre fondo y superficie. */
  accentInk: string;
  accentSoft: string;
  /** Segundo acento: oro (A), coral (B), menta (C). */
  accent2: string;
  accent2Ink: string;
  success: string;
  warn: string;
  danger: string;
  focus: string;
  glassEdge?: string;
}

export interface Proposal {
  id: PropId;
  letter: 'A' | 'B' | 'C';
  name: string;
  tagline: string;
  fonts: { display: string; text: string; mono: string };
  fontNote: string;
  why: string[];
  risks: string[];
  grid: string;
  density: string;
  surfaces: string;
  radii: { card: number; control: number; chip: number };
  shadow: string;
  motion: { fast: number; base: number; slow: number; ease: string; note: string };
  signature: string;
  palettes: Record<Mode, Palette>;
}

export const PROPOSALS: Proposal[] = [
  {
    id: 'a',
    letter: 'A',
    name: 'Editorial clínico cálido',
    tagline: 'Papel cálido, títulos serif y filetes finos: una clínica que se lee como una buena publicación.',
    fonts: { display: "'Newsreader', Georgia, serif", text: "'Source Sans 3', system-ui, sans-serif", mono: "'Source Sans 3', system-ui, sans-serif" },
    fontNote: 'Newsreader 500/600 (títulos) + Source Sans 3 400/600 (texto). Ambas OFL, empaquetadas localmente.',
    why: [
      'Evoluciona el teal y oro actuales: se conserva lo que ya se reconoce y se gana calma y confianza.',
      'El serif en títulos y los números de fecha da una voz humana y profesional, lejos del dashboard genérico.',
      'Mucho aire y jerarquía tipográfica: ideal para el portal de pacientes y la lectura en móvil.',
    ],
    risks: [
      'En el panel, la tipografía editorial necesita más disciplina para no perder densidad operativa.',
      'El serif pierde nitidez en tamaños chicos: se usa solo de 20 px para arriba.',
    ],
    grid: '12 columnas, márgenes amplios (72 px en escritorio), ritmo de 8 px; secciones separadas por filetes de 1 px.',
    density: 'Portal aireado; panel con filas de 44 px y tipografía de texto (no serif) en datos.',
    surfaces: 'Superficies planas de papel, sin sombras; jerarquía por filete, tono y tipografía.',
    radii: { card: 6, control: 6, chip: 999 },
    shadow: 'none',
    motion: { fast: 180, base: 280, slow: 420, ease: 'cubic-bezier(.2, 0, 0, 1)', note: 'Pausado y editorial: trazos que se dibujan, sellos que se asientan. Sin rebotes.' },
    signature: 'Folio del turno: ficha tipo boleto con fecha en serif grande y borde perforado.',
    palettes: {
      light: {
        bg: '#F6F1E8', bg2: '#EFE7DA', surface: '#FFFCF7', surface2: '#F1EADF',
        ink: '#1B2A28', muted: '#55615E', line: '#D8CDBB',
        accent: '#1E5C55', onAccent: '#FFFFFF', accentInk: '#1E5C55', accentSoft: '#E2ECE8',
        accent2: '#B08A3E', accent2Ink: '#76581A',
        success: '#2F6B3B', warn: '#875200', danger: '#A1392B', focus: '#9A6A0E',
      },
      dark: {
        bg: '#0E1615', bg2: '#121D1B', surface: '#16211F', surface2: '#1E2B29',
        ink: '#F2ECE1', muted: '#B9B2A5', line: '#33433F',
        accent: '#6BBFB1', onAccent: '#0A1513', accentInk: '#8FD3C6', accentSoft: '#1D3A35',
        accent2: '#D9B66C', accent2Ink: '#E4C88A',
        success: '#8CCB98', warn: '#E8B65C', danger: '#F09A8A', focus: '#E4C88A',
      },
    },
  },
  {
    id: 'b',
    letter: 'B',
    name: 'Soft glass sobrio',
    tagline: 'Bruma aqua y lila, paneles esmerilados y formas suaves: tecnología amable que baja la ansiedad.',
    fonts: { display: "'Plus Jakarta Sans', system-ui, sans-serif", text: "'Plus Jakarta Sans', system-ui, sans-serif", mono: "'Plus Jakarta Sans', system-ui, sans-serif" },
    fontNote: 'Plus Jakarta Sans 400–800 (una sola familia). OFL, empaquetada localmente.',
    why: [
      'Transmite cuidado y tranquilidad: útil para pacientes con miedo a la consulta.',
      'Las capas de vidrio separan bien lo flotante (próximo turno, acciones) del contenido.',
      'Se diferencia claramente de los sistemas de turnos genéricos.',
    ],
    risks: [
      'El vidrio exige rellenos opacos (≥ 66 %) para sostener el contraste AA; el desenfoque no alcanza solo.',
      'El desenfoque cuesta rendimiento en equipos modestos: se limita a 2–3 capas por pantalla.',
      'En el panel operativo el vidrio debe ceder ante la densidad: tablas sobre superficie casi opaca.',
    ],
    grid: '12 columnas, tarjetas flotantes con 24 px de separación; composición centrada en el portal.',
    density: 'Portal espacioso; panel con tarjetas redondeadas y filas de 48 px.',
    surfaces: 'Vidrio esmerilado (relleno blanco 74 % / azul noche 66 %, desenfoque 20 px, borde de luz) sobre fondo de bruma.',
    radii: { card: 24, control: 14, chip: 999 },
    shadow: '0 24px 60px -28px rgba(14, 34, 50, 0.35)',
    motion: { fast: 220, base: 380, slow: 560, ease: 'cubic-bezier(.22, 1, .36, 1)', note: 'Flotante y blando: entradas con desenfoque que se aclara, anillos que se completan.' },
    signature: 'Píldora de vidrio del próximo turno con anillo de cuenta regresiva.',
    palettes: {
      light: {
        bg: '#E6F2F4', bg2: '#EFEAF7', blobs: ['#BDE4E7', '#F6D9C8', '#DCD3F2'],
        surface: 'rgba(255, 255, 255, 0.74)', surface2: 'rgba(255, 255, 255, 0.55)',
        ink: '#0E2232', muted: '#3C5162', line: 'rgba(14, 34, 50, 0.14)',
        accent: '#09617D', onAccent: '#FFFFFF', accentInk: '#08607B', accentSoft: 'rgba(9, 97, 125, 0.10)',
        accent2: '#E07A5F', accent2Ink: '#9E3F27',
        success: '#1F6E4A', warn: '#875000', danger: '#AE3328', focus: '#09617D',
        glassEdge: 'rgba(255, 255, 255, 0.85)',
      },
      dark: {
        bg: '#0A1420', bg2: '#15172B', blobs: ['#0F3B52', '#3A2550', '#1B3A4A'],
        surface: 'rgba(28, 42, 58, 0.66)', surface2: 'rgba(255, 255, 255, 0.06)',
        ink: '#EAF2F8', muted: '#A8B9C8', line: 'rgba(255, 255, 255, 0.14)',
        accent: '#5BC6DE', onAccent: '#04202A', accentInk: '#7DD5EA', accentSoft: 'rgba(91, 198, 222, 0.16)',
        accent2: '#F2A488', accent2Ink: '#F5B7A0',
        success: '#7DD9A8', warn: '#F2C46B', danger: '#FF9D8F', focus: '#7DD5EA',
        glassEdge: 'rgba(255, 255, 255, 0.12)',
      },
    },
  },
  {
    id: 'c',
    letter: 'C',
    name: 'Minimalismo tecnológico humano',
    tagline: 'Neutros precisos, cobalto y menta, datos en monoespaciada: control operativo con calidez.',
    fonts: { display: "'IBM Plex Sans', system-ui, sans-serif", text: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace" },
    fontNote: 'IBM Plex Sans 400/500/600 + IBM Plex Mono 400/500 (horarios, IDs, cifras). OFL, empaquetadas localmente.',
    why: [
      'Pensada desde el panel: agenda densa, horarios e IDs alineados, lectura rápida para recepción y dirección.',
      'Los estados se distinguen por forma además de color (círculo, cuadrado, triángulo).',
      'Comunica orden y confiabilidad tecnológica sin la frialdad de un tablero genérico, gracias a la menta y las formas redondeadas.',
    ],
    risks: [
      'En el portal puede sentirse más “sistema” que “clínica”: necesita ilustración e imagen cálidas.',
      'La monoespaciada en exceso cansa: se limita a horarios, IDs y cifras.',
    ],
    grid: 'Grilla de 8 px, 12 columnas compactas; módulos con borde de 1 px y separación de 16 px.',
    density: 'Alta en el panel (filas de 36 px); media en el portal.',
    surfaces: 'Blanco sobre gris frío, bordes de 1 px, sombra mínima; en oscuro, grafito por capas.',
    radii: { card: 10, control: 8, chip: 6 },
    shadow: '0 1px 2px rgba(15, 22, 35, 0.06)',
    motion: { fast: 140, base: 200, slow: 320, ease: 'cubic-bezier(.4, 0, .2, 1)', note: 'Preciso y corto: líneas que se trazan, cifras que avanzan, sin adornos.' },
    signature: 'Riel de tiempo con horarios en monoespaciada y estados con forma.',
    palettes: {
      light: {
        bg: '#F5F6F8', bg2: '#EEF0F4', surface: '#FFFFFF', surface2: '#F0F2F6',
        ink: '#0F1623', muted: '#4A5363', line: '#DDE2E9',
        accent: '#2949D6', onAccent: '#FFFFFF', accentInk: '#2643C7', accentSoft: '#E9EDFE',
        accent2: '#0D8F72', accent2Ink: '#0B7A61',
        success: '#0B7A61', warn: '#8F5A00', danger: '#B42318', focus: '#2949D6',
      },
      dark: {
        bg: '#0C1016', bg2: '#10151D', surface: '#141A23', surface2: '#1A222D',
        ink: '#E7EBF1', muted: '#9CA7B6', line: '#283241',
        accent: '#7D93FF', onAccent: '#0A0F24', accentInk: '#A3B3FF', accentSoft: '#1E2850',
        accent2: '#4CD3AE', accent2Ink: '#6FDDBE',
        success: '#6FDDBE', warn: '#F0BE5C', danger: '#FF8A80', focus: '#A3B3FF',
      },
    },
  },
];

export const proposalById = (id: string | null | undefined) => PROPOSALS.find((p) => p.id === id) ?? PROPOSALS[0];

/** Variables CSS de una propuesta en un modo: las usa el marco de cada pantalla. */
export function cssVars(p: Proposal, mode: Mode): Record<string, string> {
  const c = p.palettes[mode];
  const v: Record<string, string> = {
    '--pp-bg': c.bg, '--pp-bg2': c.bg2, '--pp-surface': c.surface, '--pp-surface2': c.surface2,
    '--pp-ink': c.ink, '--pp-muted': c.muted, '--pp-line': c.line,
    '--pp-accent': c.accent, '--pp-on-accent': c.onAccent, '--pp-accent-ink': c.accentInk, '--pp-accent-soft': c.accentSoft,
    '--pp-accent2': c.accent2, '--pp-accent2-ink': c.accent2Ink,
    '--pp-success': c.success, '--pp-warn': c.warn, '--pp-danger': c.danger, '--pp-focus': c.focus,
    '--pp-display': p.fonts.display, '--pp-text': p.fonts.text, '--pp-mono': p.fonts.mono,
    '--pp-r-card': `${p.radii.card}px`, '--pp-r-control': `${p.radii.control}px`, '--pp-r-chip': `${p.radii.chip}px`,
    '--pp-shadow': p.shadow,
    '--pp-fast': `${p.motion.fast}ms`, '--pp-base': `${p.motion.base}ms`, '--pp-slow': `${p.motion.slow}ms`, '--pp-ease': p.motion.ease,
  };
  if (c.glassEdge) v['--pp-glass-edge'] = c.glassEdge;
  c.blobs?.forEach((b, i) => { v[`--pp-blob${i + 1}`] = b; });
  return v;
}
