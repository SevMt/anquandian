import assert from 'node:assert/strict';
import {
  buildAllocationRows,
  calculateBond,
  getDefaultHoldingShares,
  isSubscriptionOpen,
} from './src/utils/calculator.ts';

const baseBond = {
  id: 'mock',
  bondCode: '123280',
  bondName: '三鑫转债',
  stockCode: '300453',
  stockName: '测试股份',
  stockPrice: 9.75,
  conversionPrice: 5.3,
  market: 'SZ',
  sharesForOneLot: 985,
  progressName: '待申购',
  issueSize: 3.72,
};

const rows = buildAllocationRows(baseBond, 20, 0, 30);
assert.equal(rows.length, 30);
assert.equal(rows[0].stockQuantity, 100);
assert.equal(rows[29].stockQuantity, 3000);
assert.equal(rows[0].buyCapital, 975);
assert.equal(rows[0].acquiredQuantity, 1);
assert.equal(rows[0].acquiredUnit, '张');
assert.equal(rows[0].paymentAmount, rows[0].acquiredBonds * 100);
assert.equal(rows[0].estimatedProfit, Number(rows[0].estimatedProfit.toFixed(2)));
assert.equal(rows[0].issueSize, 3.72);
assert.equal(rows[0].circulatingSize, 3.72);

const shRows = buildAllocationRows({ ...baseBond, stockCode: '600000', market: 'SH' }, 20, 0, 30);
assert.equal(shRows[5].stockQuantity, 600);
assert.equal(shRows[5].acquiredQuantity, 0);
assert.equal(shRows[5].acquiredUnit, '手');
assert.equal(shRows[5].paymentAmount, 0);
assert.equal(shRows[6].stockQuantity, 700);
assert.equal(shRows[6].acquiredQuantity, 1);
assert.equal(shRows[6].acquiredUnit, '手');
assert.equal(shRows[6].paymentAmount, 1000);

const shBoundaryBond = { ...baseBond, stockCode: '600000', market: 'SH', sharesForOneLot: 1000 };
assert.equal(calculateBond(shBoundaryBond, { premiumRate: 20, holdingShares: 1685 }).allocatedLots, 1);
assert.equal(calculateBond(shBoundaryBond, { premiumRate: 20, holdingShares: 1686 }).allocatedLots, 2);

const szBoundaryBond = { ...baseBond, stockCode: '300453', market: 'SZ', sharesForOneLot: 1000 };
assert.equal(calculateBond(szBoundaryBond, { premiumRate: 20, holdingShares: 168.5 }).allocatedBonds, 1);
assert.equal(calculateBond(szBoundaryBond, { premiumRate: 20, holdingShares: 168.6 }).allocatedBonds, 2);

const starRows = buildAllocationRows({ ...baseBond, stockCode: '688092', market: 'SH' }, 20, 10, 30);
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
