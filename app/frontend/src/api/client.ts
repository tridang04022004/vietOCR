import axios from 'axios';
import type { ProcessingResponse, HealthResponse, Token, User, DocumentListResponse, DocumentDetail, AutoCorrectResponse } from '../types';
import type { VisualizationResponse } from '../types/visualization';

const API_BASE_URL = '/api';

// Add axios interceptor to attach JWT token to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiClient = {
  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  async healthCheck(): Promise<HealthResponse> {
    const response = await axios.get<HealthResponse>(`${API_BASE_URL}/health`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  async register(email: string, password: string): Promise<Token> {
    const response = await axios.post<Token>(`${API_BASE_URL}/auth/register`, {
      email,
      password,
    });
    return response.data;
  },

  async login(email: string, password: string): Promise<Token> {
    const response = await axios.post<Token>(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    });
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await axios.get<User>(`${API_BASE_URL}/auth/me`);
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await axios.put(`${API_BASE_URL}/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  async changeEmail(newEmail: string, password: string): Promise<{ message: string }> {
    const response = await axios.put(`${API_BASE_URL}/auth/change-email`, {
      new_email: newEmail,
      password: password,
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  async uploadPDF(file: File, onProgress?: (progress: number) => void): Promise<ProcessingResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post<ProcessingResponse>(
      `${API_BASE_URL}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );

    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT LIBRARY
  // ═══════════════════════════════════════════════════════════════════════════

  async getDocuments(search?: string): Promise<DocumentListResponse> {
    const params = search ? { search } : {};
    const response = await axios.get<DocumentListResponse>(`${API_BASE_URL}/documents`, { params });
    return response.data;
  },

  async getDocument(id: number): Promise<DocumentDetail> {
    const response = await axios.get<DocumentDetail>(`${API_BASE_URL}/documents/${id}`);
    return response.data;
  },

  async downloadPDF(id: number, filename: string): Promise<void> {
    const response = await axios.get(`${API_BASE_URL}/documents/${id}/download/pdf`, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async downloadMarkdown(id: number, filename: string): Promise<void> {
    const response = await axios.get(`${API_BASE_URL}/documents/${id}/download/markdown`, {
      responseType: 'blob',
    });

    // Create download link
    const mdFilename = filename.replace(/\.pdf$/i, '.md');
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', mdFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async deleteDocument(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/documents/${id}`);
  },

  async updateDocument(id: number, markdown_content: string): Promise<DocumentDetail> {
    const response = await axios.put<DocumentDetail>(
      `${API_BASE_URL}/documents/${id}`,
      { markdown_content }
    );
    return response.data;
  },

  async getVisualization(docId: number, page: number): Promise<VisualizationResponse> {
    const response = await axios.get<VisualizationResponse>(
      `${API_BASE_URL}/documents/${docId}/visualization`,
      { params: { page } }
    );
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOCORRECT
  // ═══════════════════════════════════════════════════════════════════════════

  async correctText(text: string): Promise<AutoCorrectResponse> {
    const response = await axios.post<AutoCorrectResponse>(
      `${API_BASE_URL}/autocorrect`,
      { text }
    );
    return response.data;
  },
};
