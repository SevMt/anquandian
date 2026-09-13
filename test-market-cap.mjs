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

test('batch market cap request falls back to Tencent when Eastmoney is unavailable', async () => {
  const requestedUrls = [];
  const fallbackFetch = async (url) => {
    requestedUrls.push(url);
    if (url.includes('push2.eastmoney.com')) {
      return { ok: false, json: async () => ({}) };
    }

    return {
      ok: true,
      text: async () => [
        'v_sz300727="51~润禾材料~300727~29.68~30.19~30.10~48658~24879~23779~29.67~24~29.66~22~29.65~54~29.62~1~29.60~21~29.68~29~29.69~125~29.70~2~29.71~16~29.72~49~~20260911161418~-0.51~-1.69~30.38~28.49~29.68/48658/142732623~48658~14273~3.00~52.11~~30.38~28.49~6.26~48.12~53.46~3.95";',
        'v_sh688150="1~莱特光电~688150~38.51~38.74~38.58~6981037~3435911~3545126~38.51~95~38.50~159~38.49~36~38.48~5~38.47~12~38.52~33~38.53~26~38.55~6~38.56~24~38.57~10~~20260911161500~-0.23~-0.59~39.00~36.71~38.51/6981037/265060734~6981037~26506~1.73~76.45~~39.00~36.71~5.91~154.98~154.98~7.16";',
      ].join('\n'),
    };
  };

  const marketCaps = await fetchMarketCapsYi(['300727', '688150'], fallbackFetch);

  assert.equal(marketCaps.get('300727'), 53.46);
  assert.equal(marketCaps.get('688150'), 154.98);
  assert.equal(new URL(requestedUrls.at(-1)).hostname, 'qt.gtimg.cn');
});

test('missing market cap gets a short negative-cache ttl', () => {
  assert.equal(getMarketCapCacheTtl(125), 24 * 60 * 60 * 1000);
  assert.equal(getMarketCapCacheTtl(undefined), 5 * 60 * 1000);
});
