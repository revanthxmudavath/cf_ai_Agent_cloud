import { create } from 'zustand';
import type {
    Message,
    Task,
    PendingConfirmation,
    TaskFilter,
    UserProfile
} from '../types/index';

interface AppState {
    userId: string | null;
    userProfile: UserProfile | null;
    setUserId: (userId: string | null) => void;
    setUserProfile: (profile: UserProfile | null) => void;


    messages: Message[];
    addMessage: (message: Message) => void;
    clearMessages: () => void;
    setMessages: (messages: Message[]) => void;


    tasks: Task[];
    taskFilter: TaskFilter;
    addTask: (task: Task) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => void;
    removeTask: (taskId: string) => void;
    setTasks: (tasks: Task[]) => void;
    setTaskFilter: (filter: TaskFilter) => void;


    getFilteredTasks: () => Task[];

    pendingConfirmation: PendingConfirmation | null;
    setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
    clearPendingConfirmation: () => void;

    isTyping: boolean;
    setIsTyping: (typing: boolean) => void;

    error: string | null;
    setError: (error: string | null) => void;

    isSidebarOpen: boolean;
    toggleSidebar: () => void;
}

// zustand store 

export const useAppStore = create<AppState>(( set, get) => ({

    userId: null,
    userProfile: null,

    setUserId: (userId) => set({ userId }),

    setUserProfile: (userProfile) => set({ userProfile }),

    messages: [],

    addMessage: (message) => set((state) => ({
      messages: [...state.messages, message],
    })),

    clearMessages: () => set({ messages: [] }),

    setMessages: (messages) => set({ messages }),

    tasks: [],
    taskFilter: 'all',

    addTask: (task) => set((state) => ({
      tasks: [...state.tasks, task],
    })),

    updateTask: (taskId, updates) => set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    })),

    removeTask: (taskId) => set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
    })),

    setTasks: (tasks) => set({ tasks }),

    setTaskFilter: (taskFilter) => set({ taskFilter }),

    // Computed getter for filtered tasks
    getFilteredTasks: () => {
      const { tasks, taskFilter } = get();

      switch (taskFilter) {
        case 'pending':
          return tasks.filter((task) => !task.completed);
        case 'completed':
          return tasks.filter((task) => task.completed);
        case 'all':
        default:
          return tasks;
      }
    },

    
    pendingConfirmation: null,

    setPendingConfirmation: (pendingConfirmation) => set({ pendingConfirmation }),

    clearPendingConfirmation: () => set({ pendingConfirmation: null }),

   
    isTyping: false,
    setIsTyping: (isTyping) => set({ isTyping }),

    error: null,
    setError: (error) => set({ error }),

    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  }));