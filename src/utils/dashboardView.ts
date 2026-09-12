export interface DashboardView {
  toggleLabel: '精简模式' | '详情模式';
  visibleColumnCount: number;
  showMarketCap: boolean;
  showStockPrice: boolean;
  showConcepts: boolean;
  showExpandedDetails: boolean;
}

export const getDashboardView = (isCompact: boolean): DashboardView => ({
  toggleLabel: isCompact ? '详情模式' : '精简模式',
  visibleColumnCount: isCompact ? 10 : 12,
  showMarketCap: !isCompact,
  showStockPrice: !isCompact,
  showConcepts: !isCompact,
  showExpandedDetails: !isCompact,
});
