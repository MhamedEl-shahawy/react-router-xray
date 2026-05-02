export type AnalysisMetrics = {
  /** Distinct path lines analyzed (usually matched chain segments). */
  routePathsAnalyzed: number;
  /** Largest segment depth among those paths (segments after splitting on `/`). */
  maxPathDepth: number;
  /** Total count of `:param`-style segments across paths. */
  dynamicParamsTotal: number;
  /** Total `*` wildcard markers across paths. */
  wildcardsTotal: number;
};

export type AnalysisResult = {
  score: number;
  routes: string[];
  /** Short actionable tips derived from the path manifest (overlay mode). */
  insights: string[];
  metrics: AnalysisMetrics;
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

function normalizePathLine(line: string): string {
  let p = line.trim();
  if (!p) return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function segmentDepth(path: string): number {
  const segs = path.split("/").filter(Boolean);
  return Math.max(1, segs.length);
}

function countDynamicParams(path: string): number {
  return (path.match(/:[^/]+/g) ?? []).length;
}

function countWildcards(path: string): number {
  return (path.match(/\*/g) ?? []).length;
}

/**
 * Mirrors `complexity_score` in `packages/core/src/analyzer.rs` for path-only input:
 * min(100, max(0, maxDepth*3 + paramSum*2 + wildcardSum*4 + eagerRouteCount)).
 * Overlay lists matched pathnames only—lazy/metadata unknown—so each line counts as an eager route (matches Rust `eager_route_count` when nothing is lazy).
 */
function complexityScore(
  maxDepth: number,
  paramsSum: number,
  wildcardsSum: number,
  eagerRouteCount: number
): number {
  const raw = maxDepth * 3 + paramsSum * 2 + wildcardsSum * 4 + eagerRouteCount;
  return Math.min(100, Math.max(0, raw));
}

function collectInsights(params: {
  score: number;
  metrics: AnalysisMetrics;
  paths: string[];
}): string[] {
  const { score, metrics, paths } = params;
  const insights: string[] = [];

  const counts = new Map<string, number>();
  for (const p of paths) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p);
  if (duplicates.length > 0) {
    insights.push(
      `Duplicate paths in the analyzed list (${duplicates.join(", ")}). Usually harmless if layouts reuse pathname—otherwise fix collisions.`
    );
  }

  if (metrics.maxPathDepth >= 5) {
    insights.push(
      "URLs are deeply nested. Consider fewer nested layouts or shallower paths so bundles and suspense boundaries stay predictable."
    );
  }
  if (metrics.dynamicParamsTotal >= 3) {
    insights.push(
      "Several dynamic segments (`:id`-style). Validate params in loaders and cover critical branches with tests."
    );
  }
  if (metrics.wildcardsTotal > 0) {
    insights.push(
      "Wildcard segments make matching broader—prefer explicit routes unless you truly need a catch‑all."
    );
  }
  if (metrics.routePathsAnalyzed >= 8) {
    insights.push(
      "Many paths listed at once—ensure heavy leaf routes use `lazy()` so initial JS stays small."
    );
  }

  insights.push(
    "Tip: add `handle.xray` on routes (`component`, `lazy`, `errorBoundary`) so rows replace Unknown with real metadata."
  );

  if (score >= 70) {
    insights.push(
      "Score is high from paths alone—review nesting, wildcards, and how many segments ship eagerly on first paint."
    );
  } else if (score <= 12 && metrics.routePathsAnalyzed <= 3) {
    insights.push(
      "Low structural complexity on this navigation—good baseline. Use the CLI + full route manifest for CI‑grade checks."
    );
  }

  return insights;
}

export async function analyzeRoutes(input: string): Promise<AnalysisResult> {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (!lines.length) {
    return {
      score: 0,
      routes: [],
      insights: ["No paths were analyzed yet—open the panel after navigation or mount inside your router."],
      metrics: {
        routePathsAnalyzed: 0,
        maxPathDepth: 0,
        dynamicParamsTotal: 0,
        wildcardsTotal: 0,
      },
    };
  }

  const paths = lines.map(normalizePathLine);
  let maxPathDepth = 0;
  let dynamicParamsTotal = 0;
  let wildcardsTotal = 0;

  for (const p of paths) {
    maxPathDepth = Math.max(maxPathDepth, segmentDepth(p));
    dynamicParamsTotal += countDynamicParams(p);
    wildcardsTotal += countWildcards(p);
  }

  const eagerRouteCount = paths.length;
  const score = complexityScore(maxPathDepth, dynamicParamsTotal, wildcardsTotal, eagerRouteCount);

  const metrics: AnalysisMetrics = {
    routePathsAnalyzed: paths.length,
    maxPathDepth,
    dynamicParamsTotal,
    wildcardsTotal,
  };

  const insights = collectInsights({ score, metrics, paths });

  return {
    score,
    routes: paths,
    insights,
    metrics,
  };
}

export async function parsePattern(pattern: string): Promise<ParsedPattern> {
  const segments = pattern.split("/").filter(Boolean);
  return {
    raw: pattern,
    segments,
    dynamic_params: segments
      .filter((segment) => segment.startsWith(":"))
      .map((segment) => segment.slice(1)),
    has_wildcard: segments.some((segment) => segment.includes("*")),
  };
}
