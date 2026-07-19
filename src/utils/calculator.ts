import { BondData, CalculationInputs, CalculationResult } from '../types';

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
