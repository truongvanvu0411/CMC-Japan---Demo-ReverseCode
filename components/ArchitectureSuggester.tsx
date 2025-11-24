import React, { useState } from 'react';
import { getArchitectureSuggestion } from '../services/geminiService';
import { SparklesIcon } from './Icons';
import { ArchitectureSuggestion } from '../types';
import Diagram from './Diagram';

interface ArchitectureSuggesterProps {
    overview: string;
    language: string;
    suggestion: ArchitectureSuggestion | null;
    onSuggestionChange: (suggestion: ArchitectureSuggestion | null) => void;
}

const ArchitectureSuggester: React.FC<ArchitectureSuggesterProps> = ({ overview, language, suggestion, onSuggestionChange }) => {
    const [targetTech, setTargetTech] = useState('Java-Spring');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const techOptions = [
        { value: 'Java-Spring', label: 'Java (Spring Boot)' },
        { value: 'C# .NET', label: 'C# (.NET)' },
        { value: 'Python-Django', label: 'Python (Django)' },
        { value: 'NodeJS-Express', label: 'Node.js (Express)' },
    ];

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        onSuggestionChange(null);
        try {
            const result = await getArchitectureSuggestion(overview, targetTech, language);
            onSuggestionChange(result);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-4">
            <h3 className="text-xl font-semibold text-sky-400">Architecture Improvement Suggestion</h3>
            <p className="text-slate-300">
                Select a modern technology stack to see a suggested architectural improvement plan for this project.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <select 
                    value={targetTech}
                    onChange={(e) => setTargetTech(e.target.value)}
                    className="w-full sm:w-auto bg-slate-700 border border-slate-600 text-white rounded-md px-4 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    disabled={isLoading}
                >
                    {techOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-500 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg futuristic-button"
                >
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    {isLoading ? 'Generating...' : 'Suggest Improvement'}
                </button>
            </div>

            {isLoading && (
                <div className="flex flex-col items-center text-slate-400 pt-4">
                    <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-cyan-400"></div>
                    <p className="mt-2 text-sm">Generating suggestion with CMC-Japan...</p>
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
                    <p><strong>Suggestion Failed:</strong> {error}</p>
                </div>
            )}
            {suggestion && (
                <div className="mt-6 space-y-8">
                    {/* 1. Business Process Improvement */}
                    <div>
                    <h4 className="text-xl font-semibold text-sky-300 mb-3">1. Business Process Improvement</h4>
                    <div className="space-y-4">
                        <Diagram id="business-improve-diagram" chart={suggestion.businessProcess.diagram} />
                        <div className="p-4 bg-slate-900/50 rounded-lg text-slate-300 whitespace-pre-wrap">{suggestion.businessProcess.explanation}</div>
                    </div>
                    </div>

                    {/* 2. Overall Architecture Improvement */}
                    <div>
                    <h4 className="text-xl font-semibold text-sky-300 mb-3">2. Overall Architecture Improvement</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h5 className="text-center font-bold text-slate-400 mb-2">As-Is Architecture</h5>
                            <Diagram id="arch-asis-diagram" chart={suggestion.overallArchitecture.asIsDiagram} />
                        </div>
                        <div>
                            <h5 className="text-center font-bold text-slate-400 mb-2">To-Be Architecture ({targetTech})</h5>
                            <Diagram id="arch-tobe-diagram" chart={suggestion.overallArchitecture.toBeDiagram} />
                        </div>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-lg text-slate-300 whitespace-pre-wrap">{suggestion.overallArchitecture.explanation}</div>
                    </div>
                    </div>

                    {/* 3. Specific Improvement Points */}
                    <div>
                    <h4 className="text-xl font-semibold text-sky-300 mb-3">3. Specific Improvement Points</h4>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h5 className="font-bold text-slate-400 mb-2">As-Is (Problem)</h5>
                                <p className="text-slate-300 whitespace-pre-wrap">{suggestion.specificPoints.asIs}</p>
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-400 mb-2">To-Be (Solution)</h5>
                                <p className="text-slate-300 whitespace-pre-wrap">{suggestion.specificPoints.toBe}</p>
                            </div>
                        </div>
                        <hr className="my-4 border-slate-700" />
                        <div>
                            <h5 className="font-bold text-slate-400 mb-2">Explanation &amp; Benefits</h5>
                            <p className="text-slate-300 whitespace-pre-wrap">{suggestion.specificPoints.explanation}</p>
                        </div>
                    </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArchitectureSuggester;