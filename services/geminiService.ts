import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ArchitectureSuggestion, ScreenDescription } from '../types';

// Per guidelines, API key must be from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const PROJECT_CONTEXT_LIMIT = 120_000;
let lastProjectContext: string | null = null;

const rememberProjectContext = (projectText: string) => {
  lastProjectContext = projectText ? projectText.slice(0, PROJECT_CONTEXT_LIMIT) : null;
};

const getProjectContext = () => lastProjectContext;

/**
 * Reads a ZIP file in the browser, extracts text-based source files,
 * and formats them into a single string for analysis.
 * @param file The project ZIP file.
 * @returns A promise that resolves to a string containing the project's content.
 */
async function processZipFileToString(file: File): Promise<string> {
    // JSZip is loaded globally from the CDN in index.html
    const JSZip = (window as any).JSZip;
    if (!JSZip) {
        throw new Error("JSZip library is not loaded. Cannot process file.");
    }

    const zip = await JSZip.loadAsync(file);
    let projectContent = "Project file structure and content:\n\n";
    const filesToProcess: { path: string; content: string }[] = [];

    const filePromises = Object.keys(zip.files).map(async (relativePath) => {
        const zipEntry = zip.files[relativePath];

        // Ignore directories, hidden files, and common dependency/build folders
        if (zipEntry.dir || 
            relativePath.startsWith('__MACOSX') || 
            relativePath.includes('/.') ||
            relativePath.includes('node_modules/') ||
            relativePath.includes('dist/') ||
            relativePath.includes('build/') ||
            relativePath.includes('.git/')) {
            return;
        }

        // Filter for common text-based files to avoid processing large binary assets
        const isTextFile = /\.(tsx?|jsx?|json|html|css|scss|md|txt|xml|yml|yaml|py|java|go|rb|php|sh|c|cpp|h|cs)$/i.test(relativePath);

        if (isTextFile) {
            try {
                const content = await zipEntry.async('string');
                // Set a reasonable per-file size limit to keep the prompt manageable
                if (content.length < 250000) { 
                    filesToProcess.push({ path: relativePath, content });
                }
            } catch (e) {
                console.warn(`Could not read file ${relativePath} as text, skipping.`);
            }
        }
    });

    await Promise.all(filePromises);

    // Sort files alphabetically for a consistent prompt structure
    filesToProcess.sort((a, b) => a.path.localeCompare(b.path));

    for (const { path, content } of filesToProcess) {
        projectContent += `--- File: ${path} ---\n`;
        projectContent += `${content.trim()}\n\n`;
    }

    return projectContent;
}

// --- START: Centralized MermaidJS Syntax Rules ---
const MERMAID_GRAPH_TD_RULES = `
A MermaidJS diagram using 'graph TD'.
**CRITICAL SYNTAX RULES TO PREVENT RENDERING FAILURE. FOLLOW THESE EXACTLY.**
1.  **NO SEMICOLONS**: The entire diagram must not contain any semicolons (;). Especially not after 'graph TD'.
2.  **QUOTES ARE MANDATORY**: This is the most important rule. ALL text for nodes, subgraphs, and edge labels MUST be inside double quotes (""). This is especially critical for non-English languages like Japanese or Vietnamese.
    -   English Correct: A["User Action"] -->|"Submit Form"| B["Backend Server"]
    -   Japanese Correct: A["ユーザーアクション"] -->|"フォーム送信"| B["バックエンドサーバー"]
    -   FATAL ERROR (Missing Quotes): A[User Action] -->|Submit Form| B
3.  **COMPLETE LINKS**: All links must connect two nodes. A link like 'A -->' is a fatal error.
4.  **NODE IDs**: Node IDs (the 'A', 'B' part) must be simple, ASCII-only, single words. No spaces or special characters. e.g., 'User', 'DB', 'N1', 'Action2'.
5.  **SUBGRAPHS**: Start with 'subgraph "Quoted Title"' and end with 'end'. The title must be quoted.

A perfect diagram is mandatory. An invalid diagram will crash the application. Double-check your output against these rules.
`;


