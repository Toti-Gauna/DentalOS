// Asistente de dirección determinista (lote 6 · R-GRW-05): reglas sobre el store, sin LLM ni respuestas precargadas.
// Explica cada cálculo, pide los datos que faltan y, como mucho, crea un borrador: nunca activa una campaña.
import { CHANNEL_LABEL, buildAudience, campaignEconomics, capacityFor, contactFor, segmentMembers } from './campaigns';
import { normalize } from './chat';
import { fmtShort } from './time';
import type { DemoState } from './types';

export type DirectorIntent = 'controles' | 'capacidad' | 'faltantes' | 'costo' | 'ayuda';
export const DIRECTOR_QUESTIONS: { intent: DirectorIntent; label: string }[] = [
  { intent: 'controles', label: 'Controles indicados pendientes' },
  { intent: 'capacidad', label: 'Capacidad disponible' },
  { intent: 'faltantes', label: '¿Qué datos faltan?' },
  { intent: 'costo', label: 'Costo de la campaña' },
];

export function detectDirectorIntent(raw: string): DirectorIntent {
  const t = normalize(raw);
  if (/\b(control\w*|indicad\w*|seguimiento\w*)\b/.test(t)) return 'controles';
  if (/\b(capacidad|cupo\w*|lugar\w*|agenda|disponib\w*|turnos libres)\b/.test(t)) return 'capacidad';
  if (/\b(falta\w*|nd|faltante\w*|complet\w*|datos)\b/.test(t)) return 'faltantes';
  if (/\b(cost\w*|cuest\w*|cuanto sale|presupuesto de la campana|gasto\w*|equilibrio|contribucion|margen)\b/.test(t)) return 'costo';
  return 'ayuda';
}

export interface DirectorAnswer { intent: DirectorIntent; title: string; paragraphs: string[]; missing: string[]; action: 'crear_borrador_controles' | null }

const pesos = (minor: number) => `$ ${(minor / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const nameOf = (d: DemoState, id: string) => { const p = d.persons.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName} (${p.id})` : id; };

