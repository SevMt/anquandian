import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clipboard,
  Loader2,
  RefreshCw,
  ThermometerSun,
} from 'lucide-react';

type MarketRow = {
  price_dt: string;
  price: number;
  increase_rt: number;
  temperature: number;
  avg_price: number;
  mid_price: number;
  mid_convert_value: number;
  avg_premium_rt: number;
  mid_premium_rt: number;
  avg_ytm_rt: number;
  volume: number;
  turnover_rt: number;
  count: number;
  price_90: number;
  price_90_100: number;
  price_100_110: number;
  price_110_120: number;
  price_120_130: number;
  price_130: number;
};

type WeeklySummary = {
  fetchedAt: string;
  cb: {
    latest: MarketRow;
    previous: MarketRow;
  };
  aStock: {
    latest: { date: string; temperature: number };
    previous: { date: string; temperature: number };
  };
  above130Pct: number;
  valuation: string;
  report: string;
};

const formatNumber = (value: number | string | undefined, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(digits).replace(/\.?0+$/, '');
};

const metricCards = (data: WeeklySummary) => [
  {
    label: '可转债指数',
    value: formatNumber(data.cb.latest.price, 3),
    sub: `${data.cb.latest.price_dt} / 上周 ${formatNumber(data.cb.previous.price, 3)}`,
  },
  {
    label: '转债温度',
    value: `${formatNumber(data.cb.latest.temperature, 2)}°`,
    sub: `上周 ${formatNumber(data.cb.previous.temperature, 2)}°`,
  },
  {
    label: 'A股温度',
    value: `${formatNumber(data.aStock.latest.temperature, 2)}°`,
    sub: `${data.aStock.latest.date} / 上周 ${formatNumber(data.aStock.previous.temperature, 2)}°`,
  },
  {
    label: '估值判断',
    value: data.valuation,
    sub: `≥130 占比 ${formatNumber(data.above130Pct, 1)}%`,
  },
];

const priceBands = [
  { label: '<90', key: 'price_90' },
  { label: '90~100', key: 'price_90_100' },
  { label: '100~110', key: 'price_100_110' },
  { label: '110~120', key: 'price_110_120' },
  { label: '120~130', key: 'price_120_130' },
  { label: '≥130', key: 'price_130' },
] as const;

function WeeklyMarketTool() {
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSummary = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/market/weekly-summary');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details || payload.error || '同步失败');
      }
      setData(payload);
    } catch (err: any) {
      setError(err.message || '同步失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const totalPriceBandCount = useMemo(() => {
    if (!data) return 0;
    return priceBands.reduce((sum, band) => sum + Number(data.cb.latest[band.key] || 0), 0);
  }, [data]);

  const copyReport = async () => {
    if (!data?.report) return;
    await navigator.clipboard.writeText(data.report.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
              <ThermometerSun className="h-4 w-4" />
              自动抓取 / 周报生成
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              可转债市场温度周报
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              自动同步集思录可转债指数与 A 股温度数据，生成可直接复制到公众号的市场概况文案。
            </p>
          </div>
          <button
            onClick={loadSummary}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            同步最新数据
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="flex min-h-[380px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              正在同步市场数据...
            </div>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards(data).map((card) => (
                  <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-500">{card.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{card.sub}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-5 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-300" />
                  <h2 className="text-base font-semibold text-white">价格区间分布</h2>
                </div>
                <div className="space-y-4">
                  {priceBands.map((band) => {
                    const count = Number(data.cb.latest[band.key] || 0);
                    const pct = totalPriceBandCount > 0 ? (count / totalPriceBandCount) * 100 : 0;
                    return (
                      <div key={band.key} className="grid grid-cols-[72px_1fr_70px] items-center gap-3 text-sm">
                        <span className="font-mono text-slate-400">{band.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                        <span className="text-right font-medium text-slate-200">{formatNumber(count, 0)} 个</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-5 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-base font-semibold text-white">核心市场指标</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-slate-500">成交额</p>
                    <p className="mt-1 font-semibold text-white">{formatNumber(data.cb.latest.volume, 2)} 亿</p>
                  </div>
                  <div>
                    <p className="text-slate-500">平均价格</p>
                    <p className="mt-1 font-semibold text-white">{formatNumber(data.cb.latest.avg_price, 3)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">平均溢价率</p>
                    <p className="mt-1 font-semibold text-white">{formatNumber(data.cb.latest.avg_premium_rt, 2)}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">换手率</p>
                    <p className="mt-1 font-semibold text-white">{formatNumber(data.cb.latest.turnover_rt, 2)}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">自动生成文案</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    数据同步于 {new Date(data.fetchedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <button
                  onClick={copyReport}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  <Clipboard className="h-4 w-4" />
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-sm leading-7 text-slate-200">
                {data.report.trim()}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WeeklyMarketTool;