const MERMAID_ERD_RULES = `
A MermaidJS ER diagram. If no database is detected, return an empty string.
**CRITICAL SYNTAX RULES TO PREVENT RENDERING FAILURE. FOLLOW THESE EXACTLY.**
1.  **Declaration**: MUST start with 'erDiagram'.
2.  **STATEMENTS PER LINE**: Each statement (entity definition, relationship, classDef, class) MUST be on its own line. DO NOT combine them.
3.  **STYLING (VERY IMPORTANT)**:
    -   First, define a style with 'classDef'. Example: 'classDef user_tables fill:#f9f,stroke:#333'
    -   Then, apply the style to an entity with 'class'. Example: 'class USERS user_tables'
    -   NEVER use the ':::' syntax. It is invalid for ERDs.
    -   FATAL ERROR EXAMPLE: class USERS:::user_tables
4.  **RELATIONSHIPS**: Use correct cardinality syntax. The label for the relationship MUST be in double quotes. This is especially critical for non-English languages. Example: 'USERS ||--|{ POSTS : "creates"' or 'ユーザー ||--|{ 投稿 : "作成する"'.
5.  **NO SEMICOLONS**: DO NOT use semicolons (;) anywhere in the ERD code. Use only newlines to separate statements.
6.  **ENTITY ATTRIBUTES**: Each attribute inside an entity's curly braces MUST have a type and a name. A quoted comment is optional. Example: 'int user_id "PK, FK"'.

A perfect diagram is mandatory. An invalid diagram will crash the application.
`;

const MERMAID_SEQUENCE_RULES = `
A MermaidJS sequence diagram.
**CRITICAL SYNTAX RULES TO PREVENT RENDERING FAILURE. FOLLOW THESE EXACTLY.**
1.  **Declaration**: MUST start with 'sequenceDiagram'.
2.  **Participants**: Declare participants at the top. e.g., 'participant User', 'participant "Backend Server"'. Quoting is safer for multi-word participants.
3.  **Message Text**: All message text after a colon (:) MUST be on the same line as the arrow. Example: 'User->>API: "Submit login form"'.
4.  **Notes and Activations**: Use 'Note right of User: text' for notes. Use 'activate' and 'deactivate' for lifelines.
5.  **Control Flow**: Use 'alt', 'opt', 'loop', 'par' for control flow, each paired with an 'end'.
6.  **NO SEMICOLONS**: DO NOT use semicolons (;) anywhere in the diagram code.

A perfect diagram is mandatory. An invalid diagram will crash the application.
`;
// --- END: Centralized MermaidJS Syntax Rules ---


const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    overview: { type: Type.STRING, description: "A high-level overview of the project's purpose, architecture, and key features." },
    components: {
      type: Type.ARRAY,
      description: "List of identified frontend and backend components.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the component." },
          path: { type: Type.STRING, description: "The file path of the component." },
          description: { type: Type.STRING, description: "A brief description of the component's responsibility." },
        },
        required: ["name", "path", "description"],
      },
    },
    technologies: {
      type: Type.ARRAY,
      description: "List of technologies, frameworks, and libraries used.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the technology (e.g., React, Node.js)." },
          category: { type: Type.STRING, description: "The category (e.g., Frontend Framework, Backend Runtime)." },
          description: { type: Type.STRING, description: "A brief description of how it's used in the project." },
        },
        required: ["name", "category", "description"],
      },
    },
    businessFlowDiagram: {
      type: Type.STRING,
      description: `A diagram visualizing the core business processes and user journey. ${MERMAID_GRAPH_TD_RULES}`
    },
    sequenceDiagram: {
        type: Type.STRING,
        description: `A diagram visualizing the interactions between components over time for a key process. ${MERMAID_SEQUENCE_RULES}`
    },
    screenTransitionDiagram: { 
        type: Type.STRING, 
        description: `A diagram visualizing the screen transitions and user flow. ${MERMAID_GRAPH_TD_RULES}`
    },
    databaseERD: {
        type: Type.STRING,
        description: MERMAID_ERD_RULES
    },
    screenDescriptions: {
        type: Type.ARRAY,
        description: "Detailed descriptions for each major screen or UI view.",
        items: {
            type: Type.OBJECT,
            properties: {
                screenName: { type: Type.STRING, description: "The name of the screen." },
                description: { type: Type.STRING, description: "A description of the screen's purpose and functionality." },
                uiElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key UI elements on the screen." },
                events: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of user interactions or events." },
                validations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of validation rules for forms on the screen." },
            },
            required: ["screenName", "description", "uiElements", "events", "validations"],
        }
    },
    codeQualityAnalysis: {
        type: Type.OBJECT,
        description: "An analysis of the source code's quality.",
        properties: {
            readability: { type: Type.STRING, description: "Comments on the code's readability and maintainability, citing examples if possible." },
            extensibility: { type: Type.STRING, description: "Analysis of how easy it would be to add new features or modify existing ones." },
            security: { type: Type.STRING, description: "Identification of potential security vulnerabilities or bad practices (e.g., hardcoded secrets, lack of input validation)." },
        },
        required: ["readability", "extensibility", "security"],
    }
  },
  required: ["overview", "components", "technologies", "businessFlowDiagram", "sequenceDiagram", "screenTransitionDiagram", "databaseERD", "screenDescriptions", "codeQualityAnalysis"],
};

