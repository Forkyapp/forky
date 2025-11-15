/**
 * Workflow Module - Orchestrates multi-AI task processing
 *
 * This module provides the main workflow orchestration for processing tasks
 * through the multi-stage AI pipeline.
 */

export * from './types';
export { WorkflowExecutor } from './workflow-executor';
export { TaskOrchestrator } from './orchestrator';

// Export singleton instance for convenience
import { TaskOrchestrator } from './orchestrator';
export const taskOrchestrator = new TaskOrchestrator();

// Backward compatibility exports
export {
  taskOrchestrator as orchestrator,
  taskOrchestrator as default,
};
