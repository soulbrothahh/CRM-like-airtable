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
  createTask as apiCreate,
  deleteTask as apiDelete,
  listTasks as apiList,
  updateTask as apiUpdate,
} from "@/lib/tasks";
import type { NewTask, Task } from "@/lib/types";

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  reload: () => Promise<void>;
  create: (input: NewTask) => Promise<Task>;
  update: (id: string, patch: Partial<Task>) => Promise<Task>;
  remove: (id: string) => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setTasks(await apiList());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: NewTask) => {
    const task = await apiCreate(input);
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Task>) => {
    const updated = await apiUpdate(id, patch);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ tasks, loading, reload, create, update, remove }),
    [tasks, loading, reload, create, update, remove]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