const hasRenderableGraphDiagram = (diagram?: string | null): boolean => {
  if (!diagram) return false;
  const trimmed = diagram.trim();
  if (!trimmed) return false;
  if (!/^graph\s/i.test(trimmed)) return false;

  const statementLines = trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.toLowerCase().startsWith('graph '));

  if (statementLines.length === 0) return false;

  const hasNode = statementLines.some(line => /\w+\s*(?:\[|\(|\{)/.test(line));
  const hasEdge = statementLines.some(line => /-->|---|==>|=>|-\.\->|-\+->/.test(line));

  return hasNode && hasEdge;
};

const graphDiagramSchema = {
  type: Type.STRING,
  description: `Only the MermaidJS 'graph TD' diagram output. ${MERMAID_GRAPH_TD_RULES}`,
};

type GraphDiagramKey = 'businessFlowDiagram' | 'screenTransitionDiagram';

const escapeLabel = (text: string) => text.replace(/"/g, '\\"').trim();

const logDiagramResponse = (source: string, diagramType: GraphDiagramKey, diagram?: string | null) => {
  const header = `[Gemini][${source}] ${diagramType}`;
  if (!diagram) {
    console.warn(`${header}: <empty>`);
    return;
  }
  console.log(`${header}:\n${diagram}`);
};

const pickComponentLabel = (components: AnalysisResult['components'], keywords: RegExp, fallback: string) => {
  const found = components.find((component) => keywords.test(component.name) || keywords.test(component.path));
  if (!found) return fallback;
  const description = found.description ? ` - ${found.description}` : '';
  return `${found.name}${description}`;
};

const buildBusinessFlowFallback = (result: AnalysisResult): string => {
  const screens = result.screenDescriptions.length ? result.screenDescriptions : [{
    screenName: 'Primary Screen',
    description: 'Key user interaction surface',
    uiElements: [],
    events: [],
    validations: [],
  }];

  const flowNodes = screens.slice(0, 3);
  const userNode = 'User["User initiates action"]';

  const uiNodes = flowNodes.map((screen, index) =>
    `UI${index}["${escapeLabel(screen.screenName)}"]`
  );

  const backendLabel = escapeLabel(
    pickComponentLabel(
      result.components,
      /(service|controller|api|logic|backend|handler)/i,
      'Application Logic Layer'
    )
  );

  const dataLabel = escapeLabel(
    pickComponentLabel(
      result.components,
      /(repository|dao|model|entity|database|db|storage|persistence)/i,
      'Data Store'
    )
  );

  const nodes = [
    'graph TD',
    `  ${userNode}`,
    ...uiNodes.map((node) => `  ${node}`),
    `  Logic["${backendLabel}"]`,
    `  Data["${dataLabel}"]`,
    '  Outcome["Business outcome delivered"]',
  ];

  const edges: string[] = [];
  if (uiNodes.length) {
    edges.push(`  User --> ${uiNodes[0].split('[')[0]}`);
    for (let i = 1; i < uiNodes.length; i++) {
      edges.push(`  ${uiNodes[i - 1].split('[')[0]} --> ${uiNodes[i].split('[')[0]}`);
    }
    edges.push(`  ${uiNodes[uiNodes.length - 1].split('[')[0]} --> Logic`);
  } else {
    edges.push('  User --> Logic');
  }

  edges.push('  Logic --> Data');
  edges.push('  Data --> Logic');
  edges.push('  Logic --> Outcome');

  return [...nodes, ...edges].join('\n');
};

const buildScreenTransitionFallback = (screens: ScreenDescription[]): string => {
  const list = screens.length ? screens : [{
    screenName: 'Main Screen',
    description: '',
    uiElements: [],
    events: [],
    validations: [],
  }];

  const baseNodes = list.map((screen, index) => {
    const id = `Screen${index}`;
    return { id, label: escapeLabel(screen.screenName || `Screen ${index + 1}`) };
  });

  const lines = ['graph TD', '  Start["User Entry"]', '  EndPoint["Goal Achieved"]'];
  baseNodes.forEach(({ id, label }) => lines.push(`  ${id}["${label}"]`));

  if (baseNodes.length) {
    lines.push(`  Start --> ${baseNodes[0].id}`);
    for (let i = 1; i < baseNodes.length; i++) {
      lines.push(`  ${baseNodes[i - 1].id} --> ${baseNodes[i].id}`);
    }
    lines.push(`  ${baseNodes[baseNodes.length - 1].id} --> EndPoint`);
  } else {
    lines.push('  Start --> EndPoint');
  }

  return lines.join('\n');
};

const buildFallbackDiagram = (key: GraphDiagramKey, result: AnalysisResult): string => {
  if (key === 'screenTransitionDiagram') {
    return buildScreenTransitionFallback(result.screenDescriptions);
  }
  return buildBusinessFlowFallback(result);
};

export const ensureGraphDiagrams = (result: AnalysisResult): AnalysisResult => {
  const normalized: AnalysisResult = {
    ...result,
  };

  (['businessFlowDiagram', 'screenTransitionDiagram'] as GraphDiagramKey[]).forEach((key) => {
    if (!hasRenderableGraphDiagram(normalized[key])) {
      normalized[key] = buildFallbackDiagram(key, normalized);
    }
  });

  return ensureScreenDescriptionsMatchDiagram(normalized);
};

const extractScreenNamesFromDiagram = (diagram?: string | null): string[] => {
  if (!diagram) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  const nodeRegex = /(\w+)\s*(?:\[\s*"([^"]+)"\s*\]|\(\s*"([^"]+)"\s*\)|\{\s*"([^"]+)"\s*\})/g;
  let match: RegExpExecArray | null;
  while ((match = nodeRegex.exec(diagram)) !== null) {
    const label = match[2] || match[3] || match[4];
    if (!label) continue;
    const normalized = label.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    names.push(normalized);
  }
  return names;
};

const createPlaceholderScreen = (name: string): ScreenDescription => ({
  screenName: name,
  description: `${name} screen (auto-generated placeholder).`,
  uiElements: ['Main content panel', 'Summary widget'],
  events: ['User reviews data', 'User navigates to other screens'],
  validations: ['Basic validation is not specified'],
});

const ensureScreenDescriptionsMatchDiagram = (result: AnalysisResult): AnalysisResult => {
  const diagramScreens = extractScreenNamesFromDiagram(result.screenTransitionDiagram);
  if (!diagramScreens.length) {
    return result;
  }

  const existingMap = new Map<string, ScreenDescription>();
  result.screenDescriptions.forEach((screen) => {
    existingMap.set(screen.screenName.trim().toLowerCase(), screen);
  });

  const synchronized = diagramScreens.map((screenName) => {
    const key = screenName.trim().toLowerCase();
    return existingMap.get(key) ?? createPlaceholderScreen(screenName);
  });

  const extras = result.screenDescriptions.filter((screen) => {
    const key = screen.screenName.trim().toLowerCase();
    return !diagramScreens.some((label) => label.trim().toLowerCase() === key);
  });

  return {
    ...result,
    screenDescriptions: [...synchronized, ...extras],
  };
};

const buildGraphPrompt = (
  diagramType: GraphDiagramKey,
  language: string,
  projectAsText: string,
  screenDescriptions: ScreenDescription[]
): string => {
  const base = `
    You are a senior analyst. Output ONLY a valid MermaidJS 'graph TD' diagram with no backticks, no fencing and no prose.
    Critical rules (violating any of these makes the diagram unusable):
    1. The very first line must be exactly: graph TD
    2. Never include semicolons anywhere in the diagram.
    3. Every node or subgraph label MUST be wrapped in double quotes, e.g., A["ユーザー"].
    4. Node identifiers (A, Step1, Backend) must be ASCII-only with no spaces.
    5. Every edge label must be wrapped like -->|"Some Label"|, with no spaces between the pipe and the quote.
    6. Each statement must be on its own line: node definitions on separate lines, edges on separate lines.
    7. Do not add decorative text, comments, markdown, or code fences—only the diagram content.
    Keep all labels strictly in ${language}.
  `;

  if (diagramType === 'screenTransitionDiagram') {
    const screensSummary = screenDescriptions
      .map((screen) => `- ${screen.screenName}: ${screen.description}`)
      .join('\n');

    return `
      ${base}
      Diagram Type: Screen Transition Diagram.
      Goal: Visualize how a user moves between the major UI screens or flows.
      Use the inferred navigation paths from the project plus these screen descriptions:
      ${screensSummary || 'No screen descriptions were provided; infer from the project structure.'}

      Project context (files and contents):
      ${projectAsText}
    `;
  }

  return `
    ${base}
    Diagram Type: Business Flow Diagram.
    Goal: Capture the primary business/user process end-to-end (e.g., user action -> backend -> database).

    Project context (files and contents):
    ${projectAsText}
  `;
};

const regenerateGraphDiagram = async (
  diagramType: GraphDiagramKey,
  projectAsText: string,
  language: string,
  screenDescriptions: ScreenDescription[]
): Promise<string> => {
  const prompt = buildGraphPrompt(diagramType, language, projectAsText, screenDescriptions);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: graphDiagramSchema,
      temperature: 0.1,
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("Received an empty response while regenerating the business flow diagram.");
  }

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') {
      return parsed;
    }
    return text;
  } catch {
    return text;
  }
};

