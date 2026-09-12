import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchMarketCapsYi, fetchMarketCapYi, getMarketCapCacheTtl } from './src/utils/marketCap.ts';

test('market cap request uses the stock market prefix and converts yuan to yi', async () => {
  let requestedUrl = '';
  const fakeFetch = async (url, options) => {
    requestedUrl = url;
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ data: { f116: 12_500_000_000 } }) };
  };

  assert.equal(await fetchMarketCapYi('600519', fakeFetch), 125);
  assert.match(requestedUrl, /secid=1\.600519/);
});

test('market cap request degrades to undefined when the provider fails', async () => {
  const failingFetch = async () => { throw new Error('provider unavailable'); };
  assert.equal(await fetchMarketCapYi('000001', failingFetch), undefined);
});

test('market cap request falls back to the secondary quote host', async () => {
  const requestedUrls = [];
  const fallbackFetch = async (url) => {
    requestedUrls.push(url);
    if (requestedUrls.length === 1) {
      return { ok: false, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({ data: { f116: 12_500_000_000 } }) };
  };

  assert.equal(await fetchMarketCapYi('300727', fallbackFetch), 125);
  assert.deepEqual(requestedUrls.map(url => new URL(url).hostname), [
    '82.push2.eastmoney.com',
    'push2.eastmoney.com',
  ]);
});

test('batch market cap request maps every returned stock code', async () => {
  const requestedUrls = [];
  const fakeFetch = async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      json: async () => ({
        data: {
          diff: [
            { f12: '300727', f20: 5_425_706_922 },
            { f12: '688150', f20: 15_642_748_929 },
          ],
        },
      }),
    };
  };

  const marketCaps = await fetchMarketCapsYi(['300727', '688150'], fakeFetch);

  assert.equal(marketCaps.get('300727'), 54.25706922);
  assert.equal(marketCaps.get('688150'), 156.42748929);
  assert.match(requestedUrls[0], /ulist\.np\/get/);
  assert.match(requestedUrls[0], /secids=0\.300727%2C1\.688150/);
});

test('missing market cap gets a short negative-cache ttl', () => {
  assert.equal(getMarketCapCacheTtl(125), 24 * 60 * 60 * 1000);
  assert.equal(getMarketCapCacheTtl(undefined), 5 * 60 * 1000);
});
