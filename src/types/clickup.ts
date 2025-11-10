/**
 * ClickUp Domain Types
 * Types for ClickUp API interactions and task management
 */

export interface ClickUpTask {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly text_content?: string;
  readonly url?: string;
  readonly status?: {
    readonly status: string;
  };
  readonly custom_fields?: ReadonlyArray<{
    readonly name?: string;
    readonly value?: string;
  }>;
  readonly tags?: ReadonlyArray<{
    readonly name: string;
  }>;
}

export interface ClickUpComment {
  readonly id: string;
  readonly comment_text: string;
  readonly user: {
    readonly id: number;
    readonly username: string;
  };
  readonly date: string;
}

export interface ClickUpCommentResponse {
  readonly success: boolean;
  readonly disabled?: boolean;
  readonly data?: any;
  readonly error?: string;
}

export interface ClickUpCommand {
  readonly type: 'rerun-codex-review' | 'rerun-claude-fixes' | string;
}

export interface ClickUpTaskData {
  readonly id: string;
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly text_content?: string;
  readonly url?: string;
}