export const analyzeProject = async (file: File, language: string): Promise<AnalysisResult> => {
  // 1. Process the ZIP file into a single text string.
  const projectAsText = await processZipFileToString(file);
  rememberProjectContext(projectAsText);

  const prompt = `
    As a senior software architect, analyze the provided project source code.
    The following text contains the file paths and contents of a software project.
    Deconstruct the project's architecture, identify components, technologies, and user flows based on this source code.
    Provide a comprehensive analysis. Your entire response MUST be in ${language}.
    
    Specifically, you must:
    1.  Provide a high-level overview of the project.
    2.  Identify all major frontend and backend components, their file paths, and their responsibilities.
    3.  List the technologies, frameworks, and libraries used, categorized appropriately.
    4.  Create a business flow diagram in MermaidJS 'graph TD' syntax.
    5.  Create a sequence diagram in MermaidJS syntax that shows the interaction for the most critical user flow (e.g., login, data submission).
    6.  Create a screen transition diagram in MermaidJS 'graph TD' syntax.
    7.  If a database schema is present or implied, create an Entity-Relationship Diagram (ERD) in MermaidJS syntax. If no database is detected, return an empty string for this field.
    8.  Describe each distinct user screen, detailing its purpose, UI elements, user events, and any validation logic.
    9.  Provide an analysis of the source code's quality, covering readability, extensibility, and potential security issues.

    For all MermaidJS diagrams, you must ensure the generated syntax is 100% valid and strictly follows the specific rules provided for each diagram type in the schema. Invalid syntax will break the application.
    Your response MUST be a single JSON object that strictly adheres to the provided schema. Do not include any text, markdown formatting, or explanations outside of the JSON object itself.
  `;

  // 2. Combine the prompt and the project text.
  const fullPrompt = `${prompt}\n\n${projectAsText}`;

  // Per guidelines, use gemini-2.5-pro for complex text tasks.
  const model = "gemini-2.5-pro";
  
  // 3. Send the single text prompt to the API.
  const response = await ai.models.generateContent({
    model: model,
    contents: fullPrompt, // The entire project and prompt are now one string
    config: {
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
      // Increase temperature slightly for more creative/insightful analysis
      temperature: 0.2, 
    }
  });

  const text = response.text;
  
  if (!text) {
    throw new Error("Received an empty response from the CMC-Japan AI API.");
  }

  try {
    const parsed = JSON.parse(text) as AnalysisResult;

    const graphKeys: GraphDiagramKey[] = ['businessFlowDiagram', 'screenTransitionDiagram'];
    for (const key of graphKeys) {
      logDiagramResponse('initial', key, parsed[key]);
      if (!hasRenderableGraphDiagram(parsed[key])) {
        try {
          const regenerated = await regenerateGraphDiagram(
            key,
            projectAsText,
            language,
            parsed.screenDescriptions || []
          );
          logDiagramResponse('regenerated', key, regenerated);
          if (hasRenderableGraphDiagram(regenerated)) {
            parsed[key] = regenerated;
            continue;
          }
        } catch (fallbackError) {
          console.error(`Failed to regenerate ${key}:`, fallbackError);
        }

        if (!hasRenderableGraphDiagram(parsed[key])) {
          parsed[key] = buildFallbackDiagram(key, parsed);
        }
      }
    }

    return ensureGraphDiagrams(parsed);
  } catch (e) {
    console.error("Failed to parse CMC-Japan AI response as JSON:", text);
    throw new Error("The analysis result was not in the expected format.");
  }
};

