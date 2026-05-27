// Shared TypeScript interfaces for the application

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Document {
  id: number;
  user_id: number;
  filename: string;
  page_count: number;
  processing_time: number;
  file_size: number;
  created_at: string;
  updated_at: string;
  markdown_preview?: string;
}

export interface DocumentDetail extends Document {
  markdown_content: string;
  corrected_markdown_content?: string;
}

export interface DocumentDetailResponse {
  id: number;
  user_id: number;
  filename: string;
  markdown_content: string;
  corrected_markdown_content?: string;
  page_count: number;
  processing_time: number;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessingResponse {
  success: boolean;
  markdown: string;
  corrected_markdown?: string;
  page_count: number;
  processing_time: number;
  session_id: string;
  document_id?: number;
  error?: string;
}

export interface HealthResponse {
  status: string;
  message: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}
