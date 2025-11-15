/**
 * Stages Module - Workflow pipeline stages
 *
 * This module exports all pipeline stages and related types.
 * Each stage is independent and uses dependency injection for better testability.
 */

export * from './types';
export * from './base-stage';

// Individual stages
export { AnalysisStage } from './analysis.stage';
export { ImplementationStage } from './implementation.stage';
export { ReviewStage } from './review.stage';
export { FixesStage } from './fixes.stage';
