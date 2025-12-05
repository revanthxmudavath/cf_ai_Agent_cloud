import { ToolDefinition, ToolContext, ToolResult } from "../../types/tools";

import {
    CreateTaskSchema,
    ListTasksSchema,
    UpdateTaskSchema,
    CompleteTaskSchema,
    DeleteTaskSchema,
    CreateTaskParams,
    ListTasksParams,
    UpdateTaskParams,
    CompleteTaskParams,
    DeleteTaskParams
} from '../../types/tools'

// Create a new Task 
export const createTaskTool: ToolDefinition = {
    name: 'createTask',
    description: 'Create a new task with title, optional description, due date, and priority',
    parameters: CreateTaskSchema,
    async execute(params: CreateTaskParams, context: ToolContext): Promise<ToolResult> {
        try {
            const { title, description, dueDate, priority = 'medium' } = params; 

            // Call the PersonalAssistant's createTask method
            const task = await context.agent.createTask(
                context.userId,
                title,
                description,
                dueDate,
                priority
            );

            return {
                success: true,
                data: task,
                message: `Task "${title}" created successfully`,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to create Task',
            };
        }
    },
};

// List all tasks for the user
export const listTasksTool: ToolDefinition = {
    name: 'listTasks',
    description: 'List all tasks, optionally filtered by completion status',
    parameters: ListTasksSchema,
    async execute(params: ListTasksParams, context: ToolContext): Promise<ToolResult> {
        try {
            const { completed } = params;

            const tasks = await context.agent.listUserTasks(context.userId, completed);

            return {
                success: true,
                data: tasks,
                message: `Found ${tasks.length} task(s)`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to list tasks',
        };
      }
    },
};

/**
   * Update an existing task
   */
  export const updateTaskTool: ToolDefinition = {
    name: 'updateTask',
    description: 'Update task fields (title, description, due date, priority)',
    parameters: UpdateTaskSchema,
    async execute(params: UpdateTaskParams, context: ToolContext): Promise<ToolResult> {
      try {
        const { taskId, ...updates } = params;

        const task = await context.agent.updateTask(context.userId, taskId, updates);

        return {
          success: true,
          data: task,
          message: 'Task updated successfully',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to update task',
        };
      }
    },
  };

  /**
   * Mark a task as completed
   */
  export const completeTaskTool: ToolDefinition = {
    name: 'completeTask',
    description: 'Mark a task as completed',
    parameters: CompleteTaskSchema,
    async execute(params: CompleteTaskParams, context: ToolContext): Promise<ToolResult> {
      try {
        const { taskId } = params;

        const task = await context.agent.completeTask(context.userId, taskId);

        return {
          success: true,
          data: task,
          message: 'Task marked as completed',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to complete task',
        };
      }
    },
  };

  /**
   * Delete a task
   */
  export const deleteTaskTool: ToolDefinition = {
    name: 'deleteTask',
    description: 'Delete a task permanently',
    parameters: DeleteTaskSchema,
    async execute(params: DeleteTaskParams, context: ToolContext): Promise<ToolResult> {
      try {
        const { taskId } = params;

        await context.agent.deleteTask(context.userId, taskId);

        return {
          success: true,
          message: 'Task deleted successfully',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to delete task',
        };
      }
    },
  };