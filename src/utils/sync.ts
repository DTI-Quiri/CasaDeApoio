type SyncEventType = 'GUEST_UPDATED' | 'SETTINGS_UPDATED' | 'AUDIT_UPDATED';

let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('casadeapoio_realtime_sync');
  }
} catch {
  syncChannel = null;
}

/**
 * Notifies all open tabs and windows instantly of any data changes
 */
export function broadcastDataChange(type: SyncEventType = 'GUEST_UPDATED') {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, at: Date.now() });
    } catch {}
  }
}

/**
 * Subscribes a component to real-time data change notifications
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
