import React, { useState, useEffect, useRef } from 'react';

const stageSpecificMessages: { [key: string]: string[] } = {
  'Initializing Analysis Protocol': [
    '[INFO] Establishing secure connection to CMC-Japan AI core...',
    '[AUTH] Credentials authenticated. Session token granted.',
    '[CORE] Loading analysis models v2.3.1...',
    '[VFS]  Virtual file system mounted at /mnt/project.',
    '[OK]   Initialization complete. Ready for data ingestion.',
  ],
  'Decompressing Project Archive': [
    '[READ] Reading project.zip archive...',
    '[INFLATE] Decompressing 137 files and 24 directories...',
    '[HASH] Verifying file integrity (SHA-256)...',
    '[OK]   Archive decompressed successfully. No errors found.',
  ],
  'Parsing File Structure & Dependencies': [
    '[SCAN] Scanning file tree for source code extensions...',
    '[PARSE] package.json found. Reading dependencies...',
    '[INFO] Found 57 dependencies. Resolving dependency graph...',
    '[GRAPH] Dependency tree resolved. Mapping component imports...',
    '[OK]   File structure and dependencies parsed.',
  ],
  'Performing Static Code Analysis': [
    '[SCA]  Analyzing React component structure...',
    '[SCA]  Identifying data flow patterns and state management...',
    '[SCA]  Mapping all UI/UX interactions and event handlers...',
    '[WARN] Deprecated lifecycle method found in `UserProfile.jsx:112`.',
    '[SECURITY] Scanning for common vulnerabilities (XSS, CSRF)...',
    '[OK]   Static code analysis complete.',
  ],
  'Building Abstract Syntax Trees': [
    '[AST]  Generating AST for /src/App.tsx...',
    '[AST]  Tokenizing /src/components/UserLogin.jsx...',
    '[AST]  Processing 54 component files into ASTs...',
    '[INFO] All source files tokenized and parsed.',
    '[OK]   Abstract Syntax Trees built successfully.',
  ],
  'Generating Diagrams & Schemas': [
    '[TECH] Extracting technology stack fingerprints from dependencies...',
    '[DIAGRAM] Compiling data for screen transition diagram...',
    '[DB]   No explicit DB schema found. Inferring schema from models...',
    '[ERD]  Constructing ERD relationships from API calls...',
    '[OK]   All diagrams and schemas generated.',
  ],
  'Compiling Final Report': [
    '[REPORT] Aggregating all analysis data points...',
    '[REPORT] Formatting architectural overview and component list...',
    '[REPORT] Generating code quality and security summaries...',
    '[OK]   Final report compiled.',
  ],
   'Finalizing...': [
    '[CLEANUP] Unmounting virtual file system...',
    '[AUTH] Closing secure connection to AI core...',
    '[UI]   Preparing results for display...',
    '[DONE] Analysis complete.',
   ]
};

interface HackerTextScrollerProps {
    currentStage: string;
}

const HackerTextScroller: React.FC<HackerTextScrollerProps> = ({ currentStage }) => {
    const [lines, setLines] = useState<string[]>(['> CMC-Japan AI core connection established. Beginning project deconstruction...']);
    const scrollRef = useRef<HTMLDivElement>(null);
    const stageMessagesRef = useRef({ stage: '', index: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            const messagesForStage = stageSpecificMessages[currentStage] || [];
            
            // If stage changed, reset the message index for the new stage
            if (stageMessagesRef.current.stage !== currentStage) {
                stageMessagesRef.current.stage = currentStage;
                stageMessagesRef.current.index = 0;
            }

            // If there's a new message for the current stage that hasn't been displayed yet, add it.
            if (stageMessagesRef.current.index < messagesForStage.length) {
                const nextLine = `> ${messagesForStage[stageMessagesRef.current.index]}`;
                
                setLines(prevLines => {
                    const newLines = [...prevLines, nextLine];
                    // Keep the log from getting too long
                    if (newLines.length > 100) {
                        return newLines.slice(newLines.length - 100);
                    }
                    return newLines;
                });
                
                // Move to the next message for the next interval
                stageMessagesRef.current.index++;
            }
            // If all messages for the current stage are displayed, the interval will do nothing until the stage changes.
        }, 400); // Interval timed for readability

        return () => clearInterval(interval);
    }, [currentStage]);

    useEffect(() => {
        // Auto-scroll to the bottom of the log
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines]);

    return (
        <div ref={scrollRef} className="w-full h-48 bg-black bg-opacity-50 rounded-md p-4 overflow-y-auto font-mono text-xs text-cyan-200 shadow-inner shadow-cyan-500/20 backdrop-blur-sm border border-cyan-500/10">
            {lines.map((line, index) => (
                <p key={index} className="whitespace-pre break-all">
                    {line}
                </p>
            ))}
        </div>
    );
};

export default HackerTextScroller;
