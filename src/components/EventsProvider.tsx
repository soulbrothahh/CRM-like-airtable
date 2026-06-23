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
  createEvent as apiCreate,
  deleteEvent as apiDelete,
  listEvents,
  updateEvent as apiUpdate,
} from "@/lib/events";
import type { CrmEvent, NewEvent } from "@/lib/types";

interface EventsContextValue {
  events: CrmEvent[];
  loading: boolean;
  reload: () => Promise<void>;
  create: (input: NewEvent) => Promise<CrmEvent>;
  update: (id: string, patch: Partial<CrmEvent>) => Promise<CrmEvent>;
  remove: (id: string) => Promise<void>;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await listEvents());
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: NewEvent) => {
    const e = await apiCreate(input);
    setEvents((prev) => [e, ...prev]);
    return e;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<CrmEvent>) => {
    const updated = await apiUpdate(id, patch);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(
    () => ({ events, loading, reload, create, update, remove }),
    [events, loading, reload, create, update, remove]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useEvents must be used within EventsProvider");
  return ctx;
}
