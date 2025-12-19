// utils/vineReputation/tiers.ts
export type RepTier = {
  label: string;
  tone: string;          // rgba background
  percentile?: number;   // 0..1 (top fraction)
};

const BI_ZERO = BigInt(0);

/**
 * Build sorted rep distribution (DESC).
 * Default excludes zeros so “Top X%” stays meaningful.
 */
export function buildRepDistribution(
  repByWallet: Record<string, bigint>,
  opts?: { includeZeros?: boolean }
): bigint[] {
  const includeZeros = opts?.includeZeros ?? false;

  const vals = Object.values(repByWallet).map((v) => v ?? BI_ZERO);
  const filtered = includeZeros ? vals : vals.filter((v) => v > BI_ZERO);

  // DESC
  filtered.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
  return filtered;
}

export function formatTopPct(topFrac?: number): string | null {
  if (topFrac == null) return null;
  const pct = topFrac * 100;

  if (pct <= 1) return "Top 1%";
  if (pct <= 5) return "Top 5%";
  if (pct <= 10) return "Top 10%";
  if (pct <= 20) return "Top 20%";
  if (pct <= 35) return "Top 35%";
  if (pct <= 50) return "Top 50%";
  if (pct <= 75) return "Top 75%";
  return "Top 100%";
}

/**
 * Returns top fraction (0..1), where 0.01 == top 1%.
 * Stable with ties (uses first index where dist[i] <= rep in a DESC list).
 */
export function percentileForRep(rep: bigint, distDesc: bigint[]): number | undefined {
  if (!distDesc || distDesc.length === 0) return undefined;

  // treat 0 as bottom
  if (rep <= BI_ZERO) return 1;

  let lo = 0;
  let hi = distDesc.length - 1;
  let ans = distDesc.length;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = distDesc[mid];

    // DESC: first index where v <= rep
    if (v <= rep) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  const idx = Math.min(ans, distDesc.length - 1);
  return idx / distDesc.length; // 0..1
}

/**
 * Percentile-only tiers (distribution-aware).
 */
export function getReputationTier(rep: bigint, distDesc: bigint[]): RepTier {
  if (rep <= BI_ZERO) {
    return { label: "Newcomer", tone: "rgba(148,163,184,0.10)", percentile: 1 };
  }

  const topFrac = percentileForRep(rep, distDesc);
  if (topFrac === undefined) {
    return { label: "Checked In", tone: "rgba(34,197,94,0.16)" };
  }

  const topPct = Math.max(1, Math.ceil(topFrac * 100));

// inside getReputationTier(rep, distDesc)

if (topPct <= 1)   return { label: "Vine OG",          tone: "rgba(250,204,21,0.22)", percentile: topFrac };
if (topPct <= 3)   return { label: "Inner Circle",     tone: "rgba(250,204,21,0.18)", percentile: topFrac };
if (topPct <= 5)   return { label: "Core Member",      tone: "rgba(56,189,248,0.18)", percentile: topFrac };

if (topPct <= 8)   return { label: "Community Pillar", tone: "rgba(56,189,248,0.14)", percentile: topFrac };
if (topPct <= 12)  return { label: "Key Contributor",  tone: "rgba(167,139,250,0.18)", percentile: topFrac };
if (topPct <= 18)  return { label: "Contributor",      tone: "rgba(167,139,250,0.14)", percentile: topFrac };

if (topPct <= 25)  return { label: "Active Voice",     tone: "rgba(34,197,94,0.18)",  percentile: topFrac };
if (topPct <= 35)  return { label: "Active Member",    tone: "rgba(34,197,94,0.14)",  percentile: topFrac };
if (topPct <= 45)  return { label: "Engaged",          tone: "rgba(34,197,94,0.12)",  percentile: topFrac };

if (topPct <= 60)  return { label: "Participating",    tone: "rgba(148,163,184,0.16)", percentile: topFrac };
if (topPct <= 75)  return { label: "Following",        tone: "rgba(148,163,184,0.14)", percentile: topFrac };
if (topPct <= 90)  return { label: "Checked In",       tone: "rgba(148,163,184,0.12)", percentile: topFrac };

return { label: "Newcomer", tone: "rgba(148,163,184,0.10)", percentile: topFrac };
}