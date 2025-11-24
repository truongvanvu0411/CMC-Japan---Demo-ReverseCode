import React, { useState, useEffect } from 'react';
import HackerTextScroller from './HackerTextScroller';
import MatrixRainCanvas from './MatrixRainCanvas';

const analysisStages = [
  { name: 'Initializing Analysis Protocol', duration: 1500 },
  { name: 'Decompressing Project Archive', duration: 2500 },
  { name: 'Parsing File Structure & Dependencies', duration: 4000 },
  { name: 'Performing Static Code Analysis', duration: 6000 },
  { name: 'Building Abstract Syntax Trees', duration: 4000 },
  { name: 'Generating Diagrams & Schemas', duration: 5000 },
  { name: 'Compiling Final Report', duration: 2000 },
];
const totalDuration = analysisStages.reduce((sum, stage) => sum + stage.duration, 0);


const Loader: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [currentStageName, setCurrentStageName] = useState(analysisStages[0].name);
  
  useEffect(() => {
    let startTime = Date.now();
    let animationFrameId: number;

    const updateProgress = () => {
        const elapsedTime = Date.now() - startTime;
        const progressPercentage = Math.min((elapsedTime / totalDuration) * 100, 100);
        setProgress(progressPercentage);

        // Find current stage
        let accumulatedDuration = 0;
        for(const stage of analysisStages) {
            accumulatedDuration += stage.duration;
            if (elapsedTime <= accumulatedDuration) {
                setCurrentStageName(stage.name);
                break;
            }
        }
        
        if (elapsedTime >= totalDuration) {
          setCurrentStageName("Finalizing...");
        }

        if (elapsedTime < totalDuration) {
            animationFrameId = requestAnimationFrame(updateProgress);
        } else {
            // Ensure it hits 100% at the end
            setProgress(100);
        }
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);


  return (
    <div className="fixed inset-0 w-screen min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8 space-y-6 z-50 overflow-hidden relative">
      <MatrixRainCanvas />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-black/30 to-black/50 pointer-events-none" />
      
      <div className="text-center z-10">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-cyan-500/50 rounded-full animate-ping"></div>
          <div className="absolute inset-2 border-2 border-cyan-400 rounded-full"></div>
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="w-8 h-8 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl text-cyan-300 font-bold tracking-widest animate-pulse">
          CMC-JAPAN IS ANALYZING YOUR PROJECT
        </h2>
      </div>

      {/* Dynamic Progress Bar */}
      <div className="w-full max-w-3xl z-10 px-4">
        <div className="text-left mb-2">
            <span className="text-cyan-400 font-mono text-sm">{currentStageName}</span>
            <span className="text-slate-400 font-mono text-sm float-right">{Math.floor(progress)}%</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2.5 border border-cyan-500/20">
            <div 
              className="bg-cyan-400 h-full rounded-full transition-all duration-100 ease-linear" 
              style={{ 
                width: `${progress}%`,
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.7)'
              }}
            ></div>
        </div>
      </div>

      <div className="w-full max-w-3xl z-10">
        <HackerTextScroller currentStage={currentStageName} />
      </div>
    </div>
  );
};

export default Loader;
