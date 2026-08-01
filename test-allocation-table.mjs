import assert from 'node:assert/strict';
import {
  buildAllocationRows,
  getDefaultHoldingShares,
  isSubscriptionOpen,
} from './src/utils/calculator.ts';

const baseBond = {
  id: 'mock',
  bondCode: '113000',
  bondName: '测试转债',
  stockCode: '600000',
  stockName: '测试股份',
  stockPrice: 9.75,
  conversionPrice: 5.3,
  market: 'SH',
  sharesForOneLot: 985,
  progressName: '待申购',
  issueSize: 3.72,
};

const rows = buildAllocationRows(baseBond, 20, 0, 30);
assert.equal(rows.length, 30);
assert.equal(rows[0].stockQuantity, 100);
assert.equal(rows[29].stockQuantity, 3000);
assert.equal(rows[0].buyCapital, 975);
assert.equal(rows[0].paymentAmount, rows[0].acquiredBonds * 100);
assert.equal(rows[0].issueSize, 3.72);
assert.equal(rows[0].circulatingSize, 3.72);

const starRows = buildAllocationRows({ ...baseBond, stockCode: '688092' }, 20, 10, 30);
assert.equal(starRows[0].stockQuantity, 200);
assert.equal(starRows[1].stockQuantity, 300);
assert.equal(starRows[29].stockQuantity, 3100);
assert.ok(Math.abs(starRows[0].circulatingSize - 3.348) < 0.000001);

assert.equal(getDefaultHoldingShares('688092', 300, 50000), 0);
assert.equal(getDefaultHoldingShares('688092', 200, 50000), 200);
assert.equal(getDefaultHoldingShares('600000', 9.75, 50000), 5100);

const now = new Date('2026-08-01T12:00:00+08:00');
assert.equal(isSubscriptionOpen('2026-07-31', now), false);
assert.equal(isSubscriptionOpen('2026-08-01', now), true);
assert.equal(isSubscriptionOpen('2026-08-02', now), true);
assert.equal(isSubscriptionOpen(undefined, now), true);
