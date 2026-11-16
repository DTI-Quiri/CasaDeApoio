type SyncEventType = 'GUEST_UPDATED' | 'SETTINGS_UPDATED' | 'AUDIT_UPDATED';

let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('casadeapoio_realtime_sync');
  }
} catch {
  syncChannel = null;
}

export interface SyncStatusState {
  online: boolean;
  hasError: boolean;
  lastSyncedAt: number | null;
}

let syncState: SyncStatusState = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  hasError: false,
  lastSyncedAt: null,
};

const syncListeners = new Set<(state: SyncStatusState) => void>();

function emitSyncState() {
  for (const fn of syncListeners) fn(syncState);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncState = { ...syncState, online: true };
    emitSyncState();
  });
  window.addEventListener('offline', () => {
    syncState = { ...syncState, online: false };
    emitSyncState();
  });
}

export function reportSyncOk() {
  syncState = { online: true, hasError: false, lastSyncedAt: Date.now() };
  emitSyncState();
}

export function reportSyncError() {
  syncState = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasError: true,
    lastSyncedAt: syncState.lastSyncedAt,
  };
  emitSyncState();
}

export function getSyncStatus(): SyncStatusState {
  return syncState;
}

export function subscribeSyncStatus(listener: (state: SyncStatusState) => void): () => void {
  syncListeners.add(listener);
  listener(syncState);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Notifica outras abas/janelas abertas instantaneamente sobre alterações nos dados.
 */
export function broadcastDataChange(type: SyncEventType = 'GUEST_UPDATED') {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, at: Date.now() });
    } catch {
      // ignore broadcast errors
    }
  }
}

/**
 * Inscreve um componente para recarregar ao receber alterações de outras abas.
 */
export function subscribeToDataChanges(callback: () => void): () => void {
  if (!syncChannel) return () => {};

  const handler = () => {
    callback();
  };

  syncChannel.addEventListener('message', handler);
  return () => {
    syncChannel?.removeEventListener('message', handler);
  };
}
