import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { DocumentCard } from './DocumentCard';
import { apiClient } from '../api/client';
import type { Document } from '../types';

export function Library() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocuments = async (query: string = '') => {
    setLoading(true);
    try {
      const response = await apiClient.getDocuments(query);
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(searchQuery);
  }, [searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleDocumentDelete = () => {
    // Refetch documents after deletion
    fetchDocuments(searchQuery);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading documents...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Document Library
          </h1>
          <p className="text-gray-600">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} found
          </p>
        </div>

        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              {searchQuery ? 'No documents found' : 'No documents yet'}
            </h2>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Upload your first document to get started'}
            </p>
            {!searchQuery && (
              <a
                href="/upload"
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Upload Document
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDelete={handleDocumentDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
