import { marketCapYuanToYi } from './bondFilters';

type FetchLike = (url: string, options: RequestInit) => Promise<{
  ok: boolean;
  json: () => Promise<any>;
}>;

const MARKET_CAP_CACHE_MS = 24 * 60 * 60 * 1000;
const MARKET_CAP_FAILURE_CACHE_MS = 5 * 60 * 1000;

export const getMarketCapCacheTtl = (marketCap?: number) => (
  typeof marketCap === 'number' ? MARKET_CAP_CACHE_MS : MARKET_CAP_FAILURE_CACHE_MS
);

export const fetchMarketCapYi = async (
  stockCode: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 4000,
) => {
  const market = stockCode.startsWith('6') ? '1' : '0';
  const quoteHosts = ['82.push2.eastmoney.com', 'push2.eastmoney.com'];

  for (const host of quoteHosts) {
    try {
      const response = await fetchImpl(
        `https://${host}/api/qt/stock/get?secid=${market}.${stockCode}&fields=f116`,
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://quote.eastmoney.com',
            Referer: 'https://quote.eastmoney.com/',
          },
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok) continue;
      const data = await response.json();
      const marketCap = marketCapYuanToYi(data?.data?.f116);
      if (marketCap) return marketCap;
    } catch {
      continue;
    }
  }

  return undefined;
};

export const fetchMarketCapsYi = async (
  stockCodes: string[],
  fetchImpl: FetchLike = fetch,
  timeoutMs = 8000,
) => {
  const marketCaps = new Map<string, number>();
  const uniqueCodes = [...new Set(stockCodes.filter(code => /^\d{6}$/.test(code)))];
  const quoteHosts = ['82.push2.eastmoney.com', 'push2.eastmoney.com'];
  const chunkSize = 50;

  for (let index = 0; index < uniqueCodes.length; index += chunkSize) {
    let pendingCodes = uniqueCodes.slice(index, index + chunkSize);

    for (const host of quoteHosts) {
      if (pendingCodes.length === 0) break;

      const secids = pendingCodes
        .map(code => `${code.startsWith('6') ? '1' : '0'}.${code}`)
        .join(',');

      try {
        const response = await fetchImpl(
          `https://${host}/api/qt/ulist.np/get?secids=${encodeURIComponent(secids)}&fields=f12,f20`,
          {
            headers: {
              Accept: 'application/json, text/plain, */*',
              Origin: 'https://quote.eastmoney.com',
              Referer: 'https://quote.eastmoney.com/',
            },
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        if (!response.ok) continue;

        const data = await response.json();
        const rows = Array.isArray(data?.data?.diff) ? data.data.diff : [];
        for (const row of rows) {
          const code = String(row?.f12 ?? '');
          const marketCap = marketCapYuanToYi(row?.f20);
          if (code && marketCap) marketCaps.set(code, marketCap);
        }
        pendingCodes = pendingCodes.filter(code => !marketCaps.has(code));
      } catch {
        continue;
      }
    }
  }

  return marketCaps;
};
