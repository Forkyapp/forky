/**
 * Smart Context Loader with Semantic Search
 *
 * Uses simple embeddings and cosine similarity to find relevant context sections.
 * Works without external dependencies - can be upgraded to LangChain later.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { workspace } from './workspace';

interface SmartContextOptions {
  model: 'claude' | 'gemini' | 'codex';
  taskDescription: string;
  maxTokens?: number;
  includeProject?: boolean;
}

interface ContextChunk {
  content: string;
  source: string;
  relevanceScore: number;
}

interface CachedEmbedding {
  chunks: Array<{
    content: string;
    source: string;
    embedding: number[];
  }>;
  hash: string;
}

export class SmartContextLoader {
  private readonly contextDir: string;
  private readonly cacheDir: string;
  private cache: Map<string, CachedEmbedding> = new Map();

  constructor() {
    this.contextDir = path.join(__dirname, '..', '.context');
    this.cacheDir = path.join(__dirname, '..', 'data', 'cache', 'embeddings');

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Load only relevant context based on task description
   */
  async loadRelevant(options: SmartContextOptions): Promise<string> {
    const {
      model,
      taskDescription,
      maxTokens = 4000,
      includeProject = true
    } = options;

    try {
      // Get or build cache
      const cacheKey = this.getCacheKey(model, includeProject);
      let cached = this.loadCache(cacheKey);

      if (!cached || cached.hash !== this.getContextHash(model, includeProject)) {
        // Build new cache
        cached = await this.buildCache(model, includeProject);
        this.saveCache(cacheKey, cached);
      }

      // Find relevant chunks
      const relevantChunks = this.findRelevant(
        taskDescription,
        cached.chunks,
        maxTokens
      );

      return this.formatContext(relevantChunks);

    } catch (error) {
      console.error('Smart context loading failed, using fallback:', (error as Error).message);
      return this.fallbackLoad(model);
    }
  }

  /**
   * Build cache of embedded context chunks
   */
  private async buildCache(model: string, includeProject: boolean): Promise<CachedEmbedding> {
    const chunks: Array<{ content: string; source: string; embedding: number[] }> = [];

    // Load all context
    const contexts = this.loadAllContext(model, includeProject);

    // Split into chunks and embed
    for (const { content, source } of contexts) {
      const contextChunks = this.splitIntoChunks(content);

      for (const chunk of contextChunks) {
        chunks.push({
          content: chunk,
          source,
          embedding: this.embed(chunk)
        });
      }
    }

    return {
      chunks,
      hash: this.getContextHash(model, includeProject)
    };
  }

  /**
   * Load all context files
   */
  private loadAllContext(model: string, includeProject: boolean): Array<{ content: string; source: string }> {
    const contexts: Array<{ content: string; source: string }> = [];

    // 1. Model-specific
    const modelPath = path.join(this.contextDir, 'models', `${model}.md`);
    if (fs.existsSync(modelPath) && fs.statSync(modelPath).size > 0) {
      contexts.push({
        content: fs.readFileSync(modelPath, 'utf8'),
        source: `models/${model}.md`
      });
    }

    // 2. Shared
    const sharedDir = path.join(this.contextDir, 'shared');
    if (fs.existsSync(sharedDir)) {
      fs.readdirSync(sharedDir)
        .filter(f => f.endsWith('.md') && !f.endsWith('.example'))
        .forEach(file => {
          const filePath = path.join(sharedDir, file);
          if (fs.statSync(filePath).size > 0) {
            contexts.push({
              content: fs.readFileSync(filePath, 'utf8'),
              source: `shared/${file}`
            });
          }
        });
    }

    // 3. Project-specific
    if (includeProject) {
      const activeProject = workspace.getActiveProject();
      if (activeProject) {
        const projectPath = path.join(
          this.contextDir,
          'projects',
          `${activeProject.github.repo}.md`
        );

        if (fs.existsSync(projectPath) && fs.statSync(projectPath).size > 0) {
          contexts.push({
            content: fs.readFileSync(projectPath, 'utf8'),
            source: `projects/${activeProject.github.repo}.md`
          });
        }
      }
    }

    return contexts;
  }

  /**
   * Split content into chunks
   */
  private splitIntoChunks(content: string, chunkSize = 500, overlap = 50): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // Keep overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(' ') + ' ' + line;
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Find relevant chunks using cosine similarity
   */
  private findRelevant(
    query: string,
    chunks: Array<{ content: string; source: string; embedding: number[] }>,
    maxTokens: number
  ): ContextChunk[] {
    if (chunks.length === 0) {
      return [];
    }

    // Embed query
    const queryEmbedding = this.embed(query);

    // Calculate similarity scores
    const scored = chunks.map(chunk => ({
      content: chunk.content,
      source: chunk.source,
      relevanceScore: this.cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort by relevance
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Select top chunks within token limit
    const selected: ContextChunk[] = [];
    let totalChars = 0;
    const maxChars = maxTokens * 4 * 0.8; // Rough estimate: 4 chars per token

    for (const chunk of scored) {
      if (totalChars + chunk.content.length > maxChars) {
        break;
      }

      selected.push(chunk);
      totalChars += chunk.content.length;
    }

    return selected;
  }

  /**
   * Simple TF-IDF-like embedding
   */
  private embed(text: string): number[] {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const vector = new Array(300).fill(0);

    words.forEach(word => {
      const hash = this.hashCode(word);
      vector[Math.abs(hash) % 300] += 1;
    });

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Hash string to number
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Format chunks into readable context
   */
  private formatContext(chunks: ContextChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    const sections: string[] = [
      '# Relevant Context for This Task',
      '',
      '> This context was automatically selected based on task relevance.',
      ''
    ];

    // Group by source
    const bySource = new Map<string, ContextChunk[]>();
    for (const chunk of chunks) {
      const existing = bySource.get(chunk.source) || [];
      existing.push(chunk);
      bySource.set(chunk.source, existing);
    }

    // Format each source
    for (const [source, sourceChunks] of bySource) {
      sections.push(`## From: ${source}`);
      sections.push('');

      for (const chunk of sourceChunks) {
        sections.push(chunk.content);
        sections.push('');
      }

      sections.push('---');
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Fallback to simple loading
   */
  private fallbackLoad(model: string): string {
    const modelPath = path.join(this.contextDir, 'models', `${model}.md`);

    if (fs.existsSync(modelPath) && fs.statSync(modelPath).size > 0) {
      return fs.readFileSync(modelPath, 'utf8');
    }

    return '';
  }

  /**
   * Get cache key
   */
  private getCacheKey(model: string, includeProject: boolean): string {
    const activeProject = workspace.getActiveProject();
    const projectName = includeProject && activeProject ? activeProject.github.repo : 'none';
    return `${model}-${projectName}`;
  }

  /**
   * Get hash of all context files
   */
  private getContextHash(model: string, includeProject: boolean): string {
    const files: string[] = [];

    const modelPath = path.join(this.contextDir, 'models', `${model}.md`);
    if (fs.existsSync(modelPath)) {
      files.push(fs.readFileSync(modelPath, 'utf8'));
    }

    const sharedDir = path.join(this.contextDir, 'shared');
    if (fs.existsSync(sharedDir)) {
      fs.readdirSync(sharedDir)
        .filter(f => f.endsWith('.md') && !f.endsWith('.example'))
        .forEach(f => {
          files.push(fs.readFileSync(path.join(sharedDir, f), 'utf8'));
        });
    }

    if (includeProject) {
      const activeProject = workspace.getActiveProject();
      if (activeProject) {
        const projectPath = path.join(
          this.contextDir,
          'projects',
          `${activeProject.github.repo}.md`
        );
        if (fs.existsSync(projectPath)) {
          files.push(fs.readFileSync(projectPath, 'utf8'));
        }
      }
    }

    return crypto.createHash('md5').update(files.join('')).digest('hex').substring(0, 8);
  }

  /**
   * Load cache from file
   */
  private loadCache(key: string): CachedEmbedding | null {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const cachePath = path.join(this.cacheDir, `${key}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        this.cache.set(key, data);
        return data;
      } catch (error) {
        console.error('Failed to load cache:', (error as Error).message);
      }
    }

    return null;
  }

  /**
   * Save cache to file
   */
  private saveCache(key: string, data: CachedEmbedding): void {
    this.cache.set(key, data);
    const cachePath = path.join(this.cacheDir, `${key}.json`);

    try {
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save cache:', (error as Error).message);
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();

    if (fs.existsSync(this.cacheDir)) {
      fs.readdirSync(this.cacheDir).forEach(file => {
        fs.unlinkSync(path.join(this.cacheDir, file));
      });
    }
  }
}

// Export singleton
export const smartContextLoader = new SmartContextLoader();

// Helper function
export async function loadSmartContext(options: SmartContextOptions): Promise<string> {
  return smartContextLoader.loadRelevant(options);
}
