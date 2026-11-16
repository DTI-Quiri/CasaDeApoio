import { useCallback, useEffect, useState } from 'react';
import { listGuests, getSettings, listAllAudit, listAuditBetween } from '../services/guests';
import type { AuditEntry, Guest, Settings } from '../types';
import { reportSyncError, reportSyncOk, subscribeToDataChanges } from '../utils/sync';
import { toast } from 'sonner';

interface Options {
  /** Também carrega o log de auditoria (usado no Painel). */
  withAudit?: boolean;
  auditLimit?: number;
  /** Quando informado, busca apenas movimentações dos últimos N dias (mais leve). */
  auditDays?: number;
}

/**
 * Carregamento centralizado de hóspedes com sincronização em tempo real:
 * - BroadcastChannel entre abas
 * - polling a cada 30s quando a aba está visível
 * - recarga ao voltar o foco para a aba
 * - notificação global de status de conexão
 */
export function useGuests({ withAudit = false, auditLimit = 300, auditDays }: Options = {}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [settings, setSettings] = useState<Settings>({ alertDays: 7 });
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const auditPromise = !withAudit
          ? Promise.resolve<AuditEntry[]>([])
          : auditDays && auditDays > 0
            ? (() => {
                const start = new Date();
                start.setDate(start.getDate() - auditDays);
                start.setHours(0, 0, 0, 0);
                return listAuditBetween(start.toISOString(), new Date().toISOString());
              })()
            : listAllAudit(auditLimit);

        const [list, s, logs] = await Promise.all([listGuests(), getSettings(), auditPromise]);
        setGuests(list);
        setSettings(s);
        if (withAudit) setAuditLogs(logs);
        reportSyncOk();
      } catch {
        reportSyncError();
        if (isInitial) toast.error('Erro ao carregar dados dos hóspedes.');
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [withAudit, auditLimit, auditDays]
  );

  useEffect(() => {
    refresh(true);
    const unsubscribe = subscribeToDataChanges(() => refresh(false));
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh(false);
    }, 30000);
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  return { guests, setGuests, settings, auditLogs, loading, refresh };
}
