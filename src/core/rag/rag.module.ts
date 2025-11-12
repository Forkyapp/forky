import { RagService } from './rag.service';
import { RagController } from './rag.controller';

export class RagModule {
  private static ragService: RagService;
  private static ragController: RagController;

  static async initialize(openAIApiKey?: string): Promise<void> {
    this.ragService = new RagService(openAIApiKey);
    this.ragController = new RagController(this.ragService);
    await this.ragService.initialize();
  }

  static getService(): RagService {
    if (!this.ragService) {
      throw new Error('RagModule not initialized. Call RagModule.initialize() first.');
    }
    return this.ragService;
  }

  static getController(): RagController {
    if (!this.ragController) {
      throw new Error('RagModule not initialized. Call RagModule.initialize() first.');
    }
    return this.ragController;
  }
}
