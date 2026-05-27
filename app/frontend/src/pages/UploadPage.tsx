import { useState } from 'react';
import { FileUpload } from '../components/FileUpload';
import { BatchUpload } from '../components/BatchUpload';
import { ProcessingStatus } from '../components/ProcessingStatus';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { apiClient } from '../api/client';
import type { ProcessingResponse } from '../types';

type AppState = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
type UploadMode = 'single' | 'batch';

export function UploadPage() {
  const [uploadMode, setUploadMode] = useState<UploadMode>('single');
  const [state, setState] = useState<AppState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResponse | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = async (file: File) => {
    try {
      setState('uploading');
      setUploadProgress(0);
      setError('');

      const response = await apiClient.uploadPDF(file, (progress) => {
        setUploadProgress(progress);
        if (progress === 100) {
          setState('processing');
        }
      });

      if (response.success) {
        setResult(response);
        setState('complete');
      } else {
        setError(response.error || 'Processing failed');
        setState('error');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Upload failed';
      setError(errorMessage);
      setState('error');
    }
  };

  const handleBatchComplete = () => {
    // Optionally show a success message or redirect
    console.log('Batch upload completed');
  };

  const handleReset = () => {
    setState('idle');
    setUploadProgress(0);
    setResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Upload Document
          </h1>
          <p className="text-gray-600">
            Upload PDF documents to extract structured content
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          {/* Mode Toggle */}
          {state === 'idle' && (
            <div className="mb-8 flex justify-center">
              <div className="bg-white rounded-xl shadow-md p-2 inline-flex gap-2 border border-blue-100">
                <button
                  onClick={() => setUploadMode('single')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    uploadMode === 'single'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Single Upload
                </button>
                <button
                  onClick={() => setUploadMode('batch')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    uploadMode === 'batch'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Batch Upload
                </button>
              </div>
            </div>
          )}

          {/* Single Upload Mode */}
          {uploadMode === 'single' && (
            <>
              {state === 'idle' && <FileUpload onFileSelect={handleFileSelect} />}

              {(state === 'uploading' || state === 'processing') && (
                <ProcessingStatus
                  state={state}
                  uploadProgress={uploadProgress}
                />
              )}

              {state === 'complete' && result && (
                <MarkdownViewer
                  markdown={result.markdown}
                  pageCount={result.page_count}
                  processingTime={result.processing_time}
                  onReset={handleReset}
                />
              )}

              {state === 'error' && (
                <ErrorDisplay error={error} onRetry={handleReset} />
              )}
            </>
          )}

          {/* Batch Upload Mode */}
          {uploadMode === 'batch' && state === 'idle' && (
            <BatchUpload onComplete={handleBatchComplete} />
          )}
        </main>

        <footer className="text-center mt-12 text-sm text-gray-500">
          <p>Powered by YOLOv11, DocTR, and VietOCR</p>
        </footer>
      </div>
    </div>
  );
}
