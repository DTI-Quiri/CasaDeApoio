import type { Companion } from '../types';

export const COMPANION_RELATIONSHIPS = [
  'Mãe',
  'Pai',
  'Filho(a)',
  'Irmão(ã)',
  'Cônjuge / Companheiro(a)',
  'Avô / Avó',
  'Neto(a)',
  'Tio(a)',
  'Sobrinho(a)',
  'Amigo(a) / Cuidador(a)',
  'Outro',
] as const;

/**
 * Converte qualquer representação de acompanhantes (JSON, array de objetos, array de strings ou texto legado)
 * para uma lista estruturada de Companion: { name, phone?, relationship?, cpf? }
 */
export function parseCompanions(raw: unknown, filterEmpty = false): Companion[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => ({ name, phone: '', relationship: '' }));
    }
  }

  if (Array.isArray(parsed)) {
    const list = parsed.map((item): Companion => {
      if (typeof item === 'string') {
        const match = item.match(/^(.*?)(?:\s*\((?:CPF:?\s*)?([0-9.-]+)\))?$/i);
        if (match && match[2]) {
          return { name: match[1].trim(), phone: '', relationship: '', cpf: match[2].trim() };
        }
        return { name: item.trim(), phone: '', relationship: '' };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          name: String(obj.name ?? ''),
          phone: obj.phone ? String(obj.phone).trim() : '',
          relationship: obj.relationship ? String(obj.relationship).trim() : '',
          ...(obj.cpf ? { cpf: String(obj.cpf).trim() } : {}),
        };
      }
      return { name: String(item ?? ''), phone: '', relationship: '' };
    });

    return filterEmpty
      ? list.filter(
          c =>
            c.name.trim().length > 0 ||
            Boolean(c.phone && c.phone.trim().length > 0) ||
            Boolean(c.relationship && c.relationship.trim().length > 0) ||
            Boolean(c.cpf && c.cpf.trim().length > 0)
        )
      : list;
  }

  return [];
}

/**
 * Formata um acompanhante para exibição textual
 */
export function formatCompanion(c: Companion | string): string {
  if (!c) return '';
  if (typeof c === 'string') return c;
  const parts = [
    c.relationship?.trim(),
    c.phone?.trim() || (c.cpf?.trim() ? c.cpf.trim() : ''),
  ].filter(Boolean);
  if (parts.length > 0) {
    return `${c.name.trim()} (${parts.join(' • ')})`;
  }
  return c.name.trim();
}

/**
 * Formata a lista completa de acompanhantes para exibição textual
 */
export function formatCompanionsList(companions?: (Companion | string)[]): string {
  if (!companions || companions.length === 0) return '';
  return parseCompanions(companions, true).map(formatCompanion).filter(Boolean).join(', ');
}
