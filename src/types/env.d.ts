export interface Env {
    AI: Ai;
    // AI_GATEWAY: any;

    AGENT: DurableObjectNamespace;
    DB: D1Database;

    VECTORIZE: VectorizeIndex;
    TASK_WORKFLOW: Workflow<TaskWorkflowParams>;

    ENVIRONMENT?: string;

    LLM_MODEL?: string;
    LLM_MAX_TOKENS?: string;
    LLM_TEMPERATURE?: string;
    RAG_ENABLED?: string;
    RAG_TOP_K?: string;


    OPENWEATHER_API_KEY?: string;
    POSTMARK_API_KEY?: string;
    POSTMARK_FROM_EMAIL?: string;
    CLERK_SECRET_KEY: string;
    CLERK_PUBLISHABLE_KEY: string;
    NANGO_SECRET_KEY: string;

    // Code Mode Configuration
    CODE_EXECUTION_TIMEOUT?: string;
    CONFIRMATION_TIMEOUT?: string;
    MAX_CODE_LENGTH?: string;

}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface WSMessage {
      type: 'chat' | 'chat_response' | 'task' | 'task_list' | 'status' | 'error' | 'confirmation_request' | 'confirmation_response' | 'tool_execution_result';
      payload: any;
      timestamp: number;
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

export interface AgentState {
    userId: string;
    conversationHistory: Message[];
    activeWebSockets: number;
    lastActivity: number;
}

export interface TaskWorkflowParams {
    userId: string;
    taskId: string;
    action: 'reminder' | 'decompose' | 'schedule' | 'cleanup';
    dueDate?: number;
    taskDetails?: {
        title: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high';
    };
}

export interface WorkflowStepResult {
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}

export interface ReminderResult extends WorkflowStepResult {
    reminderSent?: boolean;
    scheduledFor?: number;
    taskId?: string;
}



