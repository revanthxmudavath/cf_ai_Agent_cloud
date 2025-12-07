import { useEffect, useCallback } from "react";
import { useAppStore } from "../stores/appStore";

export function useTasks(userId: string | null) {
    const setTasks = useAppStore((state) => state.setTasks);

    const fetchTasks = useCallback(async () => {
        if (!userId) return;

        try {
            const response = await fetch(`/api/user/${userId}/tasks`);
            if(!response.ok) {
                throw new Error('Failed to fetch tasks.');
            }

            const data = await response.json();
            console.log('[useTasks] Fetched tasks:', data.tasks.length);

            setTasks(data.tasks || []);

        } catch (error) {
            console.error('[useTasks] Error fetching tasks:', error);
        }
    }, [userId, setTasks]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    return { fetchTasks };
}