import { useState, useMemo } from 'react';
import { Wand2, Copy, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';

// Helper function to compute word-level differences
function computeWordDiff(original: string, corrected: string): Array<{ text: string; changed: boolean }> {
  const originalWords = original.split(/(\s+)/);
  const correctedWords = corrected.split(/(\s+)/);

  const result: Array<{ text: string; changed: boolean }> = [];
  const maxLen = Math.max(originalWords.length, correctedWords.length);

  for (let i = 0; i < maxLen; i++) {
    const origWord = originalWords[i] || '';
    const corrWord = correctedWords[i] || '';

    if (corrWord) {
      // Check if this word was changed
      const changed = origWord !== corrWord && !/^\s+$/.test(corrWord);
      result.push({ text: corrWord, changed });
    }
  }

  return result;
}

export function AutoCorrectPage() {
  const [inputText, setInputText] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Compute word-level diff for highlighting
  const highlightedWords = useMemo(() => {
    if (!inputText || !correctedText) return [];
    return computeWordDiff(inputText, correctedText);
  }, [inputText, correctedText]);

  const handleCorrect = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to correct');
      return;
    }

    setIsProcessing(true);
    setError('');
    setCorrectedText('');
    setProcessingTime(null);

    try {
      const response = await apiClient.correctText(inputText);
      setCorrectedText(response.corrected);
      setProcessingTime(response.processing_time);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to correct text');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setCorrectedText('');
    setProcessingTime(null);
    setError('');
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!correctedText) return;
    await navigator.clipboard.writeText(correctedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = inputText.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Vietnamese Text Correction</h1>
          <p className="text-gray-600">
            Type or paste Vietnamese text with spelling errors and get corrected output
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-4 flex items-center gap-4">
          <button
            onClick={handleCorrect}
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-pink-500 text-white rounded-lg hover:from-blue-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Correcting...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Correct Text</span>
              </>
            )}
          </button>

          <button
            onClick={handleClear}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md border border-gray-200"
          >
            <Trash2 className="w-5 h-5" />
            <span>Clear</span>
          </button>

          {correctedText && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md border border-gray-200"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span>Copy Result</span>
                </>
              )}
            </button>
          )}

          {processingTime !== null && (
            <div className="ml-auto text-sm text-gray-600">
              Processing time: <span className="font-semibold">{processingTime.toFixed(3)}s</span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white rounded-lg shadow-lg border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Input Text</h2>
              <p className="text-blue-100 text-sm mt-1">
                {charCount} characters {charCount > 10000 && '(max 10,000)'}
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste Vietnamese text here..."
                className="w-full h-[calc(100vh-400px)] min-h-[400px] p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none font-mono text-gray-800"
                maxLength={10000}
              />
            </div>
          </div>

          {/* Output Panel */}
          <div className="bg-white rounded-lg shadow-lg border border-pink-100 overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-pink-400 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Corrected Text</h2>
              <p className="text-pink-100 text-sm mt-1">
                {correctedText ? `${correctedText.length} characters` : 'Waiting for correction...'}
              </p>
            </div>
            <div className="p-6">
              {isProcessing ? (
                <div className="flex items-center justify-center h-[calc(100vh-400px)] min-h-[400px]">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
                    <p className="text-gray-600">Correcting your text...</p>
                  </div>
                </div>
              ) : correctedText ? (
                <div className="w-full h-[calc(100vh-400px)] min-h-[400px] p-4 bg-pink-50 border border-pink-200 rounded-lg overflow-auto font-mono text-gray-800 whitespace-pre-wrap">
                  {highlightedWords.map((word, idx) => (
                    <span
                      key={idx}
                      className={word.changed ? 'bg-yellow-200 px-1 rounded font-semibold' : ''}
                      title={word.changed ? 'This word was corrected' : ''}
                    >
                      {word.text}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[calc(100vh-400px)] min-h-[400px] text-gray-400">
                  <div className="text-center">
                    <Wand2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Click "Correct Text" to see results here</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Usage Tips */}
        <div className="mt-8 bg-white rounded-lg shadow-md border border-blue-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Usage Tips</h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span>This tool corrects Vietnamese spelling errors using a transformer model</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span>Works best with complete sentences and proper Vietnamese text</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span>Maximum input length is 10,000 characters</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span>Processing time depends on text length and server load</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span><span className="bg-yellow-200 px-1 rounded font-semibold">Corrected words</span> are highlighted in yellow</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
