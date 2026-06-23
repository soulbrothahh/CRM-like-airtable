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
  createDeal as apiCreate,
  deleteDeal as apiDelete,
  listDeals,
  updateDeal as apiUpdate,
} from "@/lib/deals";
import type { Deal, NewDeal } from "@/lib/types";

interface DealsContextValue {
  deals: Deal[];
  loading: boolean;
  reload: () => Promise<void>;
  create: (input: NewDeal) => Promise<Deal>;
  update: (id: string, patch: Partial<Deal>) => Promise<Deal>;
  remove: (id: string) => Promise<void>;
}

const DealsContext = createContext<DealsContextValue | null>(null);

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDeals(await listDeals());
    } catch (e) {
      console.error("Failed to load deals", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: NewDeal) => {
    const d = await apiCreate(input);
    setDeals((prev) => [d, ...prev]);
    return d;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Deal>) => {
    const updated = await apiUpdate(id, patch);
    setDeals((prev) => prev.map((d) => (d.id === id ? updated : d)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const value = useMemo(
    () => ({ deals, loading, reload, create, update, remove }),
    [deals, loading, reload, create, update, remove]
  );

  return <DealsContext.Provider value={value}>{children}</DealsContext.Provider>;
}

export function useDeals(): DealsContextValue {
  const ctx = useContext(DealsContext);
  if (!ctx) throw new Error("useDeals must be used within DealsProvider");
  return ctx;
}
