export type LoadContributor = {
  id: string;
  /** Short label shown in the breakdown table */
  label: string;
  /** Points deducted from the perfect 100 (transparent math). */
  penaltyPoints: number;
  /** One sentence a developer can audit */
  detail: string;
};

export type ClarityTier = "minimal" | "moderate" | "noticeable" | "heavy";

export type AnalysisMetrics = {
  routePathsAnalyzed: number;
  maxPathDepth: number;
  dynamicParamsTotal: number;
  wildcardsTotal: number;
  /** 0–100 heuristic: higher means this matched chain & URLs look easier to maintain (overlay-only). */
  clarityScore: number;
  /** Sum of penalties before capping (same units as contributor rows). */
  structuralPenalty: number;
  tier: ClarityTier;
  contributors: LoadContributor[];
  /** Plain-language summary for the hero row */
  headline: string;
};

export type AnalysisResult = {
  /**
   * Same as `metrics.clarityScore` — kept for backwards compatibility.
   * **Higher is better** (easier structure for this navigation).
   */
  score: number;
  routes: string[];
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

function tierFromClarity(clarity: number): ClarityTier {
  if (clarity >= 85) return "minimal";
  if (clarity >= 68) return "moderate";
  if (clarity >= 45) return "noticeable";
  return "heavy";
}

function headlineFor(
  tier: ClarityTier,
  metrics: Pick<
    AnalysisMetrics,
    "routePathsAnalyzed" | "maxPathDepth" | "dynamicParamsTotal" | "wildcardsTotal"
  >
): string {
  const { routePathsAnalyzed, maxPathDepth, dynamicParamsTotal, wildcardsTotal } = metrics;
  if (routePathsAnalyzed === 0) {
    return "Navigate to a route to score this navigation.";
  }
  switch (tier) {
    case "minimal":
      return "Shallow URLs and a compact matched chain—this screen should be straightforward to bundle and reason about.";
    case "moderate":
      return "Some structural weight from segment depth, params, or layout breadth—still healthy for many apps.";
    case "noticeable":
      return "Routing surface is getting busy—good moment to audit lazy loading, boundaries, and URL depth.";
    default:
      return "Heavy routing footprint from paths alone—prioritize flattening, fewer wildcards, and lazy leaf routes.";
  }
}

/**
 * Overlay heuristic only (pathname rows). Penalties deduct from 100 to form **clarityScore**.
 * Not identical to full Rust tree analysis (loaders, lazy flags, etc.).
 */
function computeClarityMetrics(base: {
  routePathsAnalyzed: number;
  maxPathDepth: number;
  dynamicParamsTotal: number;
  wildcardsTotal: number;
}): AnalysisMetrics {
  const { routePathsAnalyzed, maxPathDepth, dynamicParamsTotal, wildcardsTotal } = base;

  const matchedChain = Math.max(0, routePathsAnalyzed - 1) * 5;
  const urlDepth = Math.max(0, maxPathDepth - 1) * 10;
  const dynamicPenalty = dynamicParamsTotal * 8;
  const wildcardPenalty = wildcardsTotal * 15;

  const contributors: LoadContributor[] = [
    {
      id: "chain",
      label: "Matched chain",
      penaltyPoints: matchedChain,
      detail:
        routePathsAnalyzed <= 1
          ? "Single pathname row (layout + leaf collapsed to one line). No breadth penalty."
          : `${routePathsAnalyzed} pathname rows (layouts + leaf). Each extra row adds +5 points—more ancestors mean more boundaries and context switching.`,
    },
    {
      id: "depth",
      label: "URL segment depth",
      penaltyPoints: urlDepth,
      detail:
        maxPathDepth <= 1
          ? "Paths stay at root depth—no extra nesting penalty."
          : `Deepest pathname uses ${maxPathDepth} segment(s). Beyond depth 1 adds +10 per extra segment.`,
    },
    {
      id: "dynamic",
      label: "Dynamic params (:id)",
      penaltyPoints: dynamicPenalty,
      detail:
        dynamicParamsTotal === 0
          ? "No dynamic segments detected in these pathnames."
          : `${dynamicParamsTotal} dynamic segment(s); each adds +8—ensure loaders validate input.`,
    },
    {
      id: "wildcard",
      label: "Wildcards (*)",
      penaltyPoints: wildcardPenalty,
      detail:
        wildcardsTotal === 0
          ? "No wildcard markers."
          : `${wildcardsTotal} wildcard(s); each adds +15—prefer explicit routes when possible.`,
    },
  ];

  const rawPenalty = matchedChain + urlDepth + dynamicPenalty + wildcardPenalty;
  const structuralPenalty = Math.min(92, rawPenalty);
  const clarityScore = Math.round(100 - structuralPenalty);
  const tier = tierFromClarity(clarityScore);

  return {
    routePathsAnalyzed,
    maxPathDepth,
    dynamicParamsTotal,
    wildcardsTotal,
    clarityScore,
    structuralPenalty,
    tier,
    contributors,
    headline: headlineFor(tier, base),
  };
}

function collectInsights(params: {
  clarityScore: number;
  tier: ClarityTier;
  metrics: AnalysisMetrics;
  paths: string[];
}): string[] {
  const { clarityScore, tier, metrics, paths } = params;
  const insights: string[] = [];

  const counts = new Map<string, number>();
  for (const p of paths) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p);
  if (duplicates.length > 0) {
    insights.push(
      `Duplicate pathnames in this chain (${duplicates.join(", ")}). Usually fine for layouts sharing a URL—otherwise investigate collisions.`
    );
  }

  if (metrics.maxPathDepth >= 5) {
    insights.push(
      "URLs run deep—consider fewer nested layouts or grouping unrelated segments behind feature folders."
    );
  }
  if (metrics.dynamicParamsTotal >= 3) {
    insights.push(
      "Several `:param` segments—centralize validation in loaders and keep critical flows tested."
    );
  }
  if (metrics.wildcardsTotal > 0) {
    insights.push(
      "Wildcard routes broaden matching—pair with explicit children where you care about SEO or prefetch."
    );
  }
  if (metrics.routePathsAnalyzed >= 8) {
    insights.push(
      "Large matched chain—ensure expensive leaf routes stay lazy and errors surface via boundaries."
    );
  }

  if (tier === "heavy" || tier === "noticeable") {
    insights.push(
      "Expand the clarity breakdown below to see exactly which factors subtracted points."
    );
  }

  if (clarityScore >= 85) {
    insights.push(
      "Strong baseline for this navigation—wire `handle.xray` metadata for component-level audits and pair with the CLI on CI."
    );
  }

  insights.push(
    "Optional: add `handle.xray` (`component`, `lazy`, `errorBoundary`) so matched rows show richer labels."
  );

  return insights;
}

export async function analyzeRoutes(input: string): Promise<AnalysisResult> {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (!lines.length) {
    return {
      score: 0,
      routes: [],
      insights: ["Open the overlay after navigation—we analyze the active pathname rows shown above."],
      metrics: {
        routePathsAnalyzed: 0,
        maxPathDepth: 0,
        dynamicParamsTotal: 0,
        wildcardsTotal: 0,
        clarityScore: 0,
        structuralPenalty: 0,
        tier: "heavy",
        contributors: [],
        headline: "Navigate to a route to score this navigation.",
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

  const metrics = computeClarityMetrics({
    routePathsAnalyzed: paths.length,
    maxPathDepth,
    dynamicParamsTotal,
    wildcardsTotal,
  });

  const insights = collectInsights({
    clarityScore: metrics.clarityScore,
    tier: metrics.tier,
    metrics,
    paths,
  });

  return {
    score: metrics.clarityScore,
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
