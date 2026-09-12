import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCirculatingSize,
  getIssueToMarketCapRatio,
  getRestrictedRatioFromHolders,
  matchesBondScaleRanges,
  matchesNumericRange,
  marketCapYuanToYi,
} from './src/utils/bondFilters.ts';
import * as bondFilters from './src/utils/bondFilters.ts';

test('numeric range includes both boundaries and supports an open end', () => {
  assert.equal(matchesNumericRange(90, '90', '110'), true);
  assert.equal(matchesNumericRange(110, '90', '110'), true);
  assert.equal(matchesNumericRange(89.99, '90', '110'), false);
  assert.equal(matchesNumericRange(120, '100', ''), true);
  assert.equal(matchesNumericRange(80, '', '90'), true);
});

test('an active numeric range excludes missing values', () => {
  assert.equal(matchesNumericRange(undefined, '', ''), true);
  assert.equal(matchesNumericRange(undefined, '90', ''), false);
  assert.equal(matchesNumericRange(Number.NaN, '', '110'), false);
});

test('issue and circulating scale ranges can filter independently or together', () => {
  assert.equal(getCirculatingSize(5, 40), 3);
  assert.equal(matchesBondScaleRanges(5, 40, { min: '4', max: '6' }, { min: '', max: '' }), true);
  assert.equal(matchesBondScaleRanges(5, 40, { min: '', max: '' }, { min: '2.5', max: '3.5' }), true);
  assert.equal(matchesBondScaleRanges(5, 40, { min: '4', max: '6' }, { min: '3.1', max: '4' }), false);
});

test('an active circulating range excludes rows without a restricted ratio', () => {
  assert.equal(matchesBondScaleRanges(5, undefined, { min: '4', max: '6' }, { min: '', max: '' }), true);
  assert.equal(matchesBondScaleRanges(5, undefined, { min: '', max: '' }, { min: '2', max: '4' }), false);
});

test('market cap is converted from yuan to yi and used for issue ratio', () => {
  assert.equal(marketCapYuanToYi(12_500_000_000), 125);
  assert.equal(marketCapYuanToYi(null), undefined);
  assert.equal(getIssueToMarketCapRatio(5, 125), 4);
  assert.equal(getIssueToMarketCapRatio(5, 0), undefined);
});

test('company market cap and convertible bond ratio ranges work independently and together', () => {
  assert.equal(typeof bondFilters.matchesMarketCapRanges, 'function');

  assert.equal(
    bondFilters.matchesMarketCapRanges(
      125,
      5,
      { min: '100', max: '150' },
      { min: '', max: '' },
    ),
    true,
  );
  assert.equal(
    bondFilters.matchesMarketCapRanges(
      125,
      5,
      { min: '', max: '' },
      { min: '3', max: '5' },
    ),
    true,
  );
  assert.equal(
    bondFilters.matchesMarketCapRanges(
      125,
      5,
      { min: '100', max: '150' },
      { min: '5', max: '6' },
    ),
    false,
  );
  assert.equal(
    bondFilters.matchesMarketCapRanges(
      undefined,
      5,
      { min: '100', max: '' },
      { min: '', max: '' },
    ),
    false,
  );
});

test('restricted ratio stays unknown when holder data is unavailable', () => {
  assert.equal(getRestrictedRatioFromHolders([]), undefined);
  assert.equal(getRestrictedRatioFromHolders(undefined), undefined);
});

test('restricted ratio uses the latest complete holder report', () => {
  const olderCompleteReport = Array.from({ length: 8 }, (_, index) => ({
    END_DATE: '2025-12-31',
    HOLDER_RANK: index + 1,
    HOLD_NUM_RATIO: index === 0 ? 18 : 2,
  }));
  const latestIncompleteReport = [{ END_DATE: '2026-03-31', HOLDER_RANK: 1, HOLD_NUM_RATIO: 30 }];

  assert.equal(getRestrictedRatioFromHolders([...latestIncompleteReport, ...olderCompleteReport]), 18);
});
