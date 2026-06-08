/** RED — the score on an Initiative→Risk (`mitigates`) edge. */
export interface Red {
  relevance: number;
  extent: number;
  duration: number;
  assessmentDate?: string | null;
}

export const RED_AXES = ['relevance', 'extent', 'duration'] as const;

export function readRed(data: unknown): Red {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    relevance: Number(d.relevance ?? 0),
    extent: Number(d.extent ?? 0),
    duration: Number(d.duration ?? 0),
    assessmentDate: (d.assessmentDate as string) ?? null,
  };
}

export function redTotal(r: Red): number {
  return (r.relevance || 0) + (r.extent || 0) + (r.duration || 0);
}

/** Deterministic hue from a key, so an activity's colour is stable across loads. */
export function hueFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Three shades [light, mid, dark] for stacked RED bars (Relevance/Extent/Duration). */
export function redShades(key: string): [string, string, string] {
  const hue = hueFromKey(key);
  return [
    `hsl(${hue} 68% 72%)`,
    `hsl(${hue} 68% 58%)`,
    `hsl(${hue} 68% 44%)`,
  ];
}

/**
 * Coverage in [0,1] from a risk's mitigating edges. Relevance gates, Extent
 * scales, Duration sustains (a half-weight). Multiple edges combine with
 * diminishing overlap (not a naive sum).
 */
export function coverageFromReds(reds: Red[]): number {
  if (reds.length === 0) return 0;
  const perEdge = reds.map((r) => {
    const rel = clamp01(r.relevance / 4);
    const ext = clamp01(r.extent / 4);
    const dur = 0.5 + 0.5 * clamp01(r.duration / 4);
    return clamp01(rel * ext * dur);
  });
  return 1 - perEdge.reduce((acc, c) => acc * (1 - c), 1);
}

/** Residual exposure = inherent (likelihood×impact) moderated by coverage. */
export function residual(inherent: number, reds: Red[]): number {
  return Math.round(inherent * (1 - coverageFromReds(reds)) * 10) / 10;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}
