import { marketCapYuanToYi } from './bondFilters';

type FetchLike = (url: string, options: RequestInit) => Promise<{
  ok: boolean;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
}>;

const MARKET_CAP_CACHE_MS = 24 * 60 * 60 * 1000;
const MARKET_CAP_FAILURE_CACHE_MS = 5 * 60 * 1000;
const EASTMONEY_QUOTE_HOSTS = ['82.push2.eastmoney.com', 'push2.eastmoney.com'];

const getTencentSymbol = (stockCode: string) => {
  if (stockCode.startsWith('6')) return `sh${stockCode}`;
  if (stockCode.startsWith('8') || stockCode.startsWith('4')) return `bj${stockCode}`;
  return `sz${stockCode}`;
};

const fetchTencentMarketCapsYi = async (
  stockCodes: string[],
  fetchImpl: FetchLike,
  timeoutMs: number,
) => {
  const marketCaps = new Map<string, number>();
  if (stockCodes.length === 0) return marketCaps;

  try {
    const symbols = stockCodes.map(getTencentSymbol).join(',');
    const response = await fetchImpl(`https://qt.gtimg.cn/q=${symbols}`, {
      headers: {
        Accept: 'text/plain, */*',
        Referer: 'https://gu.qq.com/',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !response.text) return marketCaps;

    const body = await response.text();
    for (const match of body.matchAll(/v_(?:sz|sh|bj)(\d{6})="([^"]*)"/g)) {
      const fields = match[2].split('~');
      const marketCap = Number(fields[45]);
      if (Number.isFinite(marketCap) && marketCap > 0) {
        marketCaps.set(match[1], marketCap);
      }
    }
  } catch {
    return marketCaps;
  }

  return marketCaps;
};

export const getMarketCapCacheTtl = (marketCap?: number) => (
  typeof marketCap === 'number' ? MARKET_CAP_CACHE_MS : MARKET_CAP_FAILURE_CACHE_MS
);

export const fetchMarketCapYi = async (
  stockCode: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 4000,
) => {
  const market = stockCode.startsWith('6') ? '1' : '0';

  for (const host of EASTMONEY_QUOTE_HOSTS) {
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
      if (!response.ok || !response.json) continue;
      const data = await response.json();
      const marketCap = marketCapYuanToYi(data?.data?.f116);
      if (marketCap) return marketCap;
    } catch {
      continue;
    }
  }

  const fallbackMarketCaps = await fetchTencentMarketCapsYi([stockCode], fetchImpl, timeoutMs);
  return fallbackMarketCaps.get(stockCode);
};

export const fetchMarketCapsYi = async (
  stockCodes: string[],
  fetchImpl: FetchLike = fetch,
  timeoutMs = 8000,
) => {
  const marketCaps = new Map<string, number>();
  const uniqueCodes = [...new Set(stockCodes.filter(code => /^\d{6}$/.test(code)))];
  const chunkSize = 50;

  for (let index = 0; index < uniqueCodes.length; index += chunkSize) {
    let pendingCodes = uniqueCodes.slice(index, index + chunkSize);

    for (const host of EASTMONEY_QUOTE_HOSTS) {
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
        if (!response.ok || !response.json) continue;

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

    const fallbackMarketCaps = await fetchTencentMarketCapsYi(pendingCodes, fetchImpl, timeoutMs);
    for (const [code, marketCap] of fallbackMarketCaps) {
      marketCaps.set(code, marketCap);
    }
  }

  return marketCaps;
};
