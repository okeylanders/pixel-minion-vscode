/**
 * ToolRegistry - Manages multiple ToolProviders
 *
 * Pattern: Composite - aggregates multiple providers into single interface
 */
import { ToolProvider, ToolDefinition, ToolExecutionResult } from './ToolProvider';

export class ToolRegistry {
  private providers: Map<string, ToolProvider> = new Map();

  /**
   * Register a tool provider
   */
  registerProvider(provider: ToolProvider): void {
    this.providers.set(provider.getName(), provider);
  }

  /**
   * Unregister a tool provider
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  /**
   * List all available tools from all providers
   */
  listAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const provider of this.providers.values()) {
      tools.push(...provider.listAvailableTools());
    }
    return tools;
  }

  /**
   * Execute a tool by name (searches all providers)
   */
  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolExecutionResult> {
    for (const provider of this.providers.values()) {
      if (provider.hasTool(name)) {
        return provider.executeTool(name, params);
      }
    }
    return { success: false, error: `Tool not found: ${name}` };
  }

  /**
   * Get a specific provider
   */
  getProvider(name: string): ToolProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    for (const provider of this.providers.values()) {
      if (provider.hasTool(name)) {
        return true;
      }
    }
    return false;
  }
}