const sanitizeHtmlResponse = (html: string) =>
  html
    .replace(/```(?:html|css|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .trim();

export const rebuildScreenUI = async (screen: ScreenDescription, language: string): Promise<string> => {
  const projectContext = getProjectContext();
  const prompt = `
    You are a senior front-end developer. Rebuild the existing UI for the following screen directly from the project's source code.
    Goal: generate HTML + CSS (and minimal inline JS only when strictly necessary for small interactions) that matches the project's ORIGINAL, LEGACY layout and styling as closely as possible. This is for side-by-side comparison with a modernized prototype, so DO NOT modernize or beautify beyond what the source implies.
    Rules:
    - Keep all visible text in ${language}.
    - Reuse the visual language found in the source (color palette, spacing, typography, preferred components). If the project leans on utility classes (e.g., Tailwind), prefer them instead of inventing brand new styles.
    - Preserve legacy feel: keep any dated gradients, borders, drop shadows, table-heavy layouts, condensed padding, default/older fonts, and conservative spacing if those patterns are present. Avoid rounded-pill buttons or flashy neon themes unless clearly in the source.
    - Do not embed or reference images; rely on HTML and CSS only.
    - Make the snippet self-contained: wrap the screen in a distinct container like <section data-screen=\"${screen.screenName}\"> and include scoped <style>. Any JS must guard DOM queries and run after DOMContentLoaded.
    - Output pure HTML (no markdown fences) so it can be injected directly into an iframe's srcDoc.
    - Preserve any meaningful sample data you infer from the source; otherwise use lightweight placeholders consistent with the screen purpose.
\n    Project source context (truncated to ${PROJECT_CONTEXT_LIMIT} characters):\n    ${projectContext ?? '[context unavailable; rely on the screen description]'}\n
    Screen specification:
    Name: ${screen.screenName}
    Purpose: ${screen.description}
    UI Elements: ${screen.uiElements.join(', ') || 'Not specified'}
    Events: ${screen.events.join(', ') || 'Not specified'}
    Validations: ${screen.validations.join(', ') || 'None specified'}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        temperature: 0.25,
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      throw new Error("Received an empty response when rebuilding the UI.");
    }

    const cleaned = sanitizeHtmlResponse(raw);
    if (!cleaned) {
      throw new Error("The rebuilt UI was empty after sanitization.");
    }

    return cleaned;
  } catch (e: any) {
    console.error("Failed to rebuild UI:", e);
    throw new Error("The UI could not be rebuilt. " + (e.message || ""));
  }
};

