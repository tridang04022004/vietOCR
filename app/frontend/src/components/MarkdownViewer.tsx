import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Eye, EyeOff, CheckCircle, RotateCcw } from 'lucide-react';

interface MarkdownViewerProps {
  markdown: string;
  pageCount: number;
  processingTime: number;
  onReset: () => void;
}

export function MarkdownViewer({ markdown, pageCount, processingTime, onReset }: MarkdownViewerProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-output-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-blue-100">
      <div className="bg-gradient-to-r from-blue-400 to-pink-400 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8" />
            <div>
              <h3 className="text-2xl font-semibold">Processing Complete!</h3>
              <p className="text-blue-50 text-sm">
                {pageCount} page{pageCount !== 1 ? 's' : ''} processed in {processingTime}s
              </p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Document</span>
          </button>
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showPreview
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Preview
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !showPreview
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <EyeOff className="w-4 h-4 inline mr-2" />
              Raw
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-h-[600px] overflow-y-auto">
        {showPreview ? (
          <div className="prose max-w-none">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        ) : (
          <pre className="bg-blue-50 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="text-gray-800">{markdown}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
