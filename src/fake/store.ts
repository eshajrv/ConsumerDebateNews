const listeners = new Set<() => void>();
let version = 0;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getVersion = () => version;

export function changed() {
  version++;
  listeners.forEach((listener) => listener());
}

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
