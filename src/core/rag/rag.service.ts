import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { RecursiveCharacterTextSplitter } from './text-splitter';

interface ContextDocument {
  content: string;
  metadata: {
    source: string;
    category: string;
    section?: string;
    lineStart?: number;
    lineEnd?: number;
    filePath?: string; // Absolute file path
  };
  score?: number;
}

interface RetrieveContextOptions {
  query: string;
  topK?: number;
  category?: string; // Filter by category (specs, project, shared, etc.)
  minRelevanceScore?: number;
}

interface Chunk {
  content: string;
  metadata: {
    source: string;
    category: string;
    section?: string;
    lineStart: number;
    lineEnd: number;
    filePath: string;
  };
}

interface EmbeddingCache {
  [key: string]: {
    embedding: number[];
    content: string;
    metadata: Chunk['metadata'];
  };
}

export class RagService {
  private chunks: Chunk[] = [];
  private embeddings: EmbeddingCache = {};
  private isInitialized = false;
  private readonly contextBasePath: string;
  private readonly openAIApiKey: string | undefined;
  private readonly textSplitter: RecursiveCharacterTextSplitter;

  constructor(openAIApiKey?: string, chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.openAIApiKey = openAIApiKey || process.env.OPENAI_API_KEY;
    this.contextBasePath = path.join(
      process.cwd(),
      'templates',
      'context',
    );

    // Initialize text splitter with markdown-aware settings
    this.textSplitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
      chunkSize,
      chunkOverlap,
    });
  }

  /**
   * Initialize the RAG system by loading and indexing context files
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing RAG system...');

    try {
      // Load all context documents
      const documents = await this.loadContextDocuments();

      // Chunk documents semantically
      this.chunks = this.chunkDocuments(documents);

      // Create embeddings if OpenAI key is available
      if (this.openAIApiKey) {
        await this.createEmbeddings();
      }

      this.isInitialized = true;
      console.log(
        `RAG system initialized with ${this.chunks.length} chunks from ${documents.length} documents`,
      );
    } catch (error) {
      console.error('Failed to initialize RAG system:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant context for a given query
   */
  async retrieveContext(
    options: RetrieveContextOptions,
  ): Promise<ContextDocument[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      query,
      topK = 5,
      category,
      minRelevanceScore = 0.7,
    } = options;

    let results: ContextDocument[] = [];

    // Use embeddings if available
    if (this.openAIApiKey && Object.keys(this.embeddings).length > 0) {
      results = await this.semanticSearch(query, topK * 2, category);
    } else {
      // Fall back to keyword search
      results = this.keywordSearch(query, topK * 2, category);
    }

    // Filter by relevance score and limit results
    const filteredResults = results
      .filter((ctx) => !ctx.score || ctx.score >= minRelevanceScore)
      .slice(0, topK);

    return filteredResults;
  }

  /**
   * Get context formatted for AI prompt
   */
  async getFormattedContext(
    options: RetrieveContextOptions,
  ): Promise<string> {
    const contexts = await this.retrieveContext(options);

    if (contexts.length === 0) {
      return 'No relevant context found.';
    }

    const formatted = contexts
      .map((ctx, index) => {
        const header = `\n## Context ${index + 1}: ${ctx.metadata.source}`;
        const section = ctx.metadata.section
          ? ` - ${ctx.metadata.section}`
          : '';
        const location =
          ctx.metadata.lineStart && ctx.metadata.lineEnd
            ? ` (lines ${ctx.metadata.lineStart}-${ctx.metadata.lineEnd})`
            : '';
        const filePath = ctx.metadata.filePath
          ? `\n📄 File: ${ctx.metadata.filePath}`
          : '';

        return `${header}${section}${location}${filePath}\n\n${ctx.content}`;
      })
      .join('\n\n---\n');

    return formatted;
  }

  /**
   * Get context with file locations (easy copy-paste for AI)
   */
  async getContextWithLocations(
    options: RetrieveContextOptions,
  ): Promise<string> {
    const contexts = await this.retrieveContext(options);

    if (contexts.length === 0) {
      return 'No relevant context found.';
    }

    // Build header with all file locations
    const fileLocations = contexts
      .map((ctx) => ctx.metadata.filePath)
      .filter((path, index, self) => path && self.indexOf(path) === index) // Unique paths
      .map((path) => `- ${path}`)
      .join('\n');

    const header = `# Relevant Files\n${fileLocations}\n\n---\n`;

    // Build content sections
    const content = contexts
      .map((ctx, _index) => {
        const sectionHeader = `\n## ${ctx.metadata.source}`;
        const section = ctx.metadata.section
          ? ` - ${ctx.metadata.section}`
          : '';
        const location =
          ctx.metadata.lineStart && ctx.metadata.lineEnd
            ? ` (lines ${ctx.metadata.lineStart}-${ctx.metadata.lineEnd})`
            : '';

        return `${sectionHeader}${section}${location}\n\n${ctx.content}`;
      })
      .join('\n\n---\n');

    return header + content;
  }

  /**
   * Get just the file paths for relevant context
   */
  async getRelevantFiles(
    options: RetrieveContextOptions,
  ): Promise<string[]> {
    const contexts = await this.retrieveContext(options);

    const uniquePaths = contexts
      .map((ctx) => ctx.metadata.filePath)
      .filter((path, index, self) => path && self.indexOf(path) === index) as string[];

    return uniquePaths;
  }

  /**
   * Semantic search using OpenAI embeddings
   */
  private async semanticSearch(
    query: string,
    topK: number,
    category?: string,
  ): Promise<ContextDocument[]> {
    try {
      // Get query embedding
      const queryEmbedding = await this.getEmbedding(query);

      // Calculate similarity scores
      const scores: Array<{ chunk: Chunk; score: number }> = [];

      for (const [key, data] of Object.entries(this.embeddings)) {
        if (category && !key.startsWith(category)) {
          continue;
        }

        const similarity = this.cosineSimilarity(
          queryEmbedding,
          data.embedding,
        );

        scores.push({
          chunk: {
            content: data.content,
            metadata: data.metadata,
          },
          score: similarity,
        });
      }

      // Sort by similarity and return top results
      scores.sort((a, b) => b.score - a.score);

      return scores.slice(0, topK).map((item) => ({
        content: item.chunk.content,
        metadata: {
          source: item.chunk.metadata.source,
          category: item.chunk.metadata.category,
          section: item.chunk.metadata.section,
          lineStart: item.chunk.metadata.lineStart,
          lineEnd: item.chunk.metadata.lineEnd,
          filePath: item.chunk.metadata.filePath,
        },
        score: item.score,
      }));
    } catch (error) {
      console.error('Semantic search failed, falling back to keyword search:', error);
      return this.keywordSearch(query, topK, category);
    }
  }

  /**
   * Keyword-based search (fallback when embeddings unavailable)
   */
  private keywordSearch(
    query: string,
    topK: number,
    category?: string,
  ): ContextDocument[] {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2);

    const scores: Array<{ chunk: Chunk; score: number }> = this.chunks
      .filter((chunk) => !category || chunk.metadata.category === category)
      .map((chunk) => {
        const content = chunk.content.toLowerCase();
        const score = queryTerms.reduce((acc, term) => {
          const matches = (content.match(new RegExp(term, 'g')) || []).length;
          return acc + matches;
        }, 0);

        return { chunk, score };
      })
      .filter((item) => item.score > 0);

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map((item) => ({
      content: item.chunk.content,
      metadata: {
        source: item.chunk.metadata.source,
        category: item.chunk.metadata.category,
        section: item.chunk.metadata.section,
        lineStart: item.chunk.metadata.lineStart,
        lineEnd: item.chunk.metadata.lineEnd,
        filePath: item.chunk.metadata.filePath,
      },
      score: item.score / queryTerms.length, // Normalize score
    }));
  }

  /**
   * Load all markdown files from templates/context directory
   */
  private async loadContextDocuments(): Promise<
    Array<{ content: string; metadata: { source: string; category: string; filePath: string } }>
  > {
    const documents: Array<{
      content: string;
      metadata: { source: string; category: string; filePath: string };
    }> = [];

    const categories = ['specs', 'project', 'shared', 'claude'];

    for (const category of categories) {
      const categoryPath = path.join(this.contextBasePath, category);

      try {
        const files = await fs.readdir(categoryPath);

        for (const file of files) {
          if (!file.endsWith('.md') || file.startsWith('.')) {
            continue;
          }

          const filePath = path.join(categoryPath, file);
          const content = await fs.readFile(filePath, 'utf-8');

          documents.push({
            content,
            metadata: {
              source: `${category}/${file}`,
              category,
              filePath,
            },
          });
        }
      } catch (error) {
        console.warn(`Could not load category ${category}:`, error);
        continue;
      }
    }

    return documents;
  }

  /**
   * Chunk documents using markdown-aware splitting
   */
  private chunkDocuments(
    documents: Array<{
      content: string;
      metadata: { source: string; category: string; filePath: string };
    }>,
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const doc of documents) {
      const docChunks = this.splitMarkdown(doc.content);

      for (const chunk of docChunks) {
        const section = this.extractSectionHeader(chunk.content);
        const lineStart = this.estimateLineNumber(doc.content, chunk.content);

        chunks.push({
          content: chunk.content,
          metadata: {
            source: doc.metadata.source,
            category: doc.metadata.category,
            section,
            lineStart,
            lineEnd: lineStart + chunk.content.split('\n').length,
            filePath: doc.metadata.filePath,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Split markdown using RecursiveCharacterTextSplitter
   */
  private splitMarkdown(
    content: string,
  ): Array<{ content: string; start: number }> {
    const chunks = this.textSplitter.splitText(content);

    return chunks.map((chunk) => ({
      content: chunk.content,
      start: chunk.metadata.start,
    }));
  }

  /**
   * Split large markdown file in batches (for processing huge files)
   */
  private *splitMarkdownInBatches(
    content: string,
    batchSize: number = 10,
  ): Generator<Array<{ content: string; start: number }>, void, unknown> {
    for (const batch of this.textSplitter.splitInBatches(content, batchSize)) {
      yield batch.map((chunk) => ({
        content: chunk.content,
        start: chunk.metadata.start,
      }));
    }
  }

  /**
   * Extract the first markdown header from content
   */
  private extractSectionHeader(content: string): string | undefined {
    const headerMatch = content.match(/^#+\s+(.+)$/m);
    return headerMatch ? headerMatch[1].trim() : undefined;
  }

  /**
   * Estimate line number of chunk in original document
   */
  private estimateLineNumber(fullContent: string, chunkContent: string): number {
    const index = fullContent.indexOf(chunkContent.substring(0, 100));
    if (index === -1) return 0;

    const precedingContent = fullContent.substring(0, index);
    return precedingContent.split('\n').length;
  }

  /**
   * Create embeddings for all chunks
   */
  private async createEmbeddings(): Promise<void> {
    if (!this.openAIApiKey) {
      console.warn('OpenAI API key not provided, skipping embeddings');
      return;
    }

    console.log('Creating embeddings for chunks...');

    // Process in batches to avoid rate limits
    const batchSize = 20;
    for (let i = 0; i < this.chunks.length; i += batchSize) {
      const batch = this.chunks.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (chunk) => {
          try {
            const embedding = await this.getEmbedding(chunk.content);
            const key = `${chunk.metadata.category}-${chunk.metadata.source}-${chunk.metadata.lineStart}`;

            this.embeddings[key] = {
              embedding,
              content: chunk.content,
              metadata: chunk.metadata,
            };
          } catch (error) {
            console.error(`Failed to create embedding for chunk:`, error);
          }
        }),
      );
    }

    console.log(`Created ${Object.keys(this.embeddings).length} embeddings`);
  }

  /**
   * Get embedding for text using OpenAI API
   */
  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.openAIApiKey) {
      throw new Error('OpenAI API key not provided');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: text,
        model: 'text-embedding-3-small',
      },
      {
        headers: {
          'Authorization': `Bearer ${this.openAIApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.data[0].embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Reload the vector store (useful for hot-reloading in dev)
   */
  async reload(): Promise<void> {
    this.isInitialized = false;
    this.chunks = [];
    this.embeddings = {};
    await this.initialize();
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    return ['specs', 'project', 'shared', 'claude'];
  }

  /**
   * Process large file in batches
   * Useful for very large markdown files to avoid memory issues
   */
  async *processLargeFileInBatches(
    filePath: string,
    batchSize: number = 10,
  ): AsyncGenerator<ContextDocument[], void, unknown> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const category = path.basename(path.dirname(filePath));

    for (const batch of this.splitMarkdownInBatches(content, batchSize)) {
      const contextDocs: ContextDocument[] = batch.map((chunk) => {
        const section = this.extractSectionHeader(chunk.content);
        const lineStart = this.estimateLineNumber(content, chunk.content);

        return {
          content: chunk.content,
          metadata: {
            source: `${category}/${fileName}`,
            category,
            section,
            lineStart,
            lineEnd: lineStart + chunk.content.split('\n').length,
            filePath,
          },
        };
      });

      yield contextDocs;
    }
  }

  /**
   * Get text splitter configuration
   */
  getSplitterConfig(): {
    chunkSize: number;
    chunkOverlap: number;
    separators: string[];
  } {
    return this.textSplitter.getConfig();
  }

  /**
   * Estimate number of chunks for a file
   */
  async estimateChunksForFile(filePath: string): Promise<number> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.textSplitter.estimateChunks(content);
  }
}
