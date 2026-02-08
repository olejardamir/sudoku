import { useEffect, useState } from "react";

export function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored as T;
  });

  useEffect(() => {
    localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue] as const;
}
