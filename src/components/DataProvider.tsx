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
  createContact as apiCreate,
  deleteContact as apiDelete,
  listContacts,
  storageMode,
  updateContact as apiUpdate,
} from "@/lib/data";
import type { Contact, NewContact } from "@/lib/types";

interface DataContextValue {
  contacts: Contact[];
  loading: boolean;
  storageMode: "cloud" | "local";
  reload: () => Promise<void>;
  create: (input: NewContact) => Promise<Contact>;
  update: (id: string, patch: Partial<Contact>) => Promise<Contact>;
  remove: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listContacts();
      setContacts(data);
    } catch (e) {
      console.error("Failed to load contacts", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: NewContact) => {
    const c = await apiCreate(input);
    setContacts((prev) => [c, ...prev]);
    return c;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Contact>) => {
    const updated = await apiUpdate(id, patch);
    setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(
    () => ({ contacts, loading, storageMode, reload, create, update, remove }),
    [contacts, loading, reload, create, update, remove]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
