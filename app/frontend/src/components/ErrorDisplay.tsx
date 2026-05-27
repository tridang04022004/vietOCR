import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 border border-blue-100">
      <div className="flex flex-col items-center space-y-6">
        <div className="p-6 bg-red-100 rounded-full">
          <AlertTriangle className="w-16 h-16 text-red-600" />
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">
            Processing Failed
          </h3>
          <p className="text-gray-600 mb-4">
            We encountered an error while processing your document
          </p>
        </div>

        <div className="w-full max-w-md p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-mono break-words">
            {error}
          </p>
        </div>

        <button
          onClick={onRetry}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
