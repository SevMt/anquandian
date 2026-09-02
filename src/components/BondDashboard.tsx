import React, { useState, useEffect, useMemo } from 'react';
import { BondData, CalculationInputs, CalculationResult, TableRowData } from '../types';
import {
  buildAllocationRows,
  calculateBond,
  getDefaultHoldingShares,
  isSubscriptionOpen,
  pickSubscriptionDate,
} from '../utils/calculator';
import { Calculator, RefreshCw, AlertCircle, Info, ShieldCheck, Banknote, Search, Table as TableIcon, Sparkles, Loader2, ChevronDown, ChevronUp, Landmark, FileText, TrendingUp, HelpCircle, Activity, X } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from 'recharts';

const getScaleScore = (amount: number | string, restrictedRatio: number | string) => {
    const x = Number(amount) || 0; 
    const rr = Number(restrictedRatio) || 0;
    const y = x * (1 - rr / 100); 
    
    let mark = 8;
    if (x > 50) mark = 1;
    else if (x > 30) mark = 1.5;
    else if (x > 20) mark = 2;
    else if (x > 10) mark = 2.5;
    else if (x > 7) mark = 3;
    else if (x > 5) mark = 4;
    else if (x > 3.5) mark = 6;
    else if (x > 2) mark = 7;
    else mark = 8;
    
    if (y < 1) mark += 2.5;
    else if (y < 1.2) mark += 2;
    else if (y < 1.5) mark += 1.5;
    else if (y < 1.8) mark += 1;
    
    if (y < 7 && mark <= 3) mark += 2;
    
    return mark;
};

const getCbValueScore = (pma_rt: number | string) => {
    let mark = 3;
    let x = Number(pma_rt) || 0; 
    if (x > 120) mark = 3;
    else if (x > 112) mark = 5;
    else if (x > 102.5) mark = 7;
    else if (x > 92) mark = 9;
    else if (x > 87) mark = 7;
    else if (x > 80) mark = 5;
    else mark = 3;
    return mark;
};

const getSafetyCushionScore = (row: TableRowData) => {
    let y = 0;
    
    if (row.result) {
        // Use the maximum of optimal (1手党) or general safety cushion, which perfectly mirrors what the user perceives on the UI.
        y = Math.max(row.result.generalSafetyCushion || 0, row.result.optimalSafetyCushion || 0);
    } else {
        const premium = row.premiumRate;
        const pma = typeof row.bond.pma_rt !== 'undefined' ? Number(row.bond.pma_rt) : 100;
        const estPrice = typeof premium !== 'undefined' ? pma * (1 + premium/100) : 130;  
        // Fallback calculation taking cb_amount if ration is missing
        const price = Number(row.bond.price) || 1;
        const ration = Number(row.bond.ration) || 0; 
        y = (ration * Math.max(0, estPrice - 100) / price); 
    }
    
    if (y < 0) y = 0;
    
    let mark = 1;
    if (y > 10) mark = 9.3;
    else if (y > 8.5) mark = 8.5;
    else if (y > 7) mark = 7.5;
    else if (y > 5.5) mark = 6.5;
    else if (y > 4) mark = 5;
    else if (y > 2.5) mark = 4;
    else if (y > 1) mark = 2;
    else mark = 1;
    
    return mark;
};

const getIndustryScore = (industry: string) => {
    industry = industry || '';
    const isHot = /机器人|飞行|低空|AI|算力|数据|芯片|半导体|CPO|出海|电池|电子|元件|集成电路/.test(industry);
    let mark = 5;
    
    const hasDianzi = /电子|芯片|半导体|集成电路/.test(industry);
    const hasQiche = /汽车/.test(industry);
    const hasYiyao = /医药|医疗/.test(industry);
    const hasJixie = /机械|装备|自动化/.test(industry);
    const isShiyou = /石油|天然气/.test(industry);
    const hasJisuanji = /计算机/.test(industry);
    const hasShipin = /食品|饮料/.test(industry);
    const hasTongxin = /通信|互联网/.test(industry);
    const hasHuagong = /化工/.test(industry);
    const hasNengyuan = /能源|电力/.test(industry);
    const hasJianzhu = /建筑/.test(industry);
    const hasYouse = /有色|金属/.test(industry);

    if (hasQiche) mark = 4.5; // Automotive is in a down-cycle, score below 6
    else if (isHot && (hasDianzi || hasYiyao)) mark = 10;
    else if (hasDianzi) mark = 9;
    else if (hasYiyao) mark = 8;
    else if (hasJixie && !isShiyou) mark = 7;
    else if (hasJisuanji) mark = 7;
    else if (isHot || hasShipin || hasTongxin) mark = 6;
    else if (hasHuagong || hasNengyuan) mark = 5.5;
    else if (hasJianzhu) mark = 4.5;
    else if (hasYouse) mark = 3;
    else mark = 5;
    
    return mark;
};

