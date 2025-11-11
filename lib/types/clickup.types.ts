/**
 * ClickUp related type definitions
 */

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  text_content?: string;
  url?: string;
  status?: {
    status: string;
  };
  custom_fields?: Array<{
    name?: string;
    value?: string;
  }>;
  tags?: Array<{
    name: string;
  }>;
}

export interface Comment {
  id: string;
  comment_text: string;
  user: {
    id: number;
    username: string;
  };
  date: string;
}

export interface CommentResponse {
  success: boolean;
  disabled?: boolean;
  data?: any;
  error?: string;
}

export interface Command {
  type: string;
}
