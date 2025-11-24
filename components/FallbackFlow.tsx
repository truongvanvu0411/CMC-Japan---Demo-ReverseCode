import React from 'react';
import { ComponentInfo, ScreenDescription } from '../types';

const FlowStep: React.FC<{ label: string; description?: string; isLast?: boolean }> = ({ label, description, isLast }) => (
    <div className="flex items-center">
        <div className="min-w-[160px] px-4 py-3 rounded-lg bg-slate-900/70 border border-slate-700 shadow-inner">
            <p className="font-semibold text-cyan-300 text-sm">{label}</p>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
        {!isLast && (
            <div className="flex-1 flex items-center mx-2">
                <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                <div className="w-2 h-2 rounded-full bg-blue-400 ml-1"></div>
            </div>
        )}
    </div>
);

const inferComponentLabel = (components: ComponentInfo[], keywords: RegExp, fallback: string) => {
    const found = components.find(component => keywords.test(component.name) || keywords.test(component.path));
    if (!found) return fallback;
    return `${found.name}${found.description ? ` – ${found.description}` : ''}`;
};

export const BusinessFlowFallback: React.FC<{
    screens: ScreenDescription[];
    components: ComponentInfo[];
}> = ({ screens, components }) => {
    const uiScreens = screens.length ? screens.slice(0, 4) : [{
        screenName: 'Main Interaction',
        description: 'Primary user-facing screen',
        uiElements: [],
        events: [],
        validations: [],
    }];

    const logic = inferComponentLabel(components, /(service|controller|api|logic|backend|handler)/i, 'Application Logic');
    const data = inferComponentLabel(components, /(repository|dao|model|entity|database|db|storage|persistence)/i, 'Data Store / External APIs');

    const steps = [
        { label: 'User', description: 'Initiates a business action' },
        ...uiScreens.map((screen) => ({
            label: screen.screenName,
            description: screen.description || 'User interface',
        })),
        { label: logic, description: 'Processes request & applies business rules' },
        { label: data, description: 'Persists or retrieves data' },
        { label: 'Outcome', description: 'User receives response/result' }
    ];

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-400">Showing simplified flow because the Mermaid diagram was unavailable.</p>
            <div className="flex flex-col gap-4">
                {steps.map((step, index) => (
                    <FlowStep
                        key={`${step.label}-${index}`}
                        label={step.label}
                        description={step.description}
                        isLast={index === steps.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};

export const ScreenTransitionFallback: React.FC<{ screens: ScreenDescription[] }> = ({ screens }) => {
    const orderedScreens = screens.length ? screens : [{
        screenName: 'Home Screen',
        description: 'Starting point of the application',
        uiElements: [],
        events: [],
        validations: [],
    }];

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-400">Simplified screen flow rendered because the Mermaid diagram was not available.</p>
            <div className="flex flex-col gap-4">
                {orderedScreens.map((screen, index) => (
                    <FlowStep
                        key={screen.screenName || index}
                        label={screen.screenName}
                        description={screen.description}
                        isLast={index === orderedScreens.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};