const getDemonScore = (scaleScore: number, indScore: number, liquidity: number) => {
    let mark = 5;
    let flag = false;
    if (indScore >= 7) { mark = 7; flag = true; }
    if (scaleScore >= 8.5) { mark = 9; flag = true; }
    if (scaleScore >= 7 && scaleScore < 8 && indScore >= 8 && indScore < 9) { mark = 8; flag = true; }
    if (scaleScore >= 6 && scaleScore < 7 && indScore >= 7 && indScore < 8) { mark = 6.5; flag = true; }
    if (scaleScore >= 5 && scaleScore < 6 && indScore >= 5.5 && indScore < 7) { mark = 6; flag = true; }
    if (scaleScore >= 4 && scaleScore < 5 && indScore < 5) { mark = 5; flag = true; }
    if (scaleScore < 4 && indScore < 5) { mark = 3; flag = true; }
    if (scaleScore <= 3 && indScore < 4) { mark = 2; flag = true; }
    if (!flag) mark = 5;
    
    if (indScore < 6 && mark >= 3) mark -= 1;
    if (liquidity < 1.8 && mark <= 7) mark += 2;
    if (liquidity < 1.5 && mark <= 7.5) mark += 1;
    if (liquidity > 2.5) mark -= 1;
    if (liquidity > 6 && mark >= 5) mark -= 1;
    
    return mark;
};