export function directorAnswer(d: DemoState, intent: DirectorIntent, campaignId: string | null): DirectorAnswer {
  const cmp = campaignId ? d.campaigns.find((c) => c.id === campaignId) ?? null : null;
  switch (intent) {
    case 'controles': {
      const members = segmentMembers(d, 'controles_pendientes');
      if (!members.length) return { intent, title: 'No hay controles indicados pendientes', paragraphs: ['Cuento solo los controles que una profesional ya indicó en un seguimiento y que todavía no tienen turno. Hoy no hay ninguno.'], missing: [], action: null };
      const lines = members.map((m) => {
        const contact = m.personId ? contactFor(d, m.personId) : null;
        return `${m.personId ? nameOf(d, m.personId) : 'Sin identificar'}: ${m.reason}${contact && contact !== m.personId ? `. Se coordina con ${nameOf(d, contact)}, su responsable` : ''}.`;
      });
      return { intent, title: `${members.length} control(es) indicado(s) sin turno`, paragraphs: [
        'Salen de los seguimientos activos: cuento cada control en estado “indicado” que no tiene turno. No calculo frecuencias ni decido si corresponde un control: eso lo indica la profesional.',
        ...lines,
        'Puedo dejar un borrador de campaña para coordinarlos. Queda en borrador: hace falta vista previa, datos económicos y la aprobación de dirección.',
      ], missing: [], action: 'crear_borrador_controles' };
    }
    case 'capacidad': {
      const services = d.serviceTypes.filter((s) => s.selfService || s.id === cmp?.serviceTypeId);
      const days = d.campaignConfig.capacityDays;
      const rows = services.map((s) => { const c = capacityFor(d, s.id, days); return { name: s.name, slots: c.slots }; });
      return { intent, title: `Turnos libres en los próximos ${days} días`, paragraphs: [
        `Recorro la agenda desde ${fmtShort(d.clock)} con las mismas reglas que la reserva (jornada, bloqueos, sillón y profesional) y cuento turnos que no se superponen por profesional.`,
        ...rows.map((r) => `${r.name}: ${r.slots} turno(s) libre(s).`),
        'Es la oferta de la agenda, no una predicción de demanda.',
      ], missing: [], action: null };
    }
    case 'faltantes': {
      if (!cmp) return { intent, title: 'Elegí una campaña', paragraphs: ['Para decir qué datos faltan necesito saber de qué campaña hablamos. Elegila arriba y volvé a preguntar.'], missing: [], action: null };
      const eco = campaignEconomics(d, cmp, buildAudience(d, cmp));
      const shape: string[] = [];
      if (cmp.kind === 'individual' && !cmp.personId) shape.push('Persona de la campaña individual');
      if (cmp.kind === 'segmentada' && !cmp.segmentIds.length) shape.push('Al menos un segmento');
      if (cmp.trigger === 'programada' && !cmp.scheduledFor) shape.push('Fecha programada');
      const missing = [...shape, ...eco.missing];
      return missing.length
        ? { intent, title: `${cmp.id}: faltan ${missing.length} dato(s)`, paragraphs: ['Mientras falten, los resultados se muestran como ND y la campaña sigue en borrador. Cargalos en el formulario de la campaña:'], missing, action: null }
        : { intent, title: `${cmp.id}: no falta ningún dato`, paragraphs: ['Todos los datos necesarios están cargados. Igual hace falta revisar la vista previa y aprobar.'], missing: [], action: null };
    }
    case 'costo': {
      if (!cmp) return { intent, title: 'Elegí una campaña', paragraphs: ['El costo depende de la audiencia y de los canales de cada persona. Elegí una campaña arriba.'], missing: [], action: null };
      const aud = buildAudience(d, cmp);
      const eco = campaignEconomics(d, cmp, aud);
      const p: string[] = [`Audiencia elegible: ${aud.eligible.length} contacto(s) (${aud.excluded.length} excluido(s), ${aud.merged} unificado(s) por duplicado).`];
      for (const ch of eco.commByChannel) p.push(`${cap(CHANNEL_LABEL[ch.channel])}: ${ch.count} × ${ch.unitMinor == null ? 'ND' : pesos(ch.unitMinor)}${ch.unitMinor == null ? '' : ` = ${pesos(ch.count * ch.unitMinor)}`}.`);
      p.push(`Comunicación: ${eco.commCostMinor == null ? 'ND' : pesos(eco.commCostMinor)}. Costo fijo: ${cmp.economics.fixedCostMinor == null ? 'ND' : pesos(cmp.economics.fixedCostMinor)}. Costo de la campaña: ${eco.campaignCostMinor == null ? 'ND' : pesos(eco.campaignCostMinor)}.`);
      if (eco.perAttention) {
        if (eco.unit) {
          p.push(`Por atención: ingreso neto ${pesos(eco.unit.netRevenue)} − costo de servicio − otros variables = contribución ${pesos(eco.unit.contribution)}${eco.unit.contributionPct == null ? '' : ` (${(eco.unit.contributionPct * 100).toFixed(1).replace('.', ',')} % del ingreso neto, no es ganancia neta)`}.`);
          p.push(eco.noBreakeven ? 'Con contribución cero o negativa no hay equilibrio por volumen.' : eco.breakevenAttentions == null ? 'Equilibrio: ND hasta tener el costo de la campaña.' : `Equilibrio: ${eco.breakevenAttentions} atención(es) para cubrir el costo de la campaña (redondeo hacia arriba).`);
        } else p.push('Contribución por atención: ND hasta cargar precio, costo de servicio y otros variables.');
      } else p.push('Es una campaña informativa: no tiene ingreso por atención, solo costo.');
      return { intent, title: `Costo de ${cmp.id}`, paragraphs: p, missing: eco.missing, action: null };
    }
    default:
      return { intent: 'ayuda', title: 'Puedo responder con los datos de la demo', paragraphs: ['Preguntame por controles indicados pendientes, capacidad disponible, qué datos faltan o el costo de una campaña. No invento cifras: todo sale del estado local, y si falta algo lo marco como ND.'], missing: [], action: null };
  }
}
