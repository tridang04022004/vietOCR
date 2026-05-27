import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, ArrowLeft, CheckCircle, Loader2, Eye, EyeOff, Edit, Layers } from 'lucide-react';
import { apiClient } from '../api/client';
import type { DocumentDetailResponse } from '../types';
import { PipelineVisualization } from './PipelineVisualization';

type ViewMode = 'markdown' | 'visualization' | 'raw';

// Helper function to compute word-level differences
function computeWordDiff(original: string, corrected: string): { originalWords: Array<{text: string, changed: boolean}>, correctedWords: Array<{text: string, changed: boolean}> } {
  const originalWords = original.split(/(\s+)/);
  const correctedWords = corrected.split(/(\s+)/);

  const originalResult: Array<{text: string, changed: boolean}> = [];
  const correctedResult: Array<{text: string, changed: boolean}> = [];

  let i = 0, j = 0;

  while (i < originalWords.length || j < correctedWords.length) {
    if (i >= originalWords.length) {
      correctedResult.push({ text: correctedWords[j], changed: true });
      j++;
    } else if (j >= correctedWords.length) {
      originalResult.push({ text: originalWords[i], changed: true });
      i++;
    } else if (originalWords[i] === correctedWords[j]) {
      originalResult.push({ text: originalWords[i], changed: false });
      correctedResult.push({ text: correctedWords[j], changed: false });
      i++;
      j++;
    } else {
      originalResult.push({ text: originalWords[i], changed: true });
      correctedResult.push({ text: correctedWords[j], changed: true });
      i++;
      j++;
    }
  }

  return { originalWords: originalResult, correctedWords: correctedResult };
}