const formatNumber = (value: number, digits: number) => {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatInteger = (value: number) => {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
};



export default function BondDashboard() {
  const [rows, setRows] = useState<TableRowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global Inputs
  const [globalCapital, setGlobalCapital] = useState<number>(50000); // 50,000 元
  const [searchQuery, setSearchQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState('ALL');
  const [scaleFilter, setScaleFilter] = useState('ALL');
  const [trendFilter, setTrendFilter] = useState('ALL');
  const [cushionFilter, setCushionFilter] = useState('ALL');
  const [expandedStockCode, setExpandedStockCode] = useState<string | null>(null);
  const [radarExpandedStockCode, setRadarExpandedStockCode] = useState<string | null>(null);
  const [allocationModalRow, setAllocationModalRow] = useState<TableRowData | null>(null);

  // Initial Fetch
  useEffect(() => {
    handleFetchJisilu();
  }, []);

  const handleFetchJisilu = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bonds/pre');
      const data = await res.json();
      
      let parsedRows: TableRowData[] = [];
      if (data && data.rows && data.rows.length > 0) {
        parsedRows = buildInitialRows(data.rows.map((r: any) => r.cell || r));
      } else if (data && data.data && data.data.length > 0) {
        parsedRows = buildInitialRows(data.data);
      } else {
        throw new Error('未能解析集思录数据或当前无待发转债。');
      }

      const activeRows = parsedRows.filter(r => isSubscriptionOpen(r.bond.subscriptionDate));
      setRows(recalculateRows(activeRows, globalCapital));
      
      // Auto-trigger AI estimation for all available bonds
      const bondsForAI = activeRows.map(r => ({
        stockCode: r.bond.stockCode,
        stockName: r.bond.stockName,
        bondName: r.bond.bondName,
        issueSize: r.bond.issueSize,
        restrictedRatio: r.restrictedRatio,
        pma_rt: typeof r.bond.pma_rt === 'number' ? r.bond.pma_rt : Number(r.bond.pma_rt) || 100,
        pb: typeof r.bond.pb === 'number' ? r.bond.pb : parseFloat(String(r.bond.pb)) || 0
      }));
      triggerAIEstimation(bondsForAI, activeRows);

    } catch (err: any) {
      setError(err.message || '网络请求失败或代理被拦截。');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAIEstimation = async (bondsToEstimate: any[], currentRows: TableRowData[]) => {
    // Mark as estimating
    setRows(prev => prev.map(r => ({ ...r, isEstimating: true })));

    try {
      const res = await fetch('/api/bonds/estimate-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonds: bondsToEstimate })
      });
      const estimates = await res.json();

      if (Array.isArray(estimates)) {
        setRows(prev => {
          const next = [...prev];
          estimates.forEach(est => {
            const idx = next.findIndex(r => r.bond.stockCode === est.stockCode);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                isEstimating: false,
                premiumRate: est.estimatedPremiumRate || 0,
                industry: est.industry,
                rationale: est.rationale,
                comparableBonds: est.comparableBonds,
                businessComparison: est.businessComparison,
                valuationLogic: est.valuationLogic,
                technicalAnalysis: est.technicalAnalysis,
                calculatedAverage: est.calculatedAverage,
                calculatedMedian: est.calculatedMedian,
                peerCount: est.peerCount,
                notes: est.notes,
              };
              // Recalculate
              const rb = next[idx].bond;
              if (rb.conversionPrice > 0 && rb.sharesForOneLot > 0) {
                next[idx].result = calculateBond(rb, {
                  premiumRate: next[idx].premiumRate,
                  holdingShares: next[idx].holdingShares,
                });
              }
            }
          });
          return next.map(r => ({ ...r, isEstimating: false }));
        });
      } else {
        // Backend returned an error object
        const errorDetails = estimates.details ? ` (${estimates.details})` : '';
        throw new Error((estimates.error || 'AI预估返回错误数据格式') + errorDetails);
      }
    } catch (err: any) {
      console.error('Failed to estimate premiums:', err);
      const msg = err.message || JSON.stringify(err);
      if (msg.includes('GEMINI_API_KEY') || msg.includes('API_KEY')) {
        setError('系统需要 GEMINI_API_KEY 才能智能预估溢价率。请在左下角设置的 Secrets 面板配置您的 API Key。');
      } else {
        setError('AI预估失败: ' + msg);
      }
      setRows(prev => prev.map(r => ({ ...r, isEstimating: false })));
    }
  };

  const buildInitialRows = (list: any[]): TableRowData[] => {
    return list.map((item) => {
      const stockCode = item.stock_id || '';
      const isSH = stockCode.startsWith('6');
      const isStarBoard = stockCode.startsWith('688');
      const stockPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price || '0');
      const defaultHoldingShares = getDefaultHoldingShares(stockCode, stockPrice, globalCapital);
      
      const sharesForOneLot = item.apply10 || 0;
      let minOneLotShares: number | undefined;
      
      if (isSH && sharesForOneLot > 0) {
        const strictMin = sharesForOneLot * 0.58;
        if (isStarBoard) {
          minOneLotShares = Math.max(200, Math.ceil(strictMin));
        } else {
          minOneLotShares = Math.ceil(strictMin / 100) * 100;
        }
      }

      const bond: BondData = {
        id: item.stock_id || Math.random().toString(),
        bondCode: item.bond_id || '-',
        bondName: item.bond_nm || (item.stock_nm ? item.stock_nm + '发债' : '-'),
        stockCode: stockCode,
        stockName: item.stock_nm || '-',
        stockPrice: stockPrice,
        conversionPrice: typeof item.convert_price === 'number' ? item.convert_price : parseFloat(item.convert_price || '0'),
        market: isSH ? 'SH' : 'SZ',
        sharesForOneLot: sharesForOneLot,
        minOneLotShares: minOneLotShares,
        progressName: item.progress_nm || '-',
        ratingCode: item.rating_cd || 'AA',
        pb: typeof item.pb === 'number' ? item.pb : parseFloat(item.pb || '1.5'),
        issueSize: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount || '0'),
        amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount || '0'),
        pma_rt: typeof item.pma_rt === 'number' ? item.pma_rt : parseFloat(item.pma_rt || '100'),
        ration: typeof item.ration === 'number' ? item.ration : parseFloat(item.ration || '0'),
        price: stockPrice,
        ma20_price: typeof item.ma20_price === 'number' ? item.ma20_price : parseFloat(item.ma20_price || '0'),
        subscriptionDate: pickSubscriptionDate(item),
      };

      return {
        bond,
        premiumRate: 0, // Starts at 0 until AI replies
        holdingShares: defaultHoldingShares,
        isEstimating: false,
        restrictedRatio: typeof item.restricted_ratio === 'number' ? item.restricted_ratio : undefined,
        recentMaxGain: item.recentMaxGain,
        drawdownFromHigh: item.drawdownFromHigh,
        isThreeDaysUp: item.isThreeDaysUp,
        isVolumeAmplified: item.isVolumeAmplified,
        stockSafetyScore: item.stockSafetyScore,
      };
    });
  };

  const recalculateRows = (currentRows: TableRowData[], capital: number) => {
    return currentRows.map(row => {
      let hs = row.holdingShares;
      if (row.bond.stockPrice > 0) {
        hs = getDefaultHoldingShares(row.bond.stockCode, row.bond.stockPrice, capital);
      }
      
      let result: CalculationResult | undefined;
      if (row.bond.conversionPrice > 0 && row.bond.sharesForOneLot > 0) {
        result = calculateBond(row.bond, {
          premiumRate: row.premiumRate,
          holdingShares: hs,
        });
      }
      return { ...row, holdingShares: hs, result };
    });
  };

  const applyGlobalCapital = (val: number) => {
    setGlobalCapital(val);
    setRows(prev => recalculateRows(prev, val));
  };

  const updateRow = (index: number, field: 'holdingShares' | 'premiumRate', value: number) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      
      const rb = next[index].bond;
      if (rb.conversionPrice > 0 && rb.sharesForOneLot > 0) {
        next[index].result = calculateBond(rb, {
          premiumRate: next[index].premiumRate,
          holdingShares: next[index].holdingShares,
        });
      }
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    let result = rows.filter(r => isSubscriptionOpen(r.bond.subscriptionDate));
    
    // 1. Search Query
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.bond.bondName.toLowerCase().includes(lowerQ) || 
        r.bond.stockName.toLowerCase().includes(lowerQ) ||
        r.bond.stockCode.includes(lowerQ)
      );
    }
    
    // 2. Trend Filter
    if (trendFilter !== 'ALL') {
      if (trendFilter === 'STRONG') {
        result = result.filter(r => r.isThreeDaysUp || Number(r.recentMaxGain) > 10);
      } else if (trendFilter === 'SAFE_SCORE') {
        result = result.filter(r => (r.stockSafetyScore || 0) >= 4);
      } else if (trendFilter === 'VOLUME') {
        result = result.filter(r => r.isVolumeAmplified);
      }
    }
    
    // 3. Progress / Market Filter
    if (progressFilter !== 'ALL') {
      if (progressFilter === 'SH') {
        result = result.filter(r => r.bond.stockCode.startsWith('6'));
      } else if (progressFilter === 'SZ') {
        result = result.filter(r => !r.bond.stockCode.startsWith('6'));
      } else if (progressFilter === '同意注册') {
        result = result.filter(r => String(r.bond.progressName || '').includes('注册'));
      } else if (progressFilter === '上市委通过') {
        result = result.filter(r => String(r.bond.progressName || '').includes('上会') || String(r.bond.progressName || '').includes('通过'));
      } else if (progressFilter === '受理') {
        result = result.filter(r => String(r.bond.progressName || '').includes('受理'));
      }
    }
    
    // 4. Scale Filter
    if (scaleFilter !== 'ALL') {
      result = result.filter(r => {
        const amount = Number(r.bond.issueSize) || 0;
        const rr = Number(r.restrictedRatio) || 0;
        const circSize = amount * (1 - rr / 100);
        if (scaleFilter === 'SMALL') {
          return circSize < 1.5;
        } else if (scaleFilter === 'MEDIUM') {
          return circSize >= 1.5 && circSize <= 3.0;
        } else if (scaleFilter === 'LARGE') {
          return circSize > 3.0;
        }
        return true;
      });
    }
    
    // 5. Cushion Filter
    if (cushionFilter !== 'ALL') {
      result = result.filter(r => {
        const cushionVal = r.result ? Math.max(r.result.generalSafetyCushion || 0, r.result.optimalSafetyCushion || 0) : 0;
        if (cushionFilter === 'HIGH') {
          return cushionVal >= 5;
        } else if (cushionFilter === 'POSITIVE') {
          return cushionVal > 0;
        }
        return true;
      });
    }

    return result;
  }, [rows, searchQuery, trendFilter, progressFilter, scaleFilter, cushionFilter]);

  const allocationRows = useMemo(() => {
    if (!allocationModalRow) return [];
    return buildAllocationRows(
      allocationModalRow.bond,
      allocationModalRow.premiumRate,
      allocationModalRow.restrictedRatio || 0,
      30,
    );
  }, [allocationModalRow]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-gray-900 flex items-center space-x-3">
            <TableIcon className="w-8 h-8 text-blue-600" />
            <span>择再青松 | 待发可转债辅助工具</span>
          </h1>
          <p className="text-gray-500 mt-1">
            自动获取近期新上市同行业转债进行智能溢价预估，计算最优收益安全垫。
          </p>
          <p className="text-gray-500 mt-1">
            请关注《择再青松》小程序，微信小程序可直接搜索添加
          </p>
        </div>
        <button 
          onClick={handleFetchJisilu}
          disabled={isLoading}
          className="flex items-center space-x-2 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? '同步中...' : '同步最新待发转债'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Config Card */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-end gap-6">
         <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-gray-700">计划买入总资金 (元)</label>
            <input
              type="number"
              step="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={globalCapital || ''}
              onChange={(e) => applyGlobalCapital(parseFloat(e.target.value) || 0)}
            />
         </div>
         <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-gray-700">快速搜索</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="名称 / 代码..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-medium">
              <tr>
                <th className="px-4 py-3">
                  <div className="flex flex-col space-y-1.5">
                    <span className="text-gray-700 font-semibold">转债/正股</span>
                    <select
                      value={trendFilter}
                      onChange={(e) => setTrendFilter(e.target.value)}
                      className="text-xs font-normal text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[110px]"
                    >
                      <option value="ALL">全部趋势</option>
                      <option value="STRONG">强势上涨/连阳</option>
                      <option value="VOLUME">量能温和放大</option>
                      <option value="SAFE_SCORE">正股优质(4分+)</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col space-y-1.5">
                    <span className="text-gray-700 font-semibold">市场/进度</span>
                    <select
                      value={progressFilter}
                      onChange={(e) => setProgressFilter(e.target.value)}
                      className="text-xs font-normal text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[110px]"
                    >
                      <option value="ALL">全部进度</option>
                      <option value="同意注册">同意注册</option>
                      <option value="上市委通过">上市委通过</option>
                      <option value="受理">交易所受理</option>
                      <option value="SH">仅看沪市</option>
                      <option value="SZ">仅看深市</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <span className="text-gray-700 font-semibold">正股价/转股价</span>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <span className="text-gray-700 font-semibold">转股价值</span>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col space-y-1.5">
                    <span className="text-gray-700 font-semibold">发行/流通规模</span>
                    <select
                      value={scaleFilter}
                      onChange={(e) => setScaleFilter(e.target.value)}
                      className="text-xs font-normal text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[110px]"
                    >
                      <option value="ALL">全部规模</option>
                      <option value="SMALL">迷你盘 (&lt;1.5亿)</option>
                      <option value="MEDIUM">中小盘 (1.5-3亿)</option>
                      <option value="LARGE">大盘 (&gt;3.0亿)</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 w-40">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <div className="flex items-center space-x-1" title="参考近期刚上市同行业可转债的溢价率">
                      <span className="text-gray-700 font-semibold">智能预估溢价率(%)</span>
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 w-32">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <span className="text-gray-700 font-semibold">买入股数(股)</span>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <span className="text-gray-700 font-semibold">预估上市价</span>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <span className="text-gray-700 font-semibold">配售股数指标</span>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex items-center text-emerald-600 font-semibold">
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      <span>1手党安全垫</span>
                    </div>
                    <select
                      value={cushionFilter}
                      onChange={(e) => setCushionFilter(e.target.value)}
                      className="text-xs font-normal text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[115px]"
                    >
                      <option value="ALL">全部收益</option>
                      <option value="HIGH">高收益 (&ge;5%)</option>
                      <option value="POSITIVE">正向收益 (&gt;0%)</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex flex-col justify-end h-full pt-4">
                    <div className="flex items-center text-purple-600 font-semibold">
                      <Banknote className="w-4 h-4 mr-1" />
                      <span>大众版安全垫</span>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                    {isLoading ? '数据加载中...' : '暂无匹配数据'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const b = row.bond;
                  const res = row.result;
                  const isExpanded = expandedStockCode === b.stockCode;
                  
                  return (
                    <React.Fragment key={b.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-3 cursor-pointer select-none" onClick={() => setExpandedStockCode(prev => prev === b.stockCode ? null : b.stockCode)}>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 group-hover:text-blue-500 transition-colors">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                            <div>
                              <div className="font-medium text-gray-900 flex items-center space-x-1.5">
                                <span>{b.bondName}</span>
                                <div 
                                  className={`cursor-pointer w-4 h-4 ml-1 flex items-center justify-center rounded bg-opacity-50 transition-colors ${radarExpandedStockCode === b.stockCode ? 'text-white bg-blue-500' : 'text-blue-500 bg-blue-50 hover:bg-opacity-100'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRadarExpandedStockCode(prev => prev === b.stockCode ? null : b.stockCode);
                                  }}
                                  title="点击展开综合评分雷达图"
                                >
                                  <Activity className="w-[10px] h-[10px]" />
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono">({b.bondCode})</span>
                              </div>
                              <div className="text-xs text-gray-500 flex items-center space-x-1 mt-0.5">
                                 <span>{b.stockName}</span>
                                 <span>•</span>
                                 <span className="font-mono">{b.stockCode}</span>
                              </div>
                            </div>
                          </div>
                          {row.industry && (
                            <div className="text-[10px] mt-2 flex flex-wrap gap-1 ml-6 max-w-[280px]">
                              {row.industry.split(' | ').map((part, index) => {
                                if (index === 0) {
                                  return (
                                    part ? <span key={index} className="bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded-sm border border-blue-200/60 shadow-sm">
                                      {part}
                                    </span> : null
                                  );
                                } else {
                                  return part.split('、').map((concept, cIdx) => (
                                    <span key={`${index}-${cIdx}`} className="bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm border border-gray-200/60 shadow-sm max-w-[100px] truncate" title={concept}>
                                      {concept}
                                    </span>
                                  ));
                                }
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex flex-col items-start gap-1">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${b.market === 'SH' ? 'bg-orange-50 text-orange-700' : 'bg-cyan-50 text-cyan-700'}`}>
                                  {b.market === 'SH' ? '沪市' : '深市'}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 max-w-[120px] truncate" title={b.progressName.replace(/<[^>]*>?/gm, ' ')}>
                                  {b.progressName.replace(/<[^>]*>?/gm, ' ')}
                              </span>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            {(row.isThreeDaysUp || row.isVolumeAmplified) && (
                              <div className="flex flex-col gap-0.5 items-end mt-0.5">
                                {row.isThreeDaysUp && (
                                  <span className="text-[9px] px-1 py-[1px] bg-red-100/80 text-red-700 rounded-sm whitespace-nowrap font-medium border border-red-200/50" title="近连续3个交易日收盘价大于开盘价">
                                    连阳
                                  </span>
                                )}
                                {row.isVolumeAmplified && (
                                  <span className="text-[9px] px-1 py-[1px] bg-amber-100/80 text-amber-700 rounded-sm font-medium whitespace-nowrap border border-amber-200/50" title="近连续2个交易日成交量明显放大">
                                    放量
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="font-mono text-gray-900">{b.stockPrice.toFixed(2)}</div>
                            {row.recentMaxGain && (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] px-1 py-[1px] bg-red-50 text-red-600 rounded whitespace-nowrap" title="近半年从低位最大涨幅">
                                  近半年涨 {parseFloat(row.recentMaxGain) > 0 ? '+' : ''}{row.recentMaxGain}%
                                </span>
                                <span className="text-[9px] px-1 py-[1px] bg-green-50 text-green-600 rounded whitespace-nowrap" title="距近半年高位回调幅度">
                                  距高回调 {row.drawdownFromHigh}%
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-mono text-gray-400 mt-0.5" title="转股价">转: {b.conversionPrice > 0 ? b.conversionPrice.toFixed(2) : '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-blue-600 font-medium" title={`100 / ${b.conversionPrice} * ${b.stockPrice.toFixed(2)}`}>
                            {res ? res.conversionValue.toFixed(2) : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {b.issueSize ? (
                             <div className="flex flex-col">
                               <div className="text-gray-900 font-medium">发: {b.issueSize.toFixed(2)}亿</div>
                               {typeof row.restrictedRatio === 'number' ? (
                                  <div className="text-xs text-gray-500 mt-0.5" title={`大股东总占比(限售): ${row.restrictedRatio.toFixed(2)}%`}>
                                     流: {(b.issueSize * (1 - row.restrictedRatio / 100)).toFixed(2)}亿
                                  </div>
                               ) : (
                                  <div className="text-xs text-gray-300 mt-0.5">流: -</div>
                               )}
                             </div>
                          ) : (
                             <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 relative">
                           {row.isEstimating ? (
                              <div className="flex items-center space-x-2 text-gray-500">
                                 <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                 <span className="text-xs italic">AI 预估中...</span>
                              </div>
                           ) : (
                              <div className="space-y-1.5">
                                 <div className="flex items-center gap-1.5 cursor-help" title={row.rationale || '可在此手动微调最终溢价率以重新计算安全垫'}>
                                    <input
                                       type="number"
                                       step="0.5"
                                       className="w-16 px-1.5 py-1 text-sm font-mono font-medium text-center border border-gray-200 rounded focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-gray-900 focus:bg-white"
                                       value={row.premiumRate}
                                       onChange={(e) => updateRow(idx, 'premiumRate', parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-gray-400 text-xs">%</span>
                                    <Info className="w-4 h-4 text-gray-300 hover:text-gray-500 transition-colors cursor-help" />
                                 </div>
                                 {typeof row.calculatedAverage === 'number' && typeof row.calculatedMedian === 'number' && (
                                   <div className="flex flex-col gap-1 text-[10px] w-full">
                                     <div className="flex flex-wrap gap-1">
                                       <button
                                         onClick={() => updateRow(idx, 'premiumRate', row.calculatedAverage || 0)}
                                         className={`px-1 py-0.5 rounded text-[9px] border transition-all text-left truncate max-w-[85px] leading-tight ${row.premiumRate === row.calculatedAverage ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                         title={`同行业(剩余年限>=5.5年)平均溢价率: ${row.calculatedAverage}%. 点击直接套用计算.`}
                                       >
                                         均值:{row.calculatedAverage}%
                                       </button>
                                       <button
                                         onClick={() => updateRow(idx, 'premiumRate', row.calculatedMedian || 0)}
                                         className={`px-1 py-0.5 rounded text-[9px] border transition-all text-left truncate max-w-[85px] leading-tight ${row.premiumRate === row.calculatedMedian ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                         title={`同行业(剩余年限>=5.5年)中位数溢价率: ${row.calculatedMedian}%. 点击直接套用计算.`}
                                       >
                                         中值:{row.calculatedMedian}%
                                       </button>
                                     </div>
                                   </div>
                                 )}
                              </div>
                           )}
                        </td>
                        <td className="px-4 py-3">
                           <input
                              type="number"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              value={row.holdingShares}
                              step="100"
                              onChange={(e) => updateRow(idx, 'holdingShares', parseInt(e.target.value) || 0)}
                           />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900" title={row.isEstimating ? '等待AI预估...' : `转股价值 * (1 + ${row.premiumRate}%)`}>
                             {row.isEstimating ? '-' : (res ? `${res.estimatedListingPrice.toFixed(2)} 元` : '-')}
                          </div>
                          {!row.isEstimating && res && typeof row.calculatedAverage === 'number' && typeof row.calculatedMedian === 'number' && (
                            <div className="text-[10px] text-gray-400 mt-1.5 flex flex-col gap-0.5 font-mono select-none">
                              <span title={`以同业平均数溢价率(${row.calculatedAverage}%)预估的上市价格（对应 Python 上市价格预估1）`}>
                                预估1 (均值): <span className="font-medium text-gray-600 font-mono">{(res.conversionValue * (1 + row.calculatedAverage / 100)).toFixed(2)} 元</span>
                              </span>
                              <span title={`以同业中位数溢价率(${row.calculatedMedian}%)预估的上市价格（对应 Python 上市价格预估2）`}>
                                预估2 (中值): <span className="font-medium text-gray-600 font-mono">{(res.conversionValue * (1 + row.calculatedMedian / 100)).toFixed(2)} 元</span>
                              </span>
                            </div>
                          )}
                        </td>
                        
                        {/* 配售股数指标 */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-gray-700" title="获取10张(一手)的理论所需底仓股数">
                              满一手需: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{b.sharesForOneLot} 股</span>
                            </span>
                            {b.market === 'SH' && typeof b.minOneLotShares === 'number' && (
                               <span className="text-gray-600" title="基于四舍五入进位规则，稳获1手所需的最少股数（科创板以1股递增，普通沪市以100股递增）">
                                 安全垫最少需: <span className="font-mono bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-medium">{b.minOneLotShares} 股</span>
                               </span>
                            )}
                          </div>
                        </td>

                        {/* 1手党安全垫 */}
                        <td className="px-4 py-3">
                          {b.market === 'SH' ? (
                             <div className="flex flex-col">
                                {res && res.optimalSafetyCushion !== 0 ? (
                                  <span className={`font-semibold ${res.optimalSafetyCushion > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {res.optimalSafetyCushion > 0 ? '+' : ''}{res.optimalSafetyCushion.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                {!row.isEstimating && res && res.minCapitalForOneLot > 0 && (
                                  <span className="text-[10px] text-gray-400 mt-0.5" title={`买入${b.minOneLotShares || b.sharesForOneLot}股`}>
                                     底仓: ¥{res.minCapitalForOneLot.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </span>
                                )}
                             </div>
                          ) : (
                             <span className="text-gray-400 text-xs italic">仅沪市适用</span>
                          )}
                        </td>

                        {/* 大众版安全垫 */}
                        <td className="px-4 py-3">
                           <div className="flex flex-col">
                              {res && row.holdingShares > 0 ? (
                                 <>
                                   <button
                                     type="button"
                                     onClick={() => setAllocationModalRow(row)}
                                     className={`w-fit font-semibold underline decoration-dotted underline-offset-4 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-purple-200 rounded-sm ${res.generalSafetyCushion > 0 ? 'text-purple-600' : 'text-red-500'}`}
                                     title="查看前三十档配售测算表"
                                   >
                                     {res.generalSafetyCushion > 0 ? '+' : ''}{res.generalSafetyCushion.toFixed(2)}%
                                   </button>
                                   <span className="text-[10px] text-gray-400 mt-0.5">
                                      预计配: {b.market === 'SH' ? `${res.allocatedLots}手` : `${res.allocatedBonds}张`}
                                   </span>
                                 </>
                              ) : (
                                 <span className="text-gray-400">-</span>
                              )}
                           </div>
                        </td>

                      </tr>

                      {/* Expanded Radar Row */}
                      {radarExpandedStockCode === b.stockCode && (
                        <tr className="bg-slate-50/20 border-t border-b border-gray-100">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4 whitespace-normal flex flex-col items-center">
                              <h3 className="font-semibold text-gray-900 text-sm mb-2 flex items-center space-x-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                <span>【{b.bondName}】综合指标与妖性评估雷达</span>
                              </h3>
                              <div className="w-full max-w-md h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={[
                                    { subject: '规模评分', A: getScaleScore(b.amount, row.restrictedRatio || 0), fullMark: 10 },
                                    { subject: '转股价值', A: getCbValueScore(b.pma_rt), fullMark: 10 },
                                    { subject: '安全垫', A: getSafetyCushionScore(row), fullMark: 10 },
                                    { subject: '行业评分', A: getIndustryScore(row.industry || ''), fullMark: 10 },
                                    { subject: '妖性', A: getDemonScore(getScaleScore(b.amount, row.restrictedRatio || 0), getIndustryScore(row.industry || ''), b.amount * (1 - (row.restrictedRatio || 0) / 100)), fullMark: 10 },
                                    { subject: '股价安全度', A: row.stockSafetyScore || 5, fullMark: 10 },
                                  ]}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                                    <Radar name={b.bondName} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                                  </RadarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expanded Research Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 border-t border-b border-gray-100">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4 whitespace-normal">
                              {/* Header */}
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                <div className="flex items-center space-x-2">
                                  <Sparkles className="w-4 h-4 text-blue-500" />
                                  <h3 className="font-semibold text-gray-900 text-sm">
                                    【{b.bondName}】同业核心业务比对与估值定价报告
                                  </h3>
                                </div>
                                <span className="text-[11px] text-gray-400">
                                  估值锚：集思录实盘切片 & AI综合大模型
                                </span>
                              </div>

                              {/* Loading / Content Grid */}
                              {row.isEstimating ? (
                                <div className="flex flex-col items-center justify-center py-6 space-y-2 text-gray-400">
                                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                  <span className="text-xs italic">正在获取Jisilu最新行业同类可转债溢价并对标业务...</span>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  
                                  {/* Comparable Peers Card */}
                                  <div className="bg-gray-50/60 rounded-lg p-3.5 border border-gray-100 space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-800">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        <span>同次对标 (剩余年限 &gt;= 5.5年)</span>
                                      </div>
                                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">基准筛选</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                      已自动匹配同大类行业中，剩余久期最贴合(&gt;=5.5年)的在市可转债：
                                    </div>
                                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                                      {row.comparableBonds && row.comparableBonds.length > 0 ? (
                                        row.comparableBonds.map((cb, cIdx) => (
                                          <div key={cIdx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-gray-100 shadow-sm font-mono text-xs">
                                            <span className="text-gray-600 font-sans">{cb.stockName} • {cb.bondName}</span>
                                            <span className="text-blue-600 font-bold">{cb.premiumRate}%</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-xs text-gray-400 italic py-2">全市场对标计算中...</div>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                                      溢价数据实时拉取自集思录实盘切片。
                                    </div>
                                  </div>

                                  {/* Business Profile Comparison */}
                                  <div className="bg-gray-50/60 rounded-lg p-3.5 border border-gray-100 space-y-1.5 h-full">
                                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-800">
                                      <Landmark className="w-4 h-4 text-indigo-500" />
                                      <span>公司核心业务比对结论</span>
                                    </div>
                                    <div className="text-xs text-gray-600 leading-relaxed min-h-[80px]">
                                      {row.businessComparison || '暂无业务比对信息。'}
                                    </div>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5 border-t border-gray-100 pt-1.5 font-mono">
                                      <span>正股评级:</span>
                                      <span className="font-semibold text-gray-700">{b.ratingCode || 'AA-'}</span>
                                      <span className="text-gray-300">|</span>
                                      <span>PB:</span>
                                      <span className="font-semibold text-gray-700">{b.pb ? b.pb.toFixed(2) : '-'}</span>
                                    </div>
                                  </div>

                                  {/* Pricing Adjustment Logic */}
                                  <div className="bg-gray-50/60 rounded-lg p-3.5 border border-gray-100 space-y-1.5">
                                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-800">
                                      <FileText className="w-4 h-4 text-blue-500" />
                                      <span>首日上市估值定价逻辑</span>
                                    </div>
                                    <div className="text-xs text-gray-600 leading-relaxed min-h-[80px]">
                                      {row.valuationLogic || '暂无定价逻辑公式。'}
                                    </div>
                                    <div className="text-[10px] bg-blue-50/50 text-blue-700 p-1.5 rounded border border-blue-100 pb-1">
                                      <strong>双重保障：</strong>结合财务指标(PB,评级)及板块催化确定合理浮动。
                                    </div>
                                  </div>

                                </div>
                              )}

                              {/* AI Stock Technical Analysis Section */}
                              {!row.isEstimating && row.technicalAnalysis && (
                                <div className="mt-4 border-t border-gray-100 pt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                      <TrendingUp className="w-4 h-4 text-rose-500" />
                                      {b.stockName} 正股技术面/涨幅潜力深度诊断 (江恩/薛斯/波浪/SAR)
                                    </h4>
                                  </div>
                                  
                                  <div className="bg-rose-50/30 rounded-lg p-4 border border-rose-100/50 text-sm text-gray-700">
                                    <div className="prose prose-sm prose-rose max-w-none whitespace-pre-wrap leading-relaxed font-sans">
                                      {row.technicalAnalysis}
                                    </div>
                                  </div>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {allocationModalRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={() => setAllocationModalRow(null)}
        >
          <div
            className="w-full max-w-6xl max-h-[86vh] overflow-hidden rounded-lg bg-white shadow-xl border border-gray-200"
            role="dialog"
            aria-modal="true"
            aria-label={`${allocationModalRow.bond.bondName} 配售测算表`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {allocationModalRow.bond.bondName} 配售测算表
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{allocationModalRow.bond.stockName} {allocationModalRow.bond.stockCode}</span>
                  <span>转债规模 {formatNumber(allocationModalRow.bond.issueSize || 0, 2)} 亿</span>
                  <span>预估溢价率 {formatNumber(allocationModalRow.premiumRate, 2)}%</span>
                  {allocationModalRow.bond.subscriptionDate && (
                    <span>申购日 {allocationModalRow.bond.subscriptionDate}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllocationModalRow(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="关闭配售测算表"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(86vh-88px)] overflow-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                  <tr>
                    <th className="px-3 py-2 w-12">序号</th>
                    <th className="px-3 py-2">配售1000元的股数</th>
                    <th className="px-3 py-2">转债规模</th>
                    <th className="px-3 py-2">流动规模</th>
                    <th className="px-3 py-2">股票数量</th>
                    <th className="px-3 py-2">买入资金</th>
                    <th className="px-3 py-2">
                      获取数量（{allocationModalRow.bond.market === 'SH' ? '手' : '张'}）
                    </th>
                    <th className="px-3 py-2">需缴纳金额</th>
                    <th className="px-3 py-2">预计收益</th>
                    <th className="px-3 py-2">安全垫</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allocationRows.map((item) => (
                    <tr key={item.index} className={item.index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                      <td className="px-3 py-2 font-semibold text-gray-700">{item.index}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatNumber(item.sharesForOneLot, 1)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatNumber(item.issueSize, 3)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatNumber(item.circulatingSize, 2)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatInteger(item.stockQuantity)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatNumber(item.buyCapital, 1)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatInteger(item.acquiredQuantity)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{formatInteger(item.paymentAmount)}</td>
                      <td className={`px-3 py-2 font-mono ${item.estimatedProfit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                        {formatNumber(item.estimatedProfit, 2)}
                      </td>
                      <td className={`px-3 py-2 font-mono font-semibold ${item.safetyCushion >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                        {formatNumber(item.safetyCushion, 2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
