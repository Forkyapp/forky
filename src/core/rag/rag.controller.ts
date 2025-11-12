import { RagService } from './rag.service';

interface RetrieveContextDto {
  query: string;
  topK?: number;
  category?: 'specs' | 'project' | 'shared' | 'claude';
  minRelevanceScore?: number;
  formatted?: boolean;
}

export class RagController {
  constructor(private readonly ragService: RagService) {}

  /**
   * Retrieve relevant context chunks for a query
   *
   * Example:
   * {
   *   "query": "How do I implement authentication guards?",
   *   "topK": 3,
   *   "category": "claude"
   * }
   */
  async retrieveContext(dto: RetrieveContextDto): Promise<unknown> {
    const {
      query,
      topK = 5,
      category,
      minRelevanceScore = 0.7,
      formatted = false,
    } = dto;

    if (formatted) {
      const formattedResult = await this.ragService.getFormattedContext({
        query,
        topK,
        category,
        minRelevanceScore,
      });
      return { formatted: formattedResult };
    }

    const contexts = await this.ragService.retrieveContext({
      query,
      topK,
      category,
      minRelevanceScore,
    });

    return { contexts };
  }

  /**
   * Reload the RAG system (useful for development)
   */
  async reload(): Promise<{ message: string }> {
    await this.ragService.reload();
    return { message: 'RAG system reloaded successfully' };
  }

  /**
   * Get available categories
   */
  getCategories(): { categories: string[] } {
    return {
      categories: this.ragService.getCategories(),
    };
  }

  /**
   * Health check
   */
  health(): { status: string } {
    return { status: 'ok' };
  }
}