export function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('markdown');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showComparison, setShowComparison] = useState(true);

  // Compute word-level diff for highlighting
  const diff = useMemo(() => {
    if (!document?.corrected_markdown_content) return null;
    return computeWordDiff(document.markdown_content, document.corrected_markdown_content);
  }, [document?.markdown_content, document?.corrected_markdown_content]);

  useEffect(() => {
    loadDocument();
  }, [id]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError('');
      const doc = await apiClient.getDocument(Number(id));
      setDocument(doc);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!document) return;
    await navigator.clipboard.writeText(document.markdown_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!document) return;
    try {
      await apiClient.downloadPDF(document.id);
    } catch (err: any) {
      alert('Failed to download PDF: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDownloadMarkdown = async () => {
    if (!document) return;
    try {
      await apiClient.downloadMarkdown(document.id);
    } catch (err: any) {
      alert('Failed to download Markdown: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEdit = () => {
    if (!document) return;
    setEditedContent(document.markdown_content);
    setIsEditing(true);
    setViewMode('markdown');
  };

  const handleSave = async () => {
    if (!document) return;
    setIsSaving(true);
    try {
      const updated = await apiClient.updateDocument(document.id, editedContent);
      setDocument(updated);
      setIsEditing(false);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      alert('Failed to save: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setIsEditing(false);
    setEditedContent('');
    setHasUnsavedChanges(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    setHasUnsavedChanges(e.target.value !== document?.markdown_content);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
              <p className="text-lg text-gray-600">Loading document...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-xl p-12 border border-blue-100 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="p-8 bg-red-100 rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center">
                <span className="text-5xl">⚠️</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Document Not Found</h2>
              <p className="text-lg text-gray-600 mb-8">{error || 'The document you are looking for does not exist.'}</p>
              <button
                onClick={() => navigate('/library')}
                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium rounded-xl transition-colors shadow-lg hover:shadow-xl"
              >
                Back to Library
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100 pb-12">
      <div className={`container mx-auto px-4 py-8 ${showComparison && document?.corrected_markdown_content ? 'max-w-[98%]' : 'max-w-5xl'}`}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/library')}
          className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 mb-8 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Library</span>
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border border-blue-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">{document.filename}</h1>
          <div className="flex flex-wrap gap-6 text-base text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="font-medium">{document.page_count} page{document.page_count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
              <span className="font-medium">Processed in {document.processing_time}s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="font-medium">{new Date(document.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          </div>
        </div>

        {/* Toolbar Card - Sticky */}
        <div className="sticky top-4 z-10 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-blue-100 backdrop-blur-sm bg-opacity-95">
            {!isEditing ? (
              <div className="p-6">
                {/* View Mode Tabs */}
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                    <button
                      onClick={() => setViewMode('markdown')}
                      className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                        viewMode === 'markdown'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Eye className="w-4 h-4 inline mr-2" />
                      Markdown
                    </button>
                    <button
                      onClick={() => setViewMode('visualization')}
                      className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                        viewMode === 'visualization'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Layers className="w-4 h-4 inline mr-2" />
                      Visualization
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                        viewMode === 'raw'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <EyeOff className="w-4 h-4 inline mr-2" />
                      Raw
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {document.corrected_markdown_content && (
                      <>
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium border ${
                            showComparison
                              ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <Layers className="w-4 h-4" />
                          <span>{showComparison ? 'Hide' : 'Show'} Comparison</span>
                        </button>
                        <div className="w-px h-8 bg-gray-200"></div>
                      </>
                    )}

                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-all text-sm font-medium border border-gray-200"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>

                    <div className="w-px h-8 bg-gray-200"></div>

                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-all text-sm font-medium border border-gray-200"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all text-sm font-medium shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={handleDownloadMarkdown}
                      className="flex items-center gap-2 px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-all text-sm font-medium shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Markdown</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-700 font-medium">Editing Mode - Split View</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-all text-sm font-medium border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          {!isEditing ? (
            <div className="p-12">
              {viewMode === 'markdown' ? (
                showComparison && document.corrected_markdown_content ? (
                  // Two panels side-by-side for comparison
                  <div className="grid grid-cols-2 gap-6">
                    {/* Original Panel */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-200 shadow-lg">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-blue-300">
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                        <h3 className="text-xl font-bold text-gray-900">Original OCR</h3>
                      </div>
                      <div className="bg-white rounded-xl p-6 shadow-inner max-h-[calc(100vh-400px)] overflow-y-auto">
                        <div className="prose prose-sm max-w-none
                          prose-headings:font-bold prose-headings:text-gray-900
                          prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-6 prose-h1:pb-2 prose-h1:border-b-4 prose-h1:border-blue-500
                          prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-5 prose-h2:pb-2 prose-h2:border-b-2 prose-h2:border-blue-300
                          prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-4 prose-h3:text-blue-600
                          prose-p:text-gray-700 prose-p:text-sm prose-p:leading-relaxed prose-p:mb-3
                          prose-table:border-collapse prose-table:w-full prose-table:my-4 prose-table:text-xs
                          prose-th:bg-gradient-to-r prose-th:from-blue-500 prose-th:to-blue-600 prose-th:text-white prose-th:border prose-th:border-blue-600 prose-th:p-2 prose-th:text-left prose-th:font-bold
                          prose-td:border prose-td:border-gray-300 prose-td:p-2 prose-td:text-gray-700
                          prose-tr:even:bg-blue-50
                        ">
                          {diff ? (
                            <div className="whitespace-pre-wrap text-sm">
                              {diff.originalWords.map((word, idx) => (
                                <span
                                  key={idx}
                                  className={word.changed ? 'bg-red-200 px-1 rounded' : ''}
                                >
                                  {word.text}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <ReactMarkdown>{document.markdown_content}</ReactMarkdown>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Corrected Panel */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border-2 border-green-200 shadow-lg">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-green-300">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        <h3 className="text-xl font-bold text-gray-900">Auto-Corrected</h3>
                        <span className="ml-auto px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                          ✓ Corrected
                        </span>
                      </div>
                      <div className="bg-white rounded-xl p-6 shadow-inner max-h-[calc(100vh-400px)] overflow-y-auto">
                        <div className="prose prose-sm max-w-none
                          prose-headings:font-bold prose-headings:text-gray-900
                          prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-6 prose-h1:pb-2 prose-h1:border-b-4 prose-h1:border-green-500
                          prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-5 prose-h2:pb-2 prose-h2:border-b-2 prose-h2:border-green-300
                          prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-4 prose-h3:text-green-600
                          prose-p:text-gray-700 prose-p:text-sm prose-p:leading-relaxed prose-p:mb-3
                          prose-table:border-collapse prose-table:w-full prose-table:my-4 prose-table:text-xs
                          prose-th:bg-gradient-to-r prose-th:from-green-500 prose-th:to-green-600 prose-th:text-white prose-th:border prose-th:border-green-600 prose-th:p-2 prose-th:text-left prose-th:font-bold
                          prose-td:border prose-td:border-gray-300 prose-td:p-2 prose-td:text-gray-700
                          prose-tr:even:bg-green-50
                        ">
                          {diff ? (
                            <div className="whitespace-pre-wrap text-sm">
                              {diff.correctedWords.map((word, idx) => (
                                <span
                                  key={idx}
                                  className={word.changed ? 'bg-green-200 px-1 rounded font-semibold' : ''}
                                >
                                  {word.text}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <ReactMarkdown>{document.corrected_markdown_content}</ReactMarkdown>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Single column view (original only)
                  <div className="prose prose-lg max-w-none
                    prose-headings:font-bold prose-headings:text-gray-900
                    prose-h1:text-5xl prose-h1:mb-8 prose-h1:mt-10 prose-h1:pb-4 prose-h1:border-b-4 prose-h1:border-blue-500
                    prose-h2:text-4xl prose-h2:mb-6 prose-h2:mt-9 prose-h2:pb-3 prose-h2:border-b-2 prose-h2:border-blue-300
                    prose-h3:text-3xl prose-h3:mb-5 prose-h3:mt-8 prose-h3:text-blue-600
                    prose-h4:text-2xl prose-h4:mb-4 prose-h4:mt-6 prose-h4:text-blue-600
                    prose-h5:text-xl prose-h5:mb-3 prose-h5:mt-5 prose-h5:text-blue-600
                    prose-h6:text-lg prose-h6:mb-3 prose-h6:mt-4 prose-h6:text-blue-600 prose-h6:font-semibold
                    prose-p:text-gray-700 prose-p:text-lg prose-p:leading-relaxed prose-p:mb-6
                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                    prose-strong:text-gray-900 prose-strong:font-bold
                    prose-em:text-gray-700 prose-em:italic
                    prose-ul:my-6 prose-ol:my-6
                    prose-li:text-gray-700 prose-li:text-lg prose-li:leading-relaxed prose-li:my-2
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-6 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:bg-blue-50
                    prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-base prose-code:font-semibold
                    prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-6 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:my-6
                    prose-table:border-collapse prose-table:w-full prose-table:my-8
                    prose-th:bg-gradient-to-r prose-th:from-blue-500 prose-th:to-blue-600 prose-th:text-white prose-th:border prose-th:border-blue-600 prose-th:p-4 prose-th:text-left prose-th:font-bold prose-th:text-base
                    prose-td:border prose-td:border-gray-300 prose-td:p-4 prose-td:text-gray-700
                    prose-tr:even:bg-blue-50
                    prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8
                    prose-hr:border-gray-300 prose-hr:my-10 prose-hr:border-t-2
                  ">
                    <ReactMarkdown>{document.markdown_content}</ReactMarkdown>
                  </div>
                )
              ) : viewMode === 'visualization' ? (
                <div>
                  {/* Page selector for multi-page documents */}
                  {document.page_count > 1 && (
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-gray-700 font-medium">
                        Page {currentPage} of {document.page_count}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(document.page_count, currentPage + 1))}
                        disabled={currentPage === document.page_count}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                  <PipelineVisualization
                    documentId={document.id}
                    pageNumber={currentPage}
                    totalPages={document.page_count}
                  />
                </div>
              ) : (
                <pre className="bg-gradient-to-br from-blue-50 to-pink-50 p-8 rounded-xl overflow-x-auto text-base leading-relaxed border border-blue-100">
                  <code className="text-gray-800 font-mono">{document.markdown_content}</code>
                </pre>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              {/* Left: Editor */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Editor</h3>
                <textarea
                  value={editedContent}
                  onChange={handleContentChange}
                  className="w-full h-[calc(100vh-300px)] p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Edit markdown content..."
                />
              </div>

              {/* Right: Live Preview */}
              <div className="p-6 overflow-y-auto h-[calc(100vh-300px)]">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Preview</h3>
                <div className="prose prose-lg max-w-none
                  prose-headings:font-bold prose-headings:text-gray-900
                  prose-h1:text-5xl prose-h1:mb-8 prose-h1:mt-10 prose-h1:pb-4 prose-h1:border-b-4 prose-h1:border-blue-500
                  prose-h2:text-4xl prose-h2:mb-6 prose-h2:mt-9 prose-h2:pb-3 prose-h2:border-b-2 prose-h2:border-blue-300
                  prose-h3:text-3xl prose-h3:mb-5 prose-h3:mt-8 prose-h3:text-blue-600
                  prose-h4:text-2xl prose-h4:mb-4 prose-h4:mt-6 prose-h4:text-blue-600
                  prose-h5:text-xl prose-h5:mb-3 prose-h5:mt-5 prose-h5:text-blue-600
                  prose-h6:text-lg prose-h6:mb-3 prose-h6:mt-4 prose-h6:text-blue-600 prose-h6:font-semibold
                  prose-p:text-gray-700 prose-p:text-lg prose-p:leading-relaxed prose-p:mb-6
                  prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                  prose-strong:text-gray-900 prose-strong:font-bold
                  prose-em:text-gray-700 prose-em:italic
                  prose-ul:my-6 prose-ol:my-6
                  prose-li:text-gray-700 prose-li:text-lg prose-li:leading-relaxed prose-li:my-2
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-6 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:bg-blue-50
                  prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-base prose-code:font-semibold
                  prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-6 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:my-6
                  prose-table:border-collapse prose-table:w-full prose-table:my-8
                  prose-th:bg-gradient-to-r prose-th:from-blue-500 prose-th:to-blue-600 prose-th:text-white prose-th:border prose-th:border-blue-600 prose-th:p-4 prose-th:text-left prose-th:font-bold prose-th:text-base
                  prose-td:border prose-td:border-gray-300 prose-td:p-4 prose-td:text-gray-700
                  prose-tr:even:bg-blue-50
                  prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8
                  prose-hr:border-gray-300 prose-hr:my-10 prose-hr:border-t-2
                ">
                  <ReactMarkdown>{editedContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
