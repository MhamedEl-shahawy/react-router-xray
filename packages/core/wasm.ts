export type AnalysisResult = {
  score: number;
  routes: string[];
};

export type ParsedPattern = {
  raw: string;
  segments: string[];
  dynamic_params: string[];
  has_wildcard: boolean;
};

export async function init(): Promise<void> {
  // Placeholder for generated wasm init loader.
}

export async function analyzeRoutes(input: string): Promise<AnalysisResult> {
  return { score: input.length > 0 ? 1 : 0, routes: input ? [input] : [] };
}

export async function parsePattern(pattern: string): Promise<ParsedPattern> {
  const segments = pattern.split("/").filter(Boolean);
  return {
    raw: pattern,
    segments,
    dynamic_params: segments.filter((segment) => segment.startsWith(":")).map((segment) => segment.slice(1)),
    has_wildcard: segments.some((segment) => segment.includes("*"))
  };
}
