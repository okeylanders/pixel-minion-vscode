/**
 * ToolProvider - Generic interface for providing tools to AI agents
 *
 * Pattern: Strategy pattern for different tool implementations
 * Purpose: Extensible system for adding new tool categories
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface ToolProvider {
  /**
   * Get the name of this tool provider
   */
  getName(): string;

  /**
   * List all available tools from this provider
   */
  listAvailableTools(): ToolDefinition[];

  /**
   * Execute a tool by name with given parameters
   */
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolExecutionResult>;

  /**
   * Check if this provider has a specific tool
   */
  hasTool(name: string): boolean;
}
