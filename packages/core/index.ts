export type AnalysisResult = {
  score: number;
  routes: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const binding = (globalThis as any).__xrayBinding ?? {
  analyzeRoutes: (input: string) => JSON.stringify({ score: 0, routes: input ? [input] : [] })
};

export function analyzeRoutes(input: string): AnalysisResult {
  return JSON.parse(binding.analyzeRoutes(input)) as AnalysisResult;
}
