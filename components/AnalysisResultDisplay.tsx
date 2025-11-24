import React, { useEffect, useState } from 'react';
import { AnalysisResult, ArchitectureSuggestion, ComponentInfo, PrototypeArtifact, ScreenDescription, TechnologyInfo } from '../types';
import Diagram from './Diagram';
import { rebuildScreenUI } from '../services/geminiService';
import { SparklesIcon, FullscreenIcon, RefreshIcon, ExcelIcon } from './Icons';
import ArchitectureSuggester from './ArchitectureSuggester';
import { exportToExcel } from '../services/exportService';
import { BusinessFlowFallback, ScreenTransitionFallback } from './FallbackFlow';
import PrototypeBuilder from './PrototypeBuilder';


interface AnalysisResultDisplayProps {
  result: AnalysisResult;
  language: string;
  prototypes: PrototypeArtifact[];
  onPrototypesChange: (prototypes: PrototypeArtifact[]) => void;
}

const Section: React.FC<{ id?: string; title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ id, title, children, action }) => (
    <div id={id} className="futuristic-card p-6 scroll-mt-28">
        <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-cyan-400 border-b border-cyan-700/50 pb-2" style={{textShadow: '0 0 5px rgba(56, 189, 248, 0.5)'}}>{title}</h2>
            {action && <div>{action}</div>}
        </div>
        {children}
    </div>
);

