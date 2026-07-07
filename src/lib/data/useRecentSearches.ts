/**
 * useRecentSearches — locally-persisted recent search terms (KB-21).
 * Stored in AsyncStorage (no BE); newest-first, de-duped (case-insensitive),
 * capped at MAX. Real search history is out of scope until KB-71.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kbap.recentSearches.v1';
const MAX = 8;

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setRecent(arr.filter((x) => typeof x === 'string').slice(0, MAX));
        } catch {
          /* ignore corrupt store */
        }
      })
      .catch(() => {});
  }, []);

  const save = useCallback((next: string[]) => {
    setRecent(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const add = useCallback((termRaw: string) => {
    const term = termRaw.trim();
    if (!term) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== term);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clear = useCallback(() => save([]), [save]);

  return { recent, add, remove, clear };
}
