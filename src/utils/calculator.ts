import { AllocationTableRow, BondData, CalculationInputs, CalculationResult } from '../types';

const SUBSCRIPTION_DATE_KEYS = [
  'apply_date',
  'apply_dt',
  'applyDate',
  'apply_time',
  'subscription_date',
  'subscriptionDate',
  'sub_date',
  'online_date',
  'online_apply_date',
  'purchase_date',
  'sg_date',
];

export function normalizeDateString(value: unknown): string | undefined {
  if (value === null || typeof value === 'undefined') return undefined;

  const raw = String(value).replace(/<[^>]*>/g, ' ').trim();
  if (!raw || raw === '-' || raw.toLowerCase() === 'null') return undefined;

  const match = raw.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!match) return undefined;

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function pickSubscriptionDate(source: Record<string, unknown>): string | undefined {
  for (const key of SUBSCRIPTION_DATE_KEYS) {
    const normalized = normalizeDateString(source[key]);
    if (normalized) return normalized;
  }
  return undefined;
}

const dateToDayKey = (date: Date) => {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
};

const dateStringToDayKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year * 10000 + month * 100 + day;
};

export function isSubscriptionOpen(subscriptionDate?: string, now = new Date()): boolean {
  const normalized = normalizeDateString(subscriptionDate);
  if (!normalized) return true;
  return dateStringToDayKey(normalized) >= dateToDayKey(now);
}

export function getAllocationStartShares(stockCode: string): number {
  return stockCode.startsWith('688') ? 200 : 100;
}

export function getDefaultHoldingShares(stockCode: string, stockPrice: number, capital: number): number {
  if (stockPrice <= 0 || capital <= 0) return 0;

  const roundedShares = Math.floor(capital / stockPrice / 100) * 100;
  if (stockCode.startsWith('688') && roundedShares < 200) return 0;
  return roundedShares;
}

export function calculateBond(bond: BondData, inputs: CalculationInputs): CalculationResult {
  const { stockPrice, conversionPrice, market, sharesForOneLot } = bond;
  const { premiumRate, holdingShares } = inputs;

  // 1. 转股价值 = 100 / 转股价 * 正股当前价格
  const conversionValue = (100 / conversionPrice) * stockPrice;

  // 2. 预估上市价格 = 转股价值 * (1 + 溢价率)
  const premiumDecimal = premiumRate / 100;
  const estimatedListingPrice = conversionValue * (1 + premiumDecimal);

  // 每张收益 & 每手收益
  const profitPerBond = estimatedListingPrice - 100;
  const profitPerLot = profitPerBond * 10;

  // --- 1手党 (Optimal Safety Cushion) ---
  // If minOneLotShares is defined (SH market), use it for real minimal cost.
  // Otherwise, fallback to conservative full sharesForOneLot * stockPrice.
  const actualOptimalShares = bond.minOneLotShares && bond.minOneLotShares > 0 ? bond.minOneLotShares : sharesForOneLot;
  const minCapitalForOneLot = actualOptimalShares * stockPrice;
  // 最优收益安全垫 = 预计收益(一手) / 最小配售资金 * 100%
  const optimalSafetyCushion = minCapitalForOneLot > 0 ? (profitPerLot / minCapitalForOneLot) * 100 : 0;

  // --- 大众版 (General Allocation) ---
  let allocatedLots = 0;
  let allocatedBonds = 0;
  let totalEstimatedProfit = 0;

  if (market === 'SH') {
    // 沪市计算：预计总收益 = 持有股票数量 / “配售1000元的股数” * 每手可转债的收益
    // 规则: 小数小于0.6的都可以忽略，大于0.6可进位为1手
    const rawLots = holdingShares / sharesForOneLot;
    const integer = Math.floor(rawLots);
    const decimal = rawLots - integer;
    allocatedLots = decimal >= 0.6 ? integer + 1 : integer;
    allocatedBonds = allocatedLots * 10;
    totalEstimatedProfit = allocatedLots * profitPerLot;
  } else {
    // 深市计算：预计总收益 = 持有股票数量 / “配售1000元的股数” * 10 * 每张可转债的收益
    // 规则: 乘以10后，小数小于0.6的都可以忽略，大于0.6可进位为1张
    const rawBonds = (holdingShares / sharesForOneLot) * 10;
    const integer = Math.floor(rawBonds);
    const decimal = rawBonds - integer;
    allocatedBonds = decimal >= 0.6 ? integer + 1 : integer;
    allocatedLots = allocatedBonds / 10;
    totalEstimatedProfit = allocatedBonds * profitPerBond;
  }

  const totalCapital = holdingShares * stockPrice;
  // 收益安全垫 = 预计总收益 / 购入总资金 * 100%
  const generalSafetyCushion = totalCapital > 0 ? (totalEstimatedProfit / totalCapital) * 100 : 0;

  return {
    conversionValue,
    estimatedListingPrice,
    profitPerBond,
    profitPerLot,
    minCapitalForOneLot,
    optimalSafetyCushion,
    allocatedLots,
    allocatedBonds,
    totalCapital,
    totalEstimatedProfit,
    generalSafetyCushion,
  };
}

export function buildAllocationRows(
  bond: BondData,
  premiumRate: number,
  restrictedRatio = 0,
  rowCount = 30,
): AllocationTableRow[] {
  const startShares = getAllocationStartShares(bond.stockCode);
  const issueSize = Number(bond.issueSize ?? bond.amount ?? 0) || 0;
  const circulatingSize = issueSize * (1 - (Number(restrictedRatio) || 0) / 100);

  return Array.from({ length: rowCount }, (_, index) => {
    const stockQuantity = startShares + index * 100;
    const buyCapital = stockQuantity * bond.stockPrice;
    const canCalculate = bond.conversionPrice > 0 && bond.sharesForOneLot > 0 && stockQuantity > 0;
    const result = canCalculate ? calculateBond(bond, { premiumRate, holdingShares: stockQuantity }) : undefined;
    const acquiredBonds = result?.allocatedBonds || 0;

    return {
      index,
      sharesForOneLot: bond.sharesForOneLot,
      issueSize,
      circulatingSize,
      stockQuantity,
      buyCapital,
      acquiredBonds,
      paymentAmount: acquiredBonds * 100,
      estimatedProfit: result?.totalEstimatedProfit || 0,
      safetyCushion: result?.generalSafetyCushion || 0,
    };
  });
}
