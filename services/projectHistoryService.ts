import { AnalysisResult, PrototypeArtifact } from '../types';
import { ensureGraphDiagrams } from './geminiService';

export interface ProjectHistoryEntry {
  id: string;
  projectName: string;
  fileName: string;
  language: string;
  analyzedAt: string; // ISO string
  summary: string;
  analysisResult: AnalysisResult;
  prototypes?: PrototypeArtifact[];
}

const STORAGE_KEY = 'cmc-project-history';

const isBrowser = typeof window !== 'undefined';

const persistHistory = (entries: ProjectHistoryEntry[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Unable to persist project history.', error);
  }
};

export const loadProjectHistory = (): ProjectHistoryEntry[] => {
  if (!isBrowser) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry;
        const normalizedResult = entry.analysisResult
          ? ensureGraphDiagrams(entry.analysisResult as AnalysisResult)
          : entry.analysisResult;
        return {
          ...entry,
          analysisResult: normalizedResult,
          prototypes: Array.isArray(entry.prototypes) ? entry.prototypes : [],
        };
      });
    }
    return [];
  } catch (error) {
    console.warn('Unable to read project history.', error);
    return [];
  }
};

export const addProjectHistoryEntry = (entry: ProjectHistoryEntry): ProjectHistoryEntry[] => {
  entry.analysisResult = ensureGraphDiagrams(entry.analysisResult);
  entry.prototypes = entry.prototypes || [];
  const history = loadProjectHistory();
  const filtered = history.filter((h) => h.id !== entry.id);
  const updated = [entry, ...filtered];
  persistHistory(updated);
  return updated;
};

export const deleteProjectHistoryEntry = (id: string): ProjectHistoryEntry[] => {
  const history = loadProjectHistory();
  const updated = history.filter((entry) => entry.id !== id);
  persistHistory(updated);
  return updated;
};

export const clearProjectHistory = (): ProjectHistoryEntry[] => {
  persistHistory([]);
  return [];
};

export const exportHistoryToFile = (entries: ProjectHistoryEntry[], fileName = 'project-history.json') => {
  if (!isBrowser) return;
  const payload = JSON.stringify(entries, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const updateHistoryEntryPrototypes = (id: string, prototypes: PrototypeArtifact[]): ProjectHistoryEntry[] => {
  const history = loadProjectHistory();
  const updated = history.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          prototypes,
        }
      : entry
  );
  persistHistory(updated);
  return updated;
};
