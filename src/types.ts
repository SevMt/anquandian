export interface BondData {
  id: string;
  bondCode: string;
  bondName: string;
  stockCode: string;
  stockName: string;
  stockPrice: number;
  conversionPrice: number;
  // Allocation rules
  market: 'SH' | 'SZ';
  sharesForOneLot: number; // 配售10张所需股数
  minOneLotShares?: number; // 一手党最小配售股数 (仅沪市)
  progressName: string; // e.g. 董事会预案
  ratingCode?: string; // 信用评级
  pb?: number; // 市净率
  issueSize?: number; // 发行规模(亿元)
  marketCap?: number; // 公司总市值(亿元)
  amount?: number;
  pma_rt?: number;
  ration?: number;
  price?: number;
  ma20_price?: number;
  subscriptionDate?: string; // 申购日期，过期后不再展示
}

export interface CalculationInputs {
  premiumRate: number; // in percentage, e.g., 20 for 20%
  holdingShares: number; // e.g., 1000
}

export interface CalculationResult {
  // Base
  conversionValue: number; // 转股价值
  estimatedListingPrice: number; // 预估上市价格
  profitPerBond: number; // 每张收益
  profitPerLot: number; // 每手收益 (10张)

  // 1手党 (Optimal Safety Cushion)
  minCapitalForOneLot: number; // 最小配售一手所需资金
  optimalSafetyCushion: number; // 最优收益安全垫 %

  // 大众版 (General Allocation)
  allocatedLots: number; // 计算配售出的手数
  allocatedBonds: number; // 配出的张数 (仅深市详细列出或沪市转换)
  totalCapital: number; // 投入总资金
  totalEstimatedProfit: number; // 预计总收益
  generalSafetyCushion: number; // 收益安全垫 %
}

export interface AllocationTableRow {
  index: number;
  sharesForOneLot: number;
  issueSize: number;
  circulatingSize: number;
  stockQuantity: number;
  buyCapital: number;
  acquiredBonds: number;
  acquiredQuantity: number;
  acquiredUnit: '张' | '手';
  paymentAmount: number;
  estimatedProfit: number;
  safetyCushion: number;
}

export interface ComparableBond {
  bondName: string;
  stockName: string;
  premiumRate: number;
}

export interface TableRowData {
  bond: BondData;
  premiumRate: number;
  industry?: string;
  rationale?: string;
  isEstimating?: boolean;
  holdingShares: number;
  result?: CalculationResult;
  comparableBonds?: ComparableBond[];
  businessComparison?: string;
  valuationLogic?: string;
  technicalAnalysis?: string;
  calculatedAverage?: number;
  calculatedMedian?: number;
  peerCount?: number;
  notes?: string;
  restrictedRatio?: number; // 限售股东份额总占比(%)
  recentMaxGain?: string;
  drawdownFromHigh?: string;
  isThreeDaysUp?: boolean;
  isVolumeAmplified?: boolean;
  stockSafetyScore?: number;
}
