/**
 * Context Loading Types
 */

export interface LoadContextOptions {
  model: string;
  taskDescription: string;
  category?: string;
  minRelevance?: number;
  topK?: number;
}

export interface ContextLoadMetrics {
  provider: 'rag' | 'smart';
  model: string;
  loadTimeMs: number;
  chunksReturned: number;
  totalTokens: number;
  cacheHit: boolean;
  timestamp: string;
}

export interface ContextStats {
  totalLoads: number;
  ragLoads: number;
  smartLoads: number;
  ragPercentage: number;
  avgLoadTimeMs: number;
  cacheHitRate: number;
  avgChunksReturned: number;
}