const ScreenDetail: React.FC<{ screen: ScreenDescription; language: string; }> = ({ screen, language }) => {
    const normalizeHtmlForPreview = (html: string) => {
        if (!html) return html;
        let output = html;
        const hasCharset = /<meta[^>]*charset=/i.test(output);
        if (!hasCharset) {
            if (/<head[^>]*>/i.test(output)) {
                output = output.replace(/<head[^>]*>/i, (match) => `${match}<meta charset="UTF-8">`);
            } else {
                output = `<head><meta charset="UTF-8"></head>${output}`;
            }
        }
        return output;
    };

    const [rebuiltHtml, setRebuiltHtml] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState(0);

    const handleRebuildClick = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const html = await rebuildScreenUI(screen, language);
            const normalized = normalizeHtmlForPreview(html);
            setRebuiltHtml(normalized);
            setPreviewKey((key) => key + 1);
        } catch (e: any) {
            setError(e.message || "Failed to rebuild UI.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!rebuiltHtml || !(navigator && navigator.clipboard)) return;
        try {
            await navigator.clipboard.writeText(rebuiltHtml);
            setCopyStatus('Copied');
            setTimeout(() => setCopyStatus(null), 1800);
        } catch {
            setCopyStatus('Copy failed');
            setTimeout(() => setCopyStatus(null), 1800);
        }
    };

    const handleOpenPreview = () => {
        if (!rebuiltHtml || typeof window === 'undefined') return;
        const blob = new Blob([rebuiltHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
            setError('Popup blocked. Please allow popups to view the rebuilt UI.');
            URL.revokeObjectURL(url);
            return;
        }
        win.focus();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 transition-all hover:shadow-cyan-500/10 hover:shadow-lg hover:border-slate-600">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side: Textual Description */}
                <div>
                    <h3 className="text-xl font-semibold text-sky-400 mb-2">{screen.screenName}</h3>
                    <p className="text-slate-300 mb-4">{screen.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <h4 className="font-bold text-slate-400 mb-1">UI Elements</h4>
                            <ul className="list-disc list-inside text-slate-300 space-y-1">
                                {screen.uiElements.map((el, i) => <li key={i}>{el}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-400 mb-1">Events</h4>
                            <ul className="list-disc list-inside text-slate-300 space-y-1">
                                {screen.events.map((ev, i) => <li key={i}>{ev}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-400 mb-1">Validations</h4>
                            <ul className="list-disc list-inside text-slate-300 space-y-1">
                                {screen.validations.map((val, i) => <li key={i}>{val}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right side: Rebuilt UI */}
                <div className="flex flex-col bg-slate-800/60 rounded-lg min-h-[320px] p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-slate-300">Legacy HTML/CSS rebuild preview (no images)</p>
                        {copyStatus && <span className="text-xs text-emerald-300">{copyStatus}</span>}
                    </div>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
                            <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-cyan-400"></div>
                            <p className="mt-2 text-sm">Rebuilding UI from source...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-red-400 text-center">
                            <p className="font-semibold">Rebuild Failed</p>
                            <p className="text-sm">{error}</p>
                            <button
                                onClick={handleRebuildClick}
                                className="mt-4 px-4 py-2 bg-red-600/50 text-white font-semibold rounded-md hover:bg-red-500/50 transition-colors text-sm"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : rebuiltHtml ? (
                        <>
                            <div className="relative w-full h-[360px] rounded-md overflow-hidden border border-slate-700 bg-slate-900">
                                <iframe
                                    key={previewKey}
                                    title={`${screen.screenName} rebuilt preview`}
                                    srcDoc={rebuiltHtml}
                                    className="w-full h-full bg-slate-900"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <button
                                    onClick={handleOpenPreview}
                                    className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2"
                                >
                                    <FullscreenIcon className="h-4 w-4" />
                                    Open Full Preview
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="px-4 py-2 rounded-md text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
                                >
                                    Copy HTML
                                </button>
                                <button
                                    onClick={handleRebuildClick}
                                    className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2"
                                >
                                    <RefreshIcon className="h-4 w-4" />
                                    Rebuild Again
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-center">
                                <p className="text-slate-400 mb-4">Re-build the legacy UI directly from the project source as HTML/CSS.</p>
                            <button
                                onClick={handleRebuildClick}
                                disabled={isLoading}
                                className="flex items-center justify-center px-6 py-2 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-500 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg futuristic-button"
                            >
                                <SparklesIcon className="h-5 w-5 mr-2" />
                                Rebuild Legacy UI
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SectionNav: React.FC<{ sections: { id: string; title: string }[] }> = ({ sections }) => {
    const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { rootMargin: '-35% 0px -55% 0px', threshold: 0.2 }
        );

        sections.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [sections]);

    const handleClick = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <nav className="bg-slate-900/80 border border-slate-700 rounded-xl shadow-lg p-4 space-y-2 backdrop-blur-md">
            <p className="text-xs uppercase tracking-wide text-slate-400">Sections</p>
            <div className="space-y-1">
                {sections.map(({ id, title }) => {
                    const isActive = activeId === id;
                    return (
                        <button
                            key={id}
                            onClick={() => handleClick(id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition border ${isActive
                                ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40'
                                : 'bg-slate-800/60 text-slate-200 border-slate-700 hover:border-cyan-600 hover:text-cyan-200'}`}
                        >
                            {title}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

const SectionNavFixed: React.FC<{ sections: { id: string; title: string }[] }> = ({ sections }) => {
    const NAV_MIN = 240;
    const NAV_MAX = 320;
    return (
        <div
            className="hidden xl:block sticky top-24 self-start flex-none"
            style={{ width: '18vw', minWidth: NAV_MIN, maxWidth: NAV_MAX }}
        >
            <SectionNav sections={sections} />
        </div>
    );
};

const AnalysisResultDisplay: React.FC<AnalysisResultDisplayProps> = ({ result, language, prototypes, onPrototypesChange }) => {
  const [architectureSuggestion, setArchitectureSuggestion] = useState<ArchitectureSuggestion | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string|null>(null);

  const sections = [
    { id: 'section-overview', title: 'Project Overview' },
    { id: 'section-code-quality', title: 'Code Quality' },
    { id: 'section-components', title: 'Components' },
    { id: 'section-technologies', title: 'Technologies' },
    { id: 'section-business-flow', title: 'Business Flow' },
    { id: 'section-sequence', title: 'Sequence Diagram' },
    { id: 'section-transition', title: 'Screen Transition' },
    { id: 'section-erd', title: 'Database ERD' },
    { id: 'section-screens', title: 'Screen Descriptions' },
    { id: 'section-prototypes', title: 'Interactive Prototypes' },
    { id: 'section-architecture', title: 'Improve Architecture' },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportToExcel(result, architectureSuggestion, language);
    } catch (e: any) {
      console.error("Export failed:", e);
      setExportError(e.message || "An unknown error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="relative">
      <div className="relative">
        <div className="xl:flex xl:items-start xl:gap-8">
          <SectionNavFixed sections={sections} />
          <div className="flex-1 space-y-8">
      <Section 
        id="section-overview"
        title="Project Overview"
        action={
            <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center justify-center px-4 py-2 text-sm text-white font-semibold rounded-md transition-all duration-300 transform hover:scale-105 futuristic-button"
                title="Export all analysis results to an Excel file"
              >
                <ExcelIcon className="h-5 w-5 mr-2" />
                {isExporting ? "Exporting..." : "Export to Excel"}
              </button>
        }
      >
        {exportError && (
          <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">
            <p><strong>Export Failed:</strong> {exportError}</p>
          </div>
        )}
        <p className="text-slate-300 whitespace-pre-wrap">{result.overview}</p>
      </Section>
      
      <Section id="section-code-quality" title="Code Quality Analysis">
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-sky-400 text-lg">Readability</h3>
                <p className="text-slate-300 whitespace-pre-wrap">{result.codeQualityAnalysis.readability}</p>
            </div>
            <div>
                <h3 className="font-semibold text-sky-400 text-lg">Extensibility</h3>
                <p className="text-slate-300 whitespace-pre-wrap">{result.codeQualityAnalysis.extensibility}</p>
            </div>
            <div>
                <h3 className="font-semibold text-sky-400 text-lg">Security</h3>
                <p className="text-slate-300 whitespace-pre-wrap">{result.codeQualityAnalysis.security}</p>
            </div>
        </div>
      </Section>

      <Section id="section-components" title="Identified Components">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.components.map((comp: ComponentInfo, index: number) => (
            <div key={index} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:border-cyan-600 hover:bg-slate-800 transition-all">
              <h3 className="font-semibold text-sky-400">{comp.name}</h3>
              <p className="text-xs text-slate-400 font-mono break-all">{comp.path}</p>
              <p className="text-sm text-slate-300 mt-2">{comp.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="section-technologies" title="Technologies & Libraries">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.technologies.map((tech: TechnologyInfo, index: number) => (
            <div key={index} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:border-cyan-600 hover:bg-slate-800 transition-all">
              <h3 className="font-semibold text-sky-400">{tech.name}</h3>
              <p className="text-sm text-slate-400">{tech.category}</p>
              <p className="text-sm text-slate-300 mt-2">{tech.description}</p>
            </div>
          ))}
        </div>
      </Section>

       <Section id="section-business-flow" title="Business Flow Diagram">
         <Diagram
            key={`business-${result.businessFlowDiagram}`}
            id="business-flow-diagram"
            chart={result.businessFlowDiagram}
            fallback={<BusinessFlowFallback screens={result.screenDescriptions} components={result.components} />}
         />
      </Section>
      
       <Section id="section-sequence" title="Sequence Diagram">
         <Diagram key={`sequence-${result.sequenceDiagram}`} id="sequence-diagram" chart={result.sequenceDiagram} />
      </Section>

       <Section id="section-transition" title="Screen Transition Diagram">
         <Diagram
            key={`transition-${result.screenTransitionDiagram}`}
            id="screen-transition-diagram"
            chart={result.screenTransitionDiagram}
            fallback={<ScreenTransitionFallback screens={result.screenDescriptions} />}
         />
      </Section>
      
       <Section id="section-erd" title="Database ERD">
         <Diagram key={`erd-${result.databaseERD}`} id="database-erd-diagram" chart={result.databaseERD} />
      </Section>

       <Section id="section-screens" title="Screen Descriptions">
        <div className="space-y-6">
          {result.screenDescriptions.map((screen: ScreenDescription, index: number) => (
            <ScreenDetail key={index} screen={screen} language={language} />
          ))}
        </div>
      </Section>

      <Section id="section-prototypes" title="Interactive Prototypes">
        <PrototypeBuilder
          screens={result.screenDescriptions}
          language={language}
          prototypes={prototypes}
          onPrototypesChange={onPrototypesChange}
        />
      </Section>

      <Section id="section-architecture" title="Improve Architecture">
        <ArchitectureSuggester 
            overview={result.overview} 
            language={language}
            suggestion={architectureSuggestion}
            onSuggestionChange={setArchitectureSuggestion}
        />
      </Section>
      </div>
      </div>
      </div>
    </div>
  );
};

export default AnalysisResultDisplay;
