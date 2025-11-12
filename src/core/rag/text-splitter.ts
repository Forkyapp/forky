/**
 * RecursiveCharacterTextSplitter
 *
 * Intelligently splits text by trying separators in order of preference.
 * For markdown, this means:
 * 1. Split by headers (##, ###, etc.)
 * 2. Split by paragraphs
 * 3. Split by sentences
 * 4. Split by characters
 *
 * Maintains context with overlap between chunks.
 */

export interface TextSplitterOptions {
  chunkSize?: number;        // Target chunk size in characters
  chunkOverlap?: number;     // Overlap between chunks for context
  separators?: string[];     // Custom separators (or use language preset)
  keepSeparator?: boolean;   // Keep separator in the chunk
}

export interface Chunk {
  content: string;
  metadata: {
    start: number;
    end: number;
    chunkIndex: number;
  };
}

export class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];
  private keepSeparator: boolean;

  constructor(options: TextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.keepSeparator = options.keepSeparator ?? true;
    this.separators = options.separators || [
      '\n## ',
      '\n### ',
      '\n#### ',
      '\n\n',
      '\n',
      '. ',
      ' ',
      '',
    ];
  }

  /**
   * Create splitter for specific language
   */
  static fromLanguage(
    language: 'markdown' | 'typescript' | 'javascript' | 'python',
    options: Omit<TextSplitterOptions, 'separators'> = {},
  ): RecursiveCharacterTextSplitter {
    const separators: Record<string, string[]> = {
      markdown: [
        '\n## ',
        '\n### ',
        '\n#### ',
        '\n##### ',
        '\n###### ',
        '```\n\n',
        '\n\n',
        '\n',
        '. ',
        ' ',
        '',
      ],
      typescript: [
        '\nclass ',
        '\ninterface ',
        '\ntype ',
        '\nexport ',
        '\nfunction ',
        '\nconst ',
        '\nlet ',
        '\nvar ',
        '\n\n',
        '\n',
        ' ',
        '',
      ],
      javascript: [
        '\nclass ',
        '\nexport ',
        '\nfunction ',
        '\nconst ',
        '\nlet ',
        '\nvar ',
        '\n\n',
        '\n',
        ' ',
        '',
      ],
      python: [
        '\nclass ',
        '\ndef ',
        '\n\ndef ',
        '\n\nclass ',
        '\n\n',
        '\n',
        ' ',
        '',
      ],
    };

    return new RecursiveCharacterTextSplitter({
      ...options,
      separators: separators[language],
    });
  }

  /**
   * Split text into chunks
   */
  splitText(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    const splits = this.recursiveSplit(text, this.separators);

    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];

      // If adding this split would exceed chunk size
      if (currentChunk.length + split.length > this.chunkSize) {
        // Save current chunk if not empty
        if (currentChunk.trim().length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              start: currentStart,
              end: currentStart + currentChunk.length,
              chunkIndex: chunkIndex++,
            },
          });

          // Start new chunk with overlap
          const overlapText = this.getOverlap(currentChunk);
          currentChunk = overlapText + split;
          currentStart = currentStart + currentChunk.length - overlapText.length;
        } else {
          // If chunk is empty, start fresh
          currentChunk = split;
          currentStart = text.indexOf(split, currentStart);
        }
      } else {
        // Add to current chunk
        currentChunk += split;
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          start: currentStart,
          end: currentStart + currentChunk.length,
          chunkIndex: chunkIndex++,
        },
      });
    }

    return chunks;
  }

  /**
   * Split text with metadata preservation
   */
  splitTextWithMetadata(
    text: string,
    baseMetadata: Record<string, unknown> = {},
  ): Array<{ content: string; metadata: Record<string, unknown> }> {
    const chunks = this.splitText(text);

    return chunks.map((chunk) => ({
      content: chunk.content,
      metadata: {
        ...baseMetadata,
        ...chunk.metadata,
      },
    }));
  }

  /**
   * Split documents (with existing metadata)
   */
  splitDocuments(
    documents: Array<{ content: string; metadata: Record<string, unknown> }>,
  ): Array<{ content: string; metadata: Record<string, unknown> }> {
    const allChunks: Array<{ content: string; metadata: Record<string, unknown> }> = [];

    for (const doc of documents) {
      const chunks = this.splitTextWithMetadata(doc.content, doc.metadata);
      allChunks.push(...chunks);
    }

    return allChunks;
  }

  /**
   * Recursively split text by trying separators in order
   */
  private recursiveSplit(text: string, separators: string[]): string[] {
    if (text.length <= this.chunkSize) {
      return [text];
    }

    if (separators.length === 0) {
      // No more separators - split by chunk size
      return this.splitBySize(text);
    }

    const [separator, ...remainingSeparators] = separators;

    // Try to split by current separator
    if (separator === '') {
      // Character-level split
      return this.splitBySize(text);
    }

    const splits = this.splitBySeparator(text, separator);

    // If we got good splits, process them recursively
    const goodSplits: string[] = [];
    for (const split of splits) {
      if (split.length > this.chunkSize) {
        // This split is too large, split it further
        const subSplits = this.recursiveSplit(split, remainingSeparators);
        goodSplits.push(...subSplits);
      } else {
        goodSplits.push(split);
      }
    }

    return goodSplits;
  }

  /**
   * Split text by a specific separator
   */
  private splitBySeparator(text: string, separator: string): string[] {
    const splits: string[] = [];

    if (this.keepSeparator) {
      // Keep separator at the start of each chunk (except first)
      const parts = text.split(separator);
      for (let i = 0; i < parts.length; i++) {
        if (i === 0) {
          splits.push(parts[i]);
        } else {
          splits.push(separator + parts[i]);
        }
      }
    } else {
      // Remove separator
      splits.push(...text.split(separator));
    }

    return splits.filter((s) => s.length > 0);
  }

  /**
   * Split text by chunk size (character-level)
   */
  private splitBySize(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      chunks.push(text.substring(start, start + this.chunkSize));
      start += this.chunkSize;
    }

    return chunks;
  }

  /**
   * Get overlap text from end of chunk
   */
  private getOverlap(text: string): string {
    if (text.length <= this.chunkOverlap) {
      return text;
    }

    return text.substring(text.length - this.chunkOverlap);
  }

  /**
   * Merge small chunks together
   */
  mergeChunks(chunks: Chunk[], separator: string = '\n\n'): Chunk[] {
    const merged: Chunk[] = [];
    let currentChunk: Chunk | null = null;

    for (const chunk of chunks) {
      if (!currentChunk) {
        currentChunk = chunk;
        continue;
      }

      // If combined size is less than chunk size, merge
      if (
        currentChunk.content.length + separator.length + chunk.content.length <=
        this.chunkSize
      ) {
        currentChunk = {
          content: currentChunk.content + separator + chunk.content,
          metadata: {
            start: currentChunk.metadata.start,
            end: chunk.metadata.end,
            chunkIndex: currentChunk.metadata.chunkIndex,
          },
        };
      } else {
        // Can't merge, save current and start new
        merged.push(currentChunk);
        currentChunk = chunk;
      }
    }

    // Add last chunk
    if (currentChunk) {
      merged.push(currentChunk);
    }

    return merged;
  }

  /**
   * Get chunk count estimate without actually splitting
   */
  estimateChunks(text: string): number {
    return Math.ceil(text.length / (this.chunkSize - this.chunkOverlap));
  }

  /**
   * Split in batches (useful for large files)
   */
  *splitInBatches(
    text: string,
    batchSize: number = 10,
  ): Generator<Chunk[], void, unknown> {
    const chunks = this.splitText(text);

    for (let i = 0; i < chunks.length; i += batchSize) {
      yield chunks.slice(i, i + batchSize);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): {
    chunkSize: number;
    chunkOverlap: number;
    separators: string[];
    keepSeparator: boolean;
  } {
    return {
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      separators: this.separators,
      keepSeparator: this.keepSeparator,
    };
  }
}
