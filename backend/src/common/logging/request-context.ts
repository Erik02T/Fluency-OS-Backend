import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextStore {
  requestId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  requestId: string,
  callback: () => T,
): T {
  return requestContextStorage.run({ requestId }, callback);
}

export function getRequestId(): string | null {
  return requestContextStorage.getStore()?.requestId ?? null;
}
