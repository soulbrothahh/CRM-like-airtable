"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createSequence as apiCreate,
  deleteSequence as apiDelete,
  listSequences,
  updateSequence as apiUpdate,
} from "@/lib/sequences";
import type { NewSequence, Sequence } from "@/lib/types";

interface SequencesContextValue {
  sequences: Sequence[];
  loading: boolean;
  reload: () => Promise<void>;
  create: (input: NewSequence) => Promise<Sequence>;
  update: (id: string, patch: Partial<Sequence>) => Promise<Sequence>;
  remove: (id: string) => Promise<void>;
}

const SequencesContext = createContext<SequencesContextValue | null>(null);

export function SequencesProvider({ children }: { children: React.ReactNode }) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSequences(await listSequences());
    } catch (e) {
      console.error("Failed to load sequences", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: NewSequence) => {
    const s = await apiCreate(input);
    setSequences((prev) => [...prev, s]);
    return s;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Sequence>) => {
    const updated = await apiUpdate(id, patch);
    setSequences((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setSequences((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo(
    () => ({ sequences, loading, reload, create, update, remove }),
    [sequences, loading, reload, create, update, remove]
  );

  return (
    <SequencesContext.Provider value={value}>{children}</SequencesContext.Provider>
  );
}

export function useSequences(): SequencesContextValue {
  const ctx = useContext(SequencesContext);
  if (!ctx) throw new Error("useSequences must be used within SequencesProvider");
  return ctx;
}
