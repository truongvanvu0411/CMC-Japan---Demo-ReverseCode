import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import panzoom from 'panzoom';

interface DiagramProps {
  id: string;
  chart: string;
  fallback?: React.ReactNode;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

const escapeLabel = (text: string) => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const cleanLabel = (text: string) => {
  let cleaned = text.trim();
  if (!cleaned) return '';
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('\'') && cleaned.endsWith('\''))) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/^_+/, '').replace(/_+$/, '').trim();
  return escapeLabel(cleaned);
};

const formatNodeContent = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '""';
  }

  if (/^fa:[\w-]+/i.test(trimmed)) {
    const icon = trimmed.split(/\s+/)[0];
    const rest = trimmed.slice(icon.length).trim();
    if (!rest) {
      return icon;
    }
    return `${icon} "${cleanLabel(rest)}"`;
  }

  return `"${cleanLabel(trimmed)}"`;
};

const splitStatements = (input: string): string[] => {
  const statements: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== '\\') {
      inQuote = !inQuote;
    }
    if (!inQuote && (char === '\n' || char === ';')) {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
};

const NODE_BRACKETS = [
  { open: '[', close: ']' },
  { open: '(', close: ')' },
  { open: '{', close: '}' },
];

const normalizeGraphDiagram = (code: string): string => {
  const statements = splitStatements(code);
  if (!statements.length) return '';

  let header = 'graph TD';
  const body: string[] = [];
  let headerFound = false;

  statements.forEach(statement => {
    if (!headerFound && /^graph\s+/i.test(statement)) {
      const match = statement.match(/^graph\s+([A-Za-z]+)/i);
      const direction = match ? match[1].toUpperCase() : 'TD';
      header = `graph ${direction === 'LR' ? 'LR' : 'TD'}`;
      const remainder = statement.slice(match ? match[0].length : 0).trim();
      if (remainder) {
        body.push(...splitStatements(remainder));
      }
      headerFound = true;
    } else {
      body.push(statement);
    }
  });

  const normalizedBody = body
    .map(line => {
      let normalized = line.replace(/;/g, '').trim();
      if (!normalized) return '';

      normalized = normalized.replace(/(-->|---|-->>|==>|=>|-\\.->|-\+->|--x|-x)\s*$/gm, '');

      NODE_BRACKETS.forEach(({ open, close }) => {
        const nodeRegex = new RegExp(`(\\w+)\\${open}([^\\${close}]*?)\\${close}`, 'g');
        normalized = normalized.replace(nodeRegex, (_, id: string, content: string) => {
          const formatted = formatNodeContent(content);
          return `${id}${open}${formatted}${close}`;
        });
      });

      normalized = normalized.replace(/(---|-->>|--\s*-->|-->|==>|=>|-\\.->|-\+->|--x|-x)\s*\|\s*([^|]+?)\s*\|/g,
        (_, arrow: string, label: string) => {
          const cleaned = cleanLabel(label);
          return `${arrow}|"${cleaned}"|`;
        }
      );

      return normalized;
    })
    .filter(Boolean);

  return [header, ...normalizedBody].join('\n');
};

