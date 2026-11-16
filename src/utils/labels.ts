import type { AuditEntry, Guest, Status } from '../types';
import { parseCompanions } from './companion.ts';

/**
 * Glossário único do sistema. Toda a interface deve usar estes termos
 * para status e ações, evitando sinônimos ("Presente", "Para Chegar" etc.).
 */
export const STATUS_LABEL: Record<Status, string> = {
  agendado: 'Aguardando',
  presente: 'Na casa',
  finalizado: 'Finalizado',
};

export const ACTION_LABEL = {
  checkin: 'Registrar entrada',
  checkout: 'Registrar saída',
  noShow: 'Não veio',
} as const;

export function companionCount(g: Pick<Guest, 'hasCompanion' | 'companions'>): number {
  if (!g.hasCompanion) return 0;
  const comps = parseCompanions(g.companions);
  return comps.length > 0 ? comps.length : 1;
}

export function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isSameLocalDay(iso: string | undefined, dayYmd: string): boolean {
  if (!iso) return false;
  return ymd(new Date(iso)) === dayYmd;
}

export function daysSince(iso?: string): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Compara horários (incluindo formato curto "8:20" e "14:00") em ordem cronológica.
 */
export function compareTimeStr(a?: string, b?: string): number {
  const norm = (t?: string) => {
    const clean = (t || '').trim();
    if (!clean) return '99:99';
    const m = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return clean.padStart(5, '0');
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  };
  return norm(a).localeCompare(norm(b));
}

export type AuditEventKind =
  | 'checkin'
  | 'checkout'
  | 'noshow'
  | 'undo_checkin'
  | 'undo_checkout'
  | 'referral'
  | 'edit'
  | 'other';

export interface AuditEventMeta {
  kind: AuditEventKind;
  label: string;
  toneText: string;
  toneBadge: string;
}

/**
 * Classificação única para registros de auditoria.
 * Verifica edições de campo ("Alterou ...") antes de analisar toStatus,
 * evitando rotular edições cadastrais como check-in/check-out/encaminhamento.
 */
export function classifyAuditEvent(log: AuditEntry): AuditEventMeta {
  const note = (log.note || '').trim().toLowerCase();
  if (note.startsWith('alterou')) {
    return {
      kind: 'edit',
      label: 'Edição cadastral',
      toneText: 'text-indigo-700 dark:text-indigo-400',
      toneBadge: 'badge-gray',
    };
  }

  const { fromStatus: f, toStatus: t } = log;
  if (f === 'agendado' && t === 'presente') {
    return {
      kind: 'checkin',
      label: 'Entrada',
      toneText: 'text-emerald-700 dark:text-emerald-400',
      toneBadge: 'badge-green',
    };
  }
  if (f === 'presente' && t === 'finalizado') {
    return {
      kind: 'checkout',
      label: 'Saída',
      toneText: 'text-amber-700 dark:text-amber-400',
      toneBadge: 'badge-yellow',
    };
  }
  if (f === 'agendado' && t === 'finalizado') {
    return {
      kind: 'noshow',
      label: 'Não veio',
      toneText: 'text-rose-700 dark:text-rose-400',
      toneBadge: 'badge-red',
    };
  }
  if (f === 'presente' && t === 'agendado') {
    return {
      kind: 'undo_checkin',
      label: 'Entrada desfeita',
      toneText: 'text-slate-500',
      toneBadge: 'badge-gray',
    };
  }
  if (f === 'finalizado' && t === 'presente') {
    return {
      kind: 'undo_checkout',
      label: 'Saída desfeita',
      toneText: 'text-slate-500',
      toneBadge: 'badge-gray',
    };
  }
  if (
    note.includes('encaminhamento') ||
    note.includes('encaminhado') ||
    note.includes('cadastro') ||
    note.includes('nova estadia') ||
    (t === 'agendado' && !f)
  ) {
    return {
      kind: 'referral',
      label: 'Encaminhado',
      toneText: 'text-blue-700 dark:text-blue-400',
      toneBadge: 'badge-blue',
    };
  }
  return {
    kind: 'other',
    label: 'Atualização',
    toneText: 'text-slate-500',
    toneBadge: 'badge-gray',
  };
}
