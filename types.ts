export interface ComponentInfo {
  name: string;
  path: string;
  description: string;
}

export interface TechnologyInfo {
  name: string;
  category: string;
  description: string;
}

export interface ScreenDescription {
  screenName: string;
  description: string;
  uiElements: string[];
  events: string[];
  validations: string[];
}

export interface CodeQualityAnalysis {
  readability: string;
  extensibility: string;
  security: string;
}

export interface AnalysisResult {
  overview: string;
  components: ComponentInfo[];
  technologies: TechnologyInfo[];
  businessFlowDiagram: string;
  sequenceDiagram: string;
  screenTransitionDiagram: string;
  databaseERD: string;
  screenDescriptions: ScreenDescription[];
  codeQualityAnalysis: CodeQualityAnalysis;
}

export interface ArchitectureSuggestion {
  businessProcess: {
    diagram: string; // MermaidJS graph TD
    explanation: string;
  };
  overallArchitecture: {
    asIsDiagram: string; // MermaidJS graph TD
    toBeDiagram: string; // MermaidJS graph TD
    explanation: string;
  };
  specificPoints: {
    asIs: string;
    toBe: string;
    explanation: string;
  };
}

export interface PrototypeArtifact {
  id: string;
  screens: string[];
  createdAt: string;
  html: string;
}
