import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Trash2, Clock, Calendar, FileType, Eye } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Document } from '../types';

interface DocumentCardProps {
  document: Document;
  onDelete: () => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      await apiClient.downloadPDF(document.id, document.filename);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setLoading(true);
    try {
      await apiClient.downloadMarkdown(document.id, document.filename);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await apiClient.deleteDocument(document.id);
      onDelete();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-blue-100">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <FileText className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 truncate">
              {document.filename}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <FileType className="w-4 h-4" />
                {document.page_count} {document.page_count === 1 ? 'page' : 'pages'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {document.processing_time.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {document.markdown_preview && (
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-gray-600 line-clamp-3">
          {document.markdown_preview}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(document.created_at)}
        </span>
        <span>{formatFileSize(document.file_size)}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/library/${document.id}`)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" />
          View
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          PDF
        </button>

        <button
          onClick={handleDownloadMarkdown}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          MD
        </button>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
