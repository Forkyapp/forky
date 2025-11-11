import fs from 'fs';
import path from 'path';
import { workspace } from './workspace';

interface ContextOptions {
  model: 'claude' | 'gemini' | 'codex';
  includeShared?: boolean;
  includeProject?: boolean;
}

/**
 * Load AI context files for model prompts
 *
 * Loads context in order:
 * 1. Model-specific guidelines (.context/models/{model}.md)
 * 2. Shared guidelines (.context/shared/*.md)
 * 3. Project-specific context (.context/projects/{project}.md)
 */
export class ContextLoader {
  private readonly contextDir: string;

  constructor(contextDir?: string) {
    this.contextDir = contextDir || path.join(__dirname, '..', '.context');
  }

  /**
   * Load all relevant context for a model
   */
  load(options: ContextOptions): string {
    const sections: string[] = [];

    // 1. Model-specific guidelines
    const modelContext = this.loadModelContext(options.model);
    if (modelContext) {
      sections.push('# Model Guidelines\n\n' + modelContext);
    }

    // 2. Shared guidelines (if requested)
    if (options.includeShared !== false) {
      const sharedContext = this.loadSharedContext();
      if (sharedContext.length > 0) {
        sections.push('# Shared Guidelines\n\n' + sharedContext.join('\n\n---\n\n'));
      }
    }

    // 3. Project-specific context (if requested)
    if (options.includeProject !== false) {
      const projectContext = this.loadProjectContext();
      if (projectContext) {
        sections.push('# Project Context\n\n' + projectContext);
      }
    }

    return sections.join('\n\n' + '='.repeat(80) + '\n\n');
  }

  /**
   * Load model-specific guidelines
   */
  private loadModelContext(model: string): string | null {
    const modelFile = path.join(this.contextDir, 'models', `${model}.md`);
    return this.readFile(modelFile);
  }

  /**
   * Load all shared guideline files
   */
  private loadSharedContext(): string[] {
    const sharedDir = path.join(this.contextDir, 'shared');
    const contexts: string[] = [];

    if (!fs.existsSync(sharedDir)) {
      return contexts;
    }

    const files = fs.readdirSync(sharedDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(sharedDir, file);
      const content = this.readFile(filePath);
      if (content) {
        contexts.push(`## ${this.formatTitle(file)}\n\n${content}`);
      }
    }

    return contexts;
  }

  /**
   * Load project-specific context
   */
  private loadProjectContext(): string | null {
    const activeProject = workspace.getActiveProject();
    if (!activeProject) {
      return null;
    }

    // Try to find project context file
    // Use repo name as filename
    const projectFile = path.join(
      this.contextDir,
      'projects',
      `${activeProject.github.repo}.md`
    );

    return this.readFile(projectFile);
  }

  /**
   * Read file and return content, or null if doesn't exist
   */
  private readFile(filePath: string): string | null {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    } catch (error) {
      console.error(`Failed to read context file ${filePath}:`, (error as Error).message);
    }
    return null;
  }

  /**
   * Format filename to title
   * architecture.md -> Architecture
   */
  private formatTitle(filename: string): string {
    const name = filename.replace('.md', '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Check if context exists for a model
   */
  hasContext(model: string): boolean {
    const modelFile = path.join(this.contextDir, 'models', `${model}.md`);
    return fs.existsSync(modelFile) && fs.statSync(modelFile).size > 0;
  }

  /**
   * List available context files
   */
  list(): {
    models: string[];
    shared: string[];
    projects: string[];
  } {
    return {
      models: this.listFiles(path.join(this.contextDir, 'models')),
      shared: this.listFiles(path.join(this.contextDir, 'shared')),
      projects: this.listFiles(path.join(this.contextDir, 'projects')),
    };
  }

  private listFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  }
}

// Export singleton instance
export const contextLoader = new ContextLoader();

// Helper function for easy use
export function loadContext(options: ContextOptions): string {
  return contextLoader.load(options);
}
