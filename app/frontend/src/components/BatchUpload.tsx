import { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { apiClient } from '../api/client';

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  documentId?: number;
  error?: string;
}

interface BatchUploadProps {
  onComplete: () => void;
}

export function BatchUpload({ onComplete }: BatchUploadProps) {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const fileStatuses: FileUploadStatus[] = newFiles.map((file) => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...fileStatuses]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const processQueue = async () => {
    setIsProcessing(true);

    // Process files one by one
    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];

      // Skip already completed or errored files
      if (fileStatus.status === 'completed' || fileStatus.status === 'error') {
        continue;
      }

      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'uploading', progress: 0 } : f
          )
        );

        // Upload file
        const result = await apiClient.uploadPDF(fileStatus.file, (progress) => {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, progress: progress } : f
            )
          );

          // When upload reaches 100%, switch to processing
          if (progress === 100) {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, status: 'processing' } : f
              )
            );
          }
        });

        // Check if processing was successful
        if (result.success) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: 'completed',
                    progress: 100,
                    documentId: result.document_id,
                  }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: 'error',
                    error: result.error || 'Processing failed',
                  }
                : f
            )
          );
        }
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'error',
                  error: err.response?.data?.detail || err.message || 'Upload failed',
                }
              : f
          )
        );
      }
    }

    setIsProcessing(false);
    onComplete();
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const getStatusIcon = (status: FileUploadStatus['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="w-5 h-5 text-gray-400" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (fileStatus: FileUploadStatus) => {
    switch (fileStatus.status) {
      case 'pending':
        return 'Waiting...';
      case 'uploading':
        return `Uploading ${fileStatus.progress}%`;
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return fileStatus.error || 'Error';
    }
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const canProcess = files.length > 0 && !isProcessing;

  return (
    <div className="space-y-6">
      {/* Drop Zone - Matching FileUpload component style */}
      <div className="bg-white rounded-lg shadow-lg p-8 border border-blue-100">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-blue-100 rounded-full">
              <Upload className="w-12 h-12 text-blue-500" />
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {isDragging ? 'Drop your files here' : 'Upload PDF Documents'}
              </h3>
              <p className="text-gray-600 mb-4">
                Drag and drop or click to browse
              </p>
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="batch-file-input"
                disabled={isProcessing}
              />
              <span className={`inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-lg transition-colors ${
                isProcessing
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-blue-600'
              }`}>
                <Upload className="w-5 h-5 mr-2" />
                Select PDF Files
              </span>
            </label>

            <p className="text-sm text-gray-500">
              Maximum file size: 10MB per file
            </p>
          </div>
        </div>
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-blue-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-400 to-pink-400 p-6 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-2xl font-semibold mb-1">Upload Queue</h3>
                <p className="text-blue-50">
                  {files.length} file{files.length !== 1 ? 's' : ''} • {completedCount} completed • {errorCount} failed
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearCompleted}
                  disabled={completedCount === 0 || isProcessing}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Completed
                </button>
                <button
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* File List */}
          <div className="max-h-96 overflow-y-auto">
            {files.map((fileStatus, index) => (
              <div
                key={index}
                className="p-6 border-b border-gray-200 last:border-b-0 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(fileStatus.status)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {fileStatus.file.name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB • {getStatusText(fileStatus)}
                    </p>

                    {/* Progress Bar */}
                    {(fileStatus.status === 'uploading' || fileStatus.status === 'processing') && (
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${fileStatus.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {fileStatus.status === 'error' && fileStatus.error && (
                      <p className="text-sm text-red-600 mt-2">
                        {fileStatus.error}
                      </p>
                    )}
                  </div>

                  {/* Remove Button */}
                  {fileStatus.status === 'pending' && !isProcessing && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Button */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <button
              onClick={processQueue}
              disabled={!canProcess}
              className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                canProcess
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing {completedCount + 1} of {files.length}...
                </span>
              ) : (
                `Process ${files.length} File${files.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
