import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  confirmArrival,
  undoCheckin,
  markNoShow,
  startNewStay,
  changeStatus,
  undoCheckout,
  batchCheckin,
  batchUndoCheckin,
  batchCheckout,
  batchUndoCheckout,
} from '../services/guests';
import type { Guest } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatPersonName } from '../utils/cpf';
import { toast } from 'sonner';

const UNDO_MS = 8000;

/**
 * Todas as ações operacionais (Entrada, Saída, Não veio e lotes)
 * em um único lugar, sempre com opção de "Desfazer".
 */
export function useGuestActions(setGuests: Dispatch<SetStateAction<Guest[]>>) {
  const { user } = useAuth();

  const merge = useCallback(
    (updated: Guest[]) => {
      const map = new Map(updated.map(u => [u.id, u]));
      setGuests(prev => prev.map(x => map.get(x.id) || x));
    },
    [setGuests]
  );

  const checkin = useCallback(
    async (g: Guest) => {
      if (!user) return;
      try {
        const next = await confirmArrival(g, user.username);
        merge([next]);
        toast.success(`Entrada de ${formatPersonName(g.name)} registrada.`, {
          duration: UNDO_MS,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                merge([await undoCheckin(next, user.username)]);
                toast.success('Entrada desfeita.');
              } catch {
                toast.error('Erro ao desfazer entrada.');
              }
            },
          },
        });
      } catch {
        toast.error('Erro ao registrar entrada.');
      }
    },
    [user, merge]
  );

  const noShow = useCallback(
    async (g: Guest) => {
      if (!user) return;
      try {
        const next = await markNoShow(g, user.username);
        merge([next]);
        toast.info(`${formatPersonName(g.name)} marcado como "Não veio".`, {
          duration: UNDO_MS,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                merge([await startNewStay(next, user.username)]);
                toast.success('Ausência desfeita.');
              } catch {
                toast.error('Erro ao desfazer ausência.');
              }
            },
          },
        });
      } catch {
        toast.error('Erro ao registrar ausência.');
      }
    },
    [user, merge]
  );

  const checkout = useCallback(
    async (g: Guest) => {
      if (!user) return;
      try {
        const next = await changeStatus(g, 'finalizado', user.username);
        merge([next]);
        toast.success(`Saída de ${formatPersonName(g.name)} registrada.`, {
          duration: UNDO_MS,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                merge([await undoCheckout(next, user.username)]);
                toast.success('Saída desfeita.');
              } catch {
                toast.error('Erro ao desfazer saída.');
              }
            },
          },
        });
      } catch {
        toast.error('Erro ao registrar saída.');
        throw new Error('checkout failed');
      }
    },
    [user, merge]
  );

  const checkinMany = useCallback(
    async (list: Guest[]) => {
      if (!user || list.length === 0) return;
      try {
        const updated = await batchCheckin(list, user.username);
        merge(updated);
        toast.success(`Entrada registrada para ${updated.length} hóspede(s).`, {
          duration: UNDO_MS,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                merge(await batchUndoCheckin(updated, user.username));
                toast.success('Entradas desfeitas.');
              } catch {
                toast.error('Erro ao desfazer entradas.');
              }
            },
          },
        });
      } catch {
        toast.error('Erro ao registrar entrada em lote.');
        throw new Error('batch checkin failed');
      }
    },
    [user, merge]
  );

  const checkoutMany = useCallback(
    async (list: Guest[]) => {
      if (!user || list.length === 0) return;
      try {
        const updated = await batchCheckout(list, user.username);
        merge(updated);
        toast.success(`Saída registrada para ${updated.length} hóspede(s).`, {
          duration: UNDO_MS,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              try {
                merge(await batchUndoCheckout(updated, user.username));
                toast.success('Saídas desfeitas.');
              } catch {
                toast.error('Erro ao desfazer saídas.');
              }
            },
          },
        });
      } catch {
        toast.error('Erro ao registrar saída em lote.');
        throw new Error('batch checkout failed');
      }
    },
    [user, merge]
  );

  return { checkin, noShow, checkout, checkinMany, checkoutMany };
}
