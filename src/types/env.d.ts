export interface Env {
    AI: Ai;
    AI_GATEWAY: any;

    AGENT: DurableObjectNamespace;
    DB: D1Database;

    VECTORIZE: VectorizeIndex;

    ENVIRONMENT?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface Task {
    id: string;
    userId: string;
    title: string;
    description?: string;
    dueDate?: number;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
    createdAt: number;
    completedAt?: number;
}

export interface UserPreferences { 
    name?: string;
    timezone?: string;
    preferences?: Record<string, any>;
}

export interface WSMessage {
    type: 'chat' | 'task' | 'status' | 'error';
    payload: any;
    timestamp: number; 
}

export interface AgentState {
    userId: string;
    conversationHistory: Message[];
    activeWebSockets: number;
    lastActivity: number;
}

