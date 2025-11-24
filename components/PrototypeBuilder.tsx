import React, { useMemo, useState } from 'react';
import { PrototypeArtifact, ScreenDescription } from '../types';
import { generateInteractivePrototype } from '../services/geminiService';
import { SparklesIcon, RefreshIcon } from './Icons';

interface PrototypeBuilderProps {
  screens: ScreenDescription[];
  language: string;
  prototypes: PrototypeArtifact[];
  onPrototypesChange: (prototypes: PrototypeArtifact[]) => void;
}

interface ReferenceImagePayload {
  dataUrl: string;
  mimeType: string;
  name: string;
}

const sanitizePrototypeMarkup = (markup: string) =>
  markup
    .replace(/```(?:html|css|javascript)?/gi, '')
    .replace(/```/g, '')
    .trim();

const PrototypeBuilder: React.FC<PrototypeBuilderProps> = ({ screens, language, prototypes, onPrototypesChange }) => {
  const [selectedScreens, setSelectedScreens] = useState<Set<string>>(new Set());
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<ReferenceImagePayload | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const orderedScreens = useMemo(() => screens || [], [screens]);

  const toggleScreen = (name: string) => {
    setSelectedScreens((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const readFileAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setReferenceImage({
        dataUrl,
        mimeType: file.type || 'image/png',
        name: file.name,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to read image file.');
    } finally {
      setIsProcessingImage(false);
      event.target.value = '';
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setReferenceImage({
        dataUrl,
        mimeType: file.type || 'image/png',
        name: 'clipboard-image.png',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to read clipboard image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const clearReferenceImage = () => setReferenceImage(null);

  const handleBuild = async () => {
    if (!selectedScreens.size) {
      setError('Please select at least one screen.');
      return;
    }

    setIsBuilding(true);
    setError(null);

    try {
      const chosenScreens = orderedScreens.filter((screen) => selectedScreens.has(screen.screenName));
      const prototypeHtml = await generateInteractivePrototype(chosenScreens, language, referenceImage || undefined);
      const cleanHtml = sanitizePrototypeMarkup(prototypeHtml);
      if (!cleanHtml) {
        throw new Error('Prototype response was empty.');
      }

      const prototype: PrototypeArtifact = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        screens: chosenScreens.map((screen) => screen.screenName),
        createdAt: new Date().toLocaleString(),
        html: cleanHtml,
      };

      onPrototypesChange([prototype, ...prototypes]);
    } catch (e: any) {
      setError(e.message || 'Failed to generate prototype.');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleRemovePrototype = (id: string) => {
    onPrototypesChange(prototypes.filter((prototype) => prototype.id !== id));
  };

  const openPrototypeWindow = (prototype: PrototypeArtifact) => {
    const blob = new Blob([prototype.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      setError('Popup blocked. Please allow popups for this site to view the prototype.');
    } else {
      newWindow.focus();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xl font-semibold text-sky-400">Screen Selection</h3>
            <p className="text-sm text-slate-400">Choose screens and optionally attach a reference UI style for CMC Japan to follow.</p>
          </div>
          <button
            onClick={handleBuild}
            disabled={isBuilding || selectedScreens.size === 0}
            className="flex items-center px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600"
          >
            {isBuilding ? (
              <>
                <RefreshIcon className="h-4 w-4 mr-2 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Build Prototype
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mb-2 p-3 rounded-md bg-red-900/50 text-red-200 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orderedScreens.map((screen) => (
            <label
              key={screen.screenName}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${selectedScreens.has(screen.screenName)
                  ? 'border-cyan-400 bg-cyan-400/10'
                  : 'border-slate-600 hover:border-cyan-600'}`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedScreens.has(screen.screenName)}
                onChange={() => toggleScreen(screen.screenName)}
              />
              <div>
                <p className="font-semibold text-slate-100">{screen.screenName}</p>
                <p className="text-xs text-slate-400 line-clamp-2">{screen.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div
          className="rounded-lg border border-dashed border-slate-600 p-4 bg-slate-900/40"
          onPaste={handlePaste}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div>
              <h4 className="text-base font-semibold text-slate-100">Reference UI Style (optional)</h4>
              <p className="text-xs text-slate-400">
                Upload an image or paste from clipboard (Ctrl/Cmd + V). CMC Japan will use it as visual guidance.
              </p>
            </div>
            <label className="inline-flex items-center px-4 py-2 rounded-md border border-slate-600 text-sm font-semibold cursor-pointer hover:border-cyan-500">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isProcessingImage}
              />
              {isProcessingImage ? 'Processing...' : 'Upload Reference'}
            </label>
          </div>
          {referenceImage ? (
            <div className="flex items-center gap-3">
              <img src={referenceImage.dataUrl} alt="Reference preview" className="h-24 rounded-md border border-slate-600 object-cover" />
              <div className="space-y-1">
                <p className="text-sm text-slate-200">{referenceImage.name}</p>
                <p className="text-xs text-slate-400">{referenceImage.mimeType}</p>
                <button
                  onClick={clearReferenceImage}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  Remove reference
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No reference attached yet.</p>
          )}
        </div>
      </div>

      {prototypes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-sky-400">Generated Prototypes</h3>
          {prototypes.map((prototype) => (
            <div key={prototype.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-slate-300 font-semibold">{prototype.screens.join(' -> ')}</p>
                <p className="text-xs text-slate-500">Generated at {prototype.createdAt}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openPrototypeWindow(prototype)}
                  className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-500/80 hover:bg-emerald-500 text-white"
                >
                  Open Prototype
                </button>
                <button
                  onClick={() => handleRemovePrototype(prototype.id)}
                  className="px-3 py-2 text-xs text-red-300 border border-red-500/50 rounded-md hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrototypeBuilder;
