/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * ⚠️ STATUS: NOT CURRENTLY USED - RESERVED FOR FUTURE USE
 *
 * This module provides RAG capabilities for enhanced context loading and
 * intelligent document retrieval. Currently disabled but will be integrated
 * in future versions for:
 *
 * - Smart codebase context loading
 * - Semantic search across documentation
 * - Intelligent chunking and embedding of large codebases
 * - Vector-based similarity search for relevant code snippets
 *
 * DO NOT REMOVE - This is planned infrastructure for future enhancements.
 *
 * @module rag
 * @status disabled
 * @plannedFor v2.0
 */

export { RagService } from './rag.service';
export { RagController } from './rag.controller';
export { RagModule } from './rag.module';
export { RecursiveCharacterTextSplitter } from './text-splitter';
export type { TextSplitterOptions, Chunk } from './text-splitter';
