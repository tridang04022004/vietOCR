import { Loader2, CheckCircle, Upload, Cog } from 'lucide-react';

interface ProcessingStatusProps {
  state: 'uploading' | 'processing';
  uploadProgress: number;
}

export function ProcessingStatus({ state, uploadProgress }: ProcessingStatusProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 border border-blue-100">
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <div className="p-6 bg-blue-100 rounded-full">
            {state === 'uploading' ? (
              <Upload className="w-16 h-16 text-blue-500" />
            ) : (
              <Cog className="w-16 h-16 text-blue-500 animate-spin" />
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-lg">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">
            {state === 'uploading' ? 'Uploading PDF...' : 'Processing Document...'}
          </h3>
          <p className="text-gray-600">
            {state === 'uploading'
              ? 'Transferring your file to the server'
              : 'Extracting text and structure from your document'}
          </p>
        </div>

        {state === 'uploading' && (
          <div className="w-full max-w-md">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Upload Progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {state === 'processing' && (
          <div className="space-y-3 w-full max-w-md">
            <ProcessingStep label="Layout Detection" completed />
            <ProcessingStep label="Table Extraction" completed />
            <ProcessingStep label="Line Segmentation" active />
            <ProcessingStep label="OCR Recognition" />
            <ProcessingStep label="Markdown Compilation" />
          </div>
        )}
      </div>
    </div>
  );
}

interface ProcessingStepProps {
  label: string;
  completed?: boolean;
  active?: boolean;
}

function ProcessingStep({ label, completed, active }: ProcessingStepProps) {
  return (
    <div className="flex items-center space-x-3">
      <div className={`
        flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
        ${completed ? 'bg-green-500' : active ? 'bg-blue-500' : 'bg-gray-300'}
      `}>
        {completed ? (
          <CheckCircle className="w-4 h-4 text-white" />
        ) : active ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <div className="w-2 h-2 bg-white rounded-full" />
        )}
      </div>
      <span className={`
        text-sm
        ${completed || active ? 'text-gray-800 font-medium' : 'text-gray-500'}
      `}>
        {label}
      </span>
    </div>
  );
}
