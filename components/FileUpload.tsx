import React, { useRef } from 'react';
import { UploadIcon, PlayIcon } from './Icons';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, onAnalyze, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileChange(file);
    } else {
      setFileName(null);
      onFileChange(null);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".zip"
        className="hidden"
      />
      <button
        onClick={handleButtonClick}
        disabled={isLoading}
        className="w-full sm:w-auto flex items-center justify-center px-6 py-3 rounded-md text-gray-300 futuristic-button-secondary disabled:opacity-50"
      >
        <UploadIcon className="h-5 w-5 mr-2" />
        <span className="truncate max-w-[200px]">{fileName || "Select Project ZIP"}</span>
      </button>
      <button
        onClick={onAnalyze}
        disabled={isLoading || !fileName}
        className="w-full sm:w-auto flex items-center justify-center px-8 py-3 text-white font-semibold rounded-md transition-all duration-300 transform hover:scale-105 futuristic-button"
      >
        <PlayIcon className="h-5 w-5 mr-2" />
        {isLoading ? "Analyzing..." : "Run Analysis"}
      </button>
    </div>
  );
};

export default FileUpload;