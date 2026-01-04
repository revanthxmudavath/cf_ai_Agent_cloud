
  import { ToolDefinition } from '../../types/tools';
  import {
    createTaskTool,
    listTasksTool,
    updateTaskTool,
    completeTaskTool,
    deleteTaskTool,
  } from './TaskTools';
  import { getWeatherTool } from './WeatherTool';
  import { sendEmailTool } from './EmailTool';
  import { createCalendarEventTool } from './GoogleCalendarTool';

  /**
   * All available MCP tools
   */
  export const ALL_TOOLS: ToolDefinition[] = [
    // Task management tools
    createTaskTool,
    listTasksTool,
    updateTaskTool,
    completeTaskTool,
    deleteTaskTool,

    // External API tools
    getWeatherTool,
    sendEmailTool,
    createCalendarEventTool,
  ];

  /**
   * Get a tool by name
   */
  export function getTool(name: string): ToolDefinition | undefined {
    return ALL_TOOLS.find(tool => tool.name === name);
  }

  /**
   * Get all tool names
   */
  export function getToolNames(): string[] {
    return ALL_TOOLS.map(tool => tool.name);
  }
