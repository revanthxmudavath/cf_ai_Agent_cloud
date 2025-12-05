import { z } from 'zod';


export interface ToolDefinition {
    name: string;
    description: string;
    parameters: z.ZodSchema<any>;
    execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
    userId: string;
    env: any;
    agent: any;
}


export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
}

// Task schemas

export const CreateTaskSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    dueDate: z.number().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),

});

export const ListTasksSchema = z.object({
      completed: z.boolean().optional(),
  });


export const UpdateTaskSchema = z.object({
      taskId: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      dueDate: z.number().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
  });

export const CompleteTaskSchema = z.object({
    taskId: z.string().uuid(),
});

export const DeleteTaskSchema = z.object({
    taskId: z.string().uuid(),
});


// Weather schemas

export const GetWeatherSchema = z.object({
    city: z.string().min(1),
    countryCode: z.string().length(2).optional()
});


export interface WeatherData {
    city: string;
    country: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    description: string;
    windSpeed: number;
    timestamp: number;
  }


// Email schemas 

export const SendEmailSchema = z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      textBody: z.string().min(1),
      htmlBody: z.string().optional(),
  });

export interface EmailResult {
      messageId: string;
      to: string;
      submittedAt: string;
  }

// Tool calling with confirmation

export interface ConfirmationRequest {
    requestId: string;
    userId: string;
    code: string;
    toolCalls: ToolCallSummary[];
    timestamp: number;
}

export interface ToolCallSummary {
    toolName: string;
    parameters: Record<string, any>;
    description: string;
}

export interface ConfirmationResponse {
    requestId: string;
    approved: boolean;
    timestamp: number;
}

export type CreateTaskParams = z.infer<typeof CreateTaskSchema>;
export type ListTasksParams = z.infer<typeof ListTasksSchema>;
export type UpdateTaskParams = z.infer<typeof UpdateTaskSchema>;
export type CompleteTaskParams = z.infer<typeof CompleteTaskSchema>;
export type DeleteTaskParams = z.infer<typeof DeleteTaskSchema>;
export type GetWeatherParams = z.infer<typeof GetWeatherSchema>;
export type SendEmailParams = z.infer<typeof SendEmailSchema>;