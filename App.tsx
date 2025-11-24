import React, { useEffect, useState } from 'react';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import AnalysisResultDisplay from './components/AnalysisResultDisplay';
import { analyzeProject, ensureGraphDiagrams } from './services/geminiService';
import { AnalysisResult, PrototypeArtifact } from './types';
import ProjectHistory from './components/ProjectHistory';
import {
  ProjectHistoryEntry,
  addProjectHistoryEntry,
  clearProjectHistory,
  deleteProjectHistoryEntry,
  exportHistoryToFile,
  loadProjectHistory,
  updateHistoryEntryPrototypes,
} from './services/projectHistoryService';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [history, setHistory] = useState<ProjectHistoryEntry[]>(() => loadProjectHistory());
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadProjectHistory());
  }, []);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setAnalysisResult(null);
    setError(null);
    setCurrentEntryId(null);
  };

  const handleAnalyzeClick = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const result = await analyzeProject(selectedFile, language);
      const normalizedResult = ensureGraphDiagrams(result);
      setAnalysisResult(normalizedResult);

      const entry: ProjectHistoryEntry = {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
        projectName: selectedFile.name.replace(/\.(zip|tar|gz)$/i, ''),
        fileName: selectedFile.name,
        language,
        analyzedAt: new Date().toISOString(),
        summary: result.overview.length > 180 ? `${result.overview.slice(0, 177)}...` : result.overview,
        analysisResult: normalizedResult,
        prototypes: [],
      };

      const updated = addProjectHistoryEntry(entry);
      setHistory(updated);
      setCurrentEntryId(entry.id);
    } catch (err: any)      {
      setError(err.message || "An unknown error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistorySelect = (entry: ProjectHistoryEntry) => {
    setAnalysisResult(ensureGraphDiagrams(entry.analysisResult));
    setLanguage(entry.language);
    setError(null);
    setCurrentEntryId(entry.id);
  };

  const handleHistoryDelete = (id: string) => {
    const updated = deleteProjectHistoryEntry(id);
    setHistory(updated);
    if (currentEntryId === id) {
      setCurrentEntryId(null);
      setAnalysisResult(null);
    }
  };

  const handleHistoryClear = () => {
    const updated = clearProjectHistory();
    setHistory(updated);
    setAnalysisResult(null);
    setCurrentEntryId(null);
  };

  const handleHistoryExport = () => {
    exportHistoryToFile(history);
  };

  const activeEntry = currentEntryId ? history.find((entry) => entry.id === currentEntryId) : null;

  const handlePrototypesChange = (next: PrototypeArtifact[]) => {
    if (!currentEntryId) return;
    const updatedHistory = history.map((entry) =>
      entry.id === currentEntryId ? { ...entry, prototypes: next } : entry
    );
    setHistory(updatedHistory);
    updateHistoryEntryPrototypes(currentEntryId, next);
  };

  return (
    <>
      {isLoading && <Loader />}
      <div className="min-h-screen text-white font-sans">
        <div className="mx-auto px-8 py-10" style={{ maxWidth: '1700px' }}>
          
          <header className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-500 animate-pulse" style={{'--tw-pulse-opacity': '0.8'} as React.CSSProperties}>
              Project Deconstructor
            </h1>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
              Upload your project's ZIP file and let CMC-Japan provide a comprehensive architectural analysis, from components to database schemas.
            </p>
          </header>

          <main>
            <div className="w-full space-y-8">
              <div className="futuristic-card p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <FileUpload 
                    onFileChange={handleFileChange}
                    onAnalyze={handleAnalyzeClick}
                    isLoading={isLoading}
                  />
                  
                  <div className="flex items-center gap-2">
                    <label htmlFor="language-select" className="text-slate-400 text-sm">Output Language:</label>
                    <select 
                      id="language-select"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    >
                      <option value="English">English</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Vietnamese">Vietnamese</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div className="futuristic-card p-4 bg-red-900/20 text-red-300 rounded-lg text-center">
                  <p><strong>Analysis Failed</strong></p>
                  <p>{error}</p>
                </div>
              )}

              {analysisResult && (
                <div className="futuristic-card p-4 sm:p-6">
                  <AnalysisResultDisplay
                    result={analysisResult}
                    language={language}
                    prototypes={activeEntry?.prototypes || []}
                    onPrototypesChange={handlePrototypesChange}
                  />
                </div>
              )}
            </div>
          </main>

          <ProjectHistory
            entries={history}
            onSelect={handleHistorySelect}
            onDelete={handleHistoryDelete}
            onClear={handleHistoryClear}
            onExport={handleHistoryExport}
          />
          
          <footer className="text-center mt-16 text-slate-500 text-sm">
              <p>Powered by CMC-Japan</p>
          </footer>

        </div>
      </div>
    </>
  );
}

export default App;
