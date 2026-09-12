export interface NumericRange {
  min: string;
  max: string;
}

const hasBound = (value: string) => value.trim() !== '';

export const matchesNumericRange = (
  value: number | undefined,
  min: string,
  max: string,
) => {
  const hasMin = hasBound(min);
  const hasMax = hasBound(max);
  if (!hasMin && !hasMax) return true;
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;

  const minValue = hasMin ? Number(min) : Number.NEGATIVE_INFINITY;
  const maxValue = hasMax ? Number(max) : Number.POSITIVE_INFINITY;
  return value >= minValue && value <= maxValue;
};

export const getCirculatingSize = (issueSize: number, restrictedRatio: number) => (
  issueSize * (1 - restrictedRatio / 100)
);

export const matchesBondScaleRanges = (
  issueSize: number,
  restrictedRatio: number | undefined,
  issueRange: NumericRange,
  circulatingRange: NumericRange,
) => {
  const circulatingFilterActive = hasBound(circulatingRange.min) || hasBound(circulatingRange.max);
  if (!matchesNumericRange(issueSize, issueRange.min, issueRange.max)) return false;
  if (!circulatingFilterActive) return true;
  if (typeof restrictedRatio !== 'number' || !Number.isFinite(restrictedRatio)) return false;

  return matchesNumericRange(
    getCirculatingSize(issueSize, restrictedRatio),
    circulatingRange.min,
    circulatingRange.max,
  );
};

export const marketCapYuanToYi = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed / 100_000_000 : undefined;
};

export const getIssueToMarketCapRatio = (issueSize: number, marketCap?: number) => (
  typeof marketCap === 'number' && marketCap > 0
    ? (issueSize / marketCap) * 100
    : undefined
);

export const matchesMarketCapRanges = (
  marketCap: number | undefined,
  issueSize: number,
  marketCapRange: NumericRange,
  issueRatioRange: NumericRange,
) => (
  matchesNumericRange(marketCap, marketCapRange.min, marketCapRange.max)
  && matchesNumericRange(
    getIssueToMarketCapRatio(issueSize, marketCap),
    issueRatioRange.min,
    issueRatioRange.max,
  )
);

interface HolderRow {
  END_DATE?: string;
  HOLDER_RANK?: number;
  HOLD_NUM_RATIO?: number;
}

export const getRestrictedRatioFromHolders = (holders: HolderRow[] | undefined) => {
  if (!Array.isArray(holders) || holders.length === 0) return undefined;

  const datesMap = new Map<string, HolderRow[]>();
  for (const holder of holders) {
    if (!holder.END_DATE) continue;
    const rows = datesMap.get(holder.END_DATE) || [];
    rows.push(holder);
    datesMap.set(holder.END_DATE, rows);
  }

  const sortedDates = Array.from(datesMap.keys()).sort((a, b) => b.localeCompare(a));
  if (sortedDates.length === 0) return undefined;
  const reportDate = sortedDates.find(date => (datesMap.get(date)?.length || 0) >= 8) || sortedDates[0];
  const latestHolders = datesMap.get(reportDate) || [];
  const majorHolders = latestHolders.filter(holder => (
    holder.HOLDER_RANK === 1 || Number(holder.HOLD_NUM_RATIO) >= 5
  ));

  return majorHolders.reduce((sum, holder) => sum + (Number(holder.HOLD_NUM_RATIO) || 0), 0);
};