interface PrototypeReferenceImage {
  dataUrl: string;
  mimeType: string;
}

export const generateInteractivePrototype = async (
  screens: ScreenDescription[],
  language: string,
  referenceImage?: PrototypeReferenceImage
): Promise<string> => {
  if (!screens.length) {
    throw new Error("Please select at least one screen for the prototype.");
  }

  const screenSpecs = screens.map((screen, index) => {
    return `
      Screen ${index + 1}: ${screen.screenName}
      Purpose: ${screen.description}
      Key UI Elements: ${screen.uiElements.join(', ') || 'Not specified'}
      Expected Events: ${screen.events.join(', ') || 'Not specified'}
      Validations or Data Requirements: ${screen.validations.join(', ') || 'Not specified'}
    `;
  }).join('\n\n');

  const entryScreen = screens[0]?.screenName ?? 'Main Screen';

const promptIntro = `
    You are a senior front-end engineer. Create a complete, self-contained HTML prototype that represents the following screens.
    Core requirements for the prototype:
    1. All visible text, sample data, labels, and messages must be in ${language}.
    2. Build everything in a single HTML document with inline <style> (modern, clean, responsive CSS) and inline <script> (vanilla JS only). All scripts must run after DOMContentLoaded or be placed at the end of <body>.
    3. Treat "${entryScreen}" as the landing screen. Provide a persistent navigation (header/side nav or floating panel) that lets the user move between every screen without reloading.
    4. Implement the described actions/events. Buttons such as "Approve", "Submit", "Go to Dashboard", or "ログイン" must execute JavaScript handlers that update dummy data/state and navigate to the appropriate screen so the flow feels alive. Every querySelector must be guarded so you never call methods on null.
    5. Maintain simple JavaScript state objects/arrays (e.g., employees, requests, tasks) with believable dummy data. Render those datasets in tables, cards, or lists depending on the screen context. When an action mutates data (e.g., approving a request), update the state and re-render.
    6. Always include form validation feedback, modal/dialog interactions, and conditional views when the screen descriptions mention validations or branching outcomes.
    7. If a login or authentication screen exists, treat it as a mock flow: accept any non-empty credentials, set a 'loggedIn' flag, and immediately move the user to the next logical screen; a logout action must always return to the login screen. Do NOT reject any credentials in the prototype or show blocking error states—this is purely for demonstration. Never reference undefined DOM nodes when switching screens.
    8. All screens must be rendered inside <section data-screen="..."> containers. Provide a reusable showScreen(name) helper that toggles a '.hidden { display: none; }' class on these sections instead of removing them from the DOM, so navigation is instant.
    9. Populate each screen with realistic dummy data (tables, cards, analytic summaries, charts, or forms) so stakeholders can understand the future app’s look and flow before migration. Every screen must display at least two distinct UI widgets (for example: KPI cards + table, chart + activity list) even when the original description is sparse.
   10. When a screen description lacks specific data, infer a reasonable dataset from the other screens (e.g., employee profiles, departments, requests) and show placeholder records with labels in ${language}.
   11. Do NOT wrap the HTML in markdown fences. The output must be pure HTML.

    Screen specifications:
    ${screenSpecs}
  `;

  const textPart = {
    text: referenceImage
      ? `${promptIntro}\n\nUse the attached reference image to inspire the layout, color palette, component styling, and typography.`
      : promptIntro,
  };

  const parts: any[] = [textPart];

  if (referenceImage?.dataUrl) {
    const [, base64Data] = referenceImage.dataUrl.split(',');
    if (base64Data) {
      parts.push({
        inlineData: {
          mimeType: referenceImage.mimeType || 'image/png',
          data: base64Data,
        }
      });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        temperature: 0.4,
      }
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error("Received an empty response from the prototype generator.");
    }

    return text;
  } catch (e: any) {
    console.error("Failed to generate interactive prototype:", e);
    throw new Error("The prototype could not be generated. " + (e.message || ""));
  }
};


