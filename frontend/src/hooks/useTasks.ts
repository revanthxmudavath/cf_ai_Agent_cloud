import { useEffect, useCallback } from "react";
  import { useAppStore } from "../stores/appStore";
  import { useAuth } from "@clerk/clerk-react";

  export function useTasks(userId: string | null) {
      const { getToken } = useAuth();
      const setTasks = useAppStore((state) => state.setTasks);

      const fetchTasks = useCallback(async () => {
          if (!userId) return;

          try {
              const token = await getToken();
              if (!token) return;

              // Use new protected API route with auth token
              const response = await fetch('/api/tasks', {
                  headers: {
                      'Authorization': `Bearer ${token}`,
                  },
              });

              if (!response.ok) {
                  throw new Error('Failed to fetch tasks.');
              }

              const data = await response.json();
              console.log('[useTasks] Fetched tasks:', data.tasks?.length || 0);

              setTasks(data.tasks || []);

          } catch (error) {
              console.error('[useTasks] Error fetching tasks:', error);
          }
      }, [userId, setTasks, getToken]);

      useEffect(() => {
          fetchTasks();
      }, [fetchTasks]);

      return { fetchTasks };
  }