const sanitizeErd = (code: string): string => {
  let working = code.replace(/```/g, '');
  const classDefs: string[] = [];
  const classAssignments: string[] = [];

  working = working.replace(/([A-Za-z0-9_]+)\s*:::\s*(\w+)/g, (_, entity: string, className: string) => {
    classAssignments.push(`class ${entity.trim()} ${className}`);
    return entity;
  });

  working = working.replace(/classDef\s+[^\n]+/g, match => {
    classDefs.push(match.replace(/;/g, '').trim());
    return '';
  });
  working = working.replace(/}\s+(?=[A-Za-z0-9_])/g, '}\n');

  const lines = working.split('\n');
  const processed: string[] = [];

  lines.forEach(line => {
    let current = line.trim();
    if (!current) return;
    current = current.replace(/^(class(?:Def)?.*);/gm, '$1');
    const relMatch = current.match(/^(.*\s:\s*)(.*)\s*$/);
    if (relMatch) {
      const label = relMatch[2].trim();
      if (label && !label.startsWith('"') && !label.endsWith('"') && current.match(/[|o}][|-]{2}[o|{]/)) {
        current = `${relMatch[1].trim()} "${cleanLabel(label)}"`;
      }
    }
    processed.push(current);
  });

  return [...processed, ...classDefs, ...classAssignments].filter(Boolean).join('\n');
};

const normalizeParticipantId = (raw: string) =>
  raw.replace(/["']/g, '').trim().toLowerCase();

const sanitizeSequence = (code: string): string => {
  const activeParticipants = new Set<string>();
  const processedLines: string[] = [];

  code.split('\n').forEach(line => {
    let currentLine = line;
    const messageMatch = currentLine.match(/(.*(?:->>|-->>|->|-->|-x|--x)\s*[\w"']+\s*:\s*)(?!")(.*)/);
    if (messageMatch) {
      const messageText = messageMatch[2].trim();
      if (messageText) {
        currentLine = `${messageMatch[1]}"${cleanLabel(messageText)}"`;
      }
    }

    const activateMatch = currentLine.match(/^(\s*)activate\s+(.+)/i);
    if (activateMatch) {
      const participantId = normalizeParticipantId(activateMatch[2]);
      if (participantId) {
        activeParticipants.add(participantId);
      }
      processedLines.push(currentLine);
      return;
    }

    const deactivateMatch = currentLine.match(/^(\s*)deactivate\s+(.+)/i);
    if (deactivateMatch) {
      const participantId = normalizeParticipantId(deactivateMatch[2]);
      if (!participantId || !activeParticipants.has(participantId)) {
        return;
      }
      activeParticipants.delete(participantId);
      processedLines.push(currentLine);
      return;
    }

    processedLines.push(currentLine);
  });

  return processedLines.join('\n');
};

const sanitizeMermaidCode = (code: string): string => {
  const trimmed = code.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('graph')) return normalizeGraphDiagram(trimmed);
  if (trimmed.startsWith('erDiagram')) return sanitizeErd(trimmed);
  if (trimmed.startsWith('sequenceDiagram')) return sanitizeSequence(trimmed);
  return trimmed;
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
};

const Diagram: React.FC<DiagramProps> = ({ id, chart, fallback }) => {
  const [error, setError] = useState<{ message: string; line?: number } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const internalId = useId();
  const renderId = `mermaid-render-${id}-${internalId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<ReturnType<typeof panzoom> | null>(null);
  const cleanupHandlersRef = useRef<(() => void)[]>([]);
  const normalizedChart = chart?.trim() ?? '';

  const cleanChart = useMemo(() => {
    if (!normalizedChart) return '';
    return sanitizeMermaidCode(normalizedChart);
  }, [normalizedChart]);

  const chartSignature = useMemo(() => {
    if (!cleanChart) return 'empty';
    return hashString(cleanChart);
  }, [cleanChart]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cleanupPanzoom = () => {
      panzoomRef.current?.dispose();
      panzoomRef.current = null;
      cleanupHandlersRef.current.forEach(cleanup => cleanup());
      cleanupHandlersRef.current = [];
    };

    container.innerHTML = '';
    cleanupPanzoom();

    if (!normalizedChart) {
      setIsRendering(false);
      setError(null);
      return;
    }

    if (!cleanChart) {
      setIsRendering(false);
      setError({ message: 'No valid Mermaid diagram content was provided.' });
      return;
    }

    let cancelled = false;
    const renderToken = `${renderId}-${chartSignature}-${Date.now()}`;

    const renderDiagram = async () => {
      try {
        setError(null);
        setIsRendering(true);
        await mermaid.run({ nodes: [] });
        const { svg: renderedSvg } = await mermaid.render(renderToken, cleanChart);
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = renderedSvg;
        const svgElement = containerRef.current.querySelector('svg');
        if (svgElement) {
          svgElement.style.width = '100%';
          svgElement.style.height = '100%';
          const pz = panzoom(svgElement, {
            maxZoom: 10,
            minZoom: 0.2,
            bounds: true,
            boundsPadding: 0.1,
          });
          panzoomRef.current = pz;
          const onMouseEnter = () => { svgElement.style.cursor = 'grab'; };
          const onMouseDown = () => { svgElement.style.cursor = 'grabbing'; };
          const onMouseUp = () => { svgElement.style.cursor = 'grab'; };
          svgElement.addEventListener('mouseenter', onMouseEnter);
          svgElement.addEventListener('mousedown', onMouseDown);
          svgElement.addEventListener('mouseup', onMouseUp);
          cleanupHandlersRef.current.push(() => {
            svgElement.removeEventListener('mouseenter', onMouseEnter);
            svgElement.removeEventListener('mousedown', onMouseDown);
            svgElement.removeEventListener('mouseup', onMouseUp);
          });
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error(`Mermaid rendering failed for id ${renderId}:`, e);
        let errorMessage = e.message || 'An unknown error occurred during diagram rendering.';
        const lineMatch = errorMessage.match(/Parse error on line (\d+):/);
        const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
        if (e.str) {
          errorMessage = `The diagram syntax is invalid. Error: ${e.str}`;
        }
        setError({ message: errorMessage, line: errorLine });
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
      cleanupPanzoom();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [chartSignature, cleanChart, normalizedChart, renderId, id]);

  if (!normalizedChart) {
    if (fallback) {
      return (
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 min-h-[300px]">
          {fallback}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center p-8 bg-slate-700/50 rounded-lg min-h-[300px]">
        <p className="text-slate-400">No diagram data available to display.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
          <p><strong>Diagram Error:</strong> {error.message}</p>
          <pre className="mt-2 p-2 bg-slate-900 text-sm rounded-md whitespace-pre-wrap font-mono overflow-auto">
            {normalizedChart.split('\n').map((line, index) => {
              const isErrorLine = error.line !== undefined && index + 1 === error.line;
              return (
                <span key={index} className={isErrorLine ? 'bg-red-500/30 block' : ''}>
                  <span className="text-slate-500 pr-4 select-none">{index + 1}</span>
                  <span>{line}</span>
                </span>
              );
            })}
          </pre>
        </div>
        {fallback && (
          <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
            {fallback}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-lg z-10">
          <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-cyan-400"></div>
          <p className="ml-4 text-slate-400">Rendering diagram...</p>
        </div>
      )}
      <div
        ref={containerRef}
        id={id}
        className="flex items-center justify-center p-4 bg-slate-900/50 rounded-lg overflow-auto min-h-[300px]"
      />
    </div>
  );
};

export default Diagram;
