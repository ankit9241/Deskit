import { isTauri } from './tauriApi';

export type EventHandler<T> = (payload: T) => void;
export type UnlistenFn = () => void;

export async function onEvent<T>(eventName: string, handler: EventHandler<T>): Promise<UnlistenFn> {
  // Always register a local CustomEvent listener
  const localListener = (e: Event) => {
    const customEvent = e as CustomEvent<T>;
    handler(customEvent.detail);
  };
  window.addEventListener(eventName, localListener);

  let bcListener: ((e: MessageEvent) => void) | null = null;
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('pinned_events');
      bcListener = (e: MessageEvent) => {
        if (e.data && e.data.event === eventName) {
          handler(e.data.payload);
        }
      };
      channel.addEventListener('message', bcListener);
    } catch {}
  }

  let nativeUnlisten: (() => void) | null = null;
  if (isTauri()) {
    try {
      const globalTauri = (window as any).__TAURI__;
      const internals = (window as any).__TAURI_INTERNALS__;
      if (globalTauri?.event && typeof globalTauri.event.listen === 'function') {
        nativeUnlisten = await globalTauri.event.listen(eventName, (event: any) => {
          handler(event.payload);
        });
      } else if (internals && typeof internals.invoke === 'function') {
        const { listen } = await import('@tauri-apps/api/event');
        nativeUnlisten = await listen<T>(eventName, (event) => {
          handler(event.payload);
        });
      }
    } catch (err) {
      console.warn(`[onEvent] Tauri native listen failed for ${eventName}:`, err);
    }
  }

  return () => {
    window.removeEventListener(eventName, localListener);
    if (channel && bcListener) {
      channel.removeEventListener('message', bcListener);
      channel.close();
    }
    if (nativeUnlisten) {
      nativeUnlisten();
    }
  };
}

export function emitLocalEvent<T>(eventName: string, payload: T): void {
  // Dispatch locally
  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  // Broadcast to other tabs / popup widget windows
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('pinned_events');
      channel.postMessage({ event: eventName, payload });
      channel.close();
    } catch {}
  }
}