const architectureSuggestionSchema = {
  type: Type.OBJECT,
  properties: {
    businessProcess: {
      type: Type.OBJECT,
      properties: {
        diagram: { type: Type.STRING, description: `An improved business flow. ${MERMAID_GRAPH_TD_RULES}` },
        explanation: { type: Type.STRING, description: "A textual explanation of the business process improvements." }
      },
      required: ["diagram", "explanation"]
    },
    overallArchitecture: {
      type: Type.OBJECT,
      properties: {
        asIsDiagram: { type: Type.STRING, description: `The current ('As-Is') architecture. ${MERMAID_GRAPH_TD_RULES}` },
        toBeDiagram: { type: Type.STRING, description: `The proposed ('To-Be') architecture. ${MERMAID_GRAPH_TD_RULES}` },
        explanation: { type: Type.STRING, description: "An explanation of the architectural changes and benefits." }
      },
      required: ["asIsDiagram", "toBeDiagram", "explanation"]
    },
    specificPoints: {
      type: Type.OBJECT,
      properties: {
        asIs: { type: Type.STRING, description: "A description of a specific problem or area for improvement in the current system ('As-Is')." },
        toBe: { type: Type.STRING, description: "A description of the proposed solution or improved state ('To-Be')." },
        explanation: { type: Type.STRING, description: "An explanation of why this specific change is an improvement." }
      },
      required: ["asIs", "toBe", "explanation"]
    }
  },
  required: ["businessProcess", "overallArchitecture", "specificPoints"]
};

