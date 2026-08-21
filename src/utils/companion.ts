import type { Companion } from '../types';

/**
 * Converte qualquer representação de acompanhantes (JSON, array de objetos, array de strings ou texto legado)
 * para uma lista estruturada de Companion: { name: string; cpf?: string }
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
        .map(name => ({ name, cpf: '' }));
    }
  }

  if (Array.isArray(parsed)) {
    const list = parsed.map(item => {
      if (typeof item === 'string') {
        const match = item.match(/^(.*?)(?:\s*\((?:CPF:?\s*)?([0-9.\-]+)\))?$/i);
        if (match && match[2]) {
          return { name: match[1].trim(), cpf: match[2].trim() };
        }
        return { name: item.trim(), cpf: '' };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          name: String(obj.name ?? ''),
          cpf: obj.cpf ? String(obj.cpf).trim() : '',
        };
      }
      return { name: String(item ?? ''), cpf: '' };
    });

    return filterEmpty
      ? list.filter(c => c.name.trim().length > 0 || (c.cpf && c.cpf.trim().length > 0))
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
  if (c.cpf && c.cpf.trim()) {
    return `${c.name.trim()} (${c.cpf.trim()})`;
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
