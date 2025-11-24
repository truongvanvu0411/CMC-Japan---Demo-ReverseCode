import React, { useState } from 'react';
import { ProjectHistoryEntry } from '../services/projectHistoryService';

interface ProjectHistoryProps {
  entries: ProjectHistoryEntry[];
  onSelect: (entry: ProjectHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExport: () => void;
}

const ProjectHistory: React.FC<ProjectHistoryProps> = ({
  entries,
  onSelect,
  onDelete,
  onClear,
  onExport,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-40">
      {isOpen && (
        <div className="futuristic-card w-72 max-h-[70vh] p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-sky-400">Project History</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-300 hover:text-white"
              aria-label="Close project history"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExport}
              className="flex-1 px-2 py-1 text-xs rounded border border-slate-600 text-slate-200 hover:border-cyan-400 transition"
            >
              Export
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={entries.length === 0}
              className="flex-1 px-2 py-1 text-xs rounded border border-red-600 text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600/10 transition"
            >
              Clear
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="text-slate-400 text-sm">
              Upload a project to see it here.
            </p>
          ) : (
            <ul className="project-history-list space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 bg-slate-900/40 border border-slate-700 rounded-md px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(entry);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left text-sm text-white hover:text-cyan-300 transition truncate"
                  >
                    {entry.projectName || entry.fileName}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(entry.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                    aria-label={`Remove ${entry.projectName || entry.fileName}`}
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="futuristic-button px-4 py-2 rounded shadow-lg text-sm"
      >
        {isOpen ? 'Hide History' : 'Show History'}
      </button>
    </div>
  );
};

export default ProjectHistory;
