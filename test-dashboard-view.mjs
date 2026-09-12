import assert from 'node:assert/strict';
import test from 'node:test';

import { getDashboardView } from './src/utils/dashboardView.ts';

test('detail mode keeps the full table and offers compact mode', () => {
  assert.deepEqual(getDashboardView(false), {
    toggleLabel: '精简模式',
    visibleColumnCount: 12,
    showMarketCap: true,
    showStockPrice: true,
    showConcepts: true,
    showExpandedDetails: true,
  });
});

test('compact mode hides detail-heavy content and offers detail mode', () => {
  assert.deepEqual(getDashboardView(true), {
    toggleLabel: '详情模式',
    visibleColumnCount: 10,
    showMarketCap: false,
    showStockPrice: false,
    showConcepts: false,
    showExpandedDetails: false,
  });
});