export const getArchitectureSuggestion = async (overview: string, targetTech: string, language: string): Promise<ArchitectureSuggestion> => {
    const prompt = `
        You are a senior solution architect. Based on the following project overview, provide a detailed and structured suggestion on how to improve its architecture by migrating to ${targetTech}.

        Project Overview:
        "${overview}"

        Your response MUST be a single JSON object that strictly adheres to the provided schema. Do not include any text, markdown formatting, or explanations outside of the JSON object itself.
        Your entire response, including all text and explanations inside the JSON, MUST be in ${language}.

        Your suggestion must be broken down into three parts:
        1.  **Business Process Improvement**: Analyze the implied business logic and suggest an improved flow. Provide a MermaidJS 'graph TD' diagram for the new flow and a clear explanation.
        2.  **Overall Architecture Improvement**: Create two MermaidJS 'graph TD' diagrams: one for the current 'As-Is' architecture and one for the proposed 'To-Be' architecture using ${targetTech}. Explain the key changes, benefits (like scalability, maintainability), and potential challenges.
        3.  **Specific Improvement Points**: Identify a key weakness in the current project (e.g., security, performance, code structure). Describe the 'As-Is' problem and the proposed 'To-Be' solution, and explain the benefits.

        For all MermaidJS diagrams, you must ensure the syntax is 100% valid and strictly follows the detailed rules provided for each diagram type in the response schema. Failure to do so will break the application.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: architectureSuggestionSchema,
            }
        });

        const text = response.text;
        if (!text) {
            throw new Error("Received an empty response from the API.");
        }
        return JSON.parse(text) as ArchitectureSuggestion;
    } catch (e: any) {
        console.error("Failed to generate architecture suggestion:", e);
        throw new Error("The architecture suggestion could not be generated. " + (e.message || ""));
    }
};
