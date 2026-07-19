async function test() {
  const emResp = await fetch('https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=PUBLIC_START_DATE&sortTypes=-1&pageSize=500&pageNumber=1&reportName=RPT_BOND_CB_LIST&columns=ALL&source=WEB&client=WEB');
  const emData = await emResp.json();
  const recentBondsData = emData.result.data;
  const chunks = [];
  for (let i = 0; i < recentBondsData.length; i += 100) {
    chunks.push(recentBondsData.slice(i, i + 100));
  }
  let allQuotes = [];
  let allStockQuotes = [];
  for (const chunk of chunks) {
    const secids = chunk.map(r => (r.TRADE_MARKET === 'CNSESH' ? '1.' : '0.') + r.SECURITY_CODE).join(',');
    const qResp = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f227&secids=${secids}`);
    const qData = await qResp.json();
    if (qData && qData.data && qData.data.diff) {
      allQuotes = allQuotes.concat(qData.data.diff);
    }
    
    // fetch stock industries
    const stockSecids = chunk.map(r => ((r.TRADE_MARKET === 'CNSESH' || r.CONVERT_STOCK_CODE.startsWith('6')) ? '1.' : '0.') + r.CONVERT_STOCK_CODE).join(',');
    const sResp = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f100&secids=${stockSecids}`);
    const sData = await sResp.json();
    if (sData && sData.data && sData.data.diff) {
      allStockQuotes = allStockQuotes.concat(sData.data.diff);
    }
  }
  const quotesMap = new Map();
  allQuotes.forEach(q => quotesMap.set(q.f12, q));
  const stockQuotesMap = new Map();
  allStockQuotes.forEach(q => stockQuotesMap.set(q.f12, q));
  const now = Date.now();
  const listedBonds = recentBondsData.map((r) => {
    const q = quotesMap.get(r.SECURITY_CODE);
    const sq = stockQuotesMap.get(r.CONVERT_STOCK_CODE);
    if (!q || q.f2 === '-' || q.f227 === '-' || !q.f2 || !q.f227) return null;
    const cease = new Date(r.CEASE_DATE).getTime();
    const yearLeft = (cease - now) / (365.25 * 24 * 3600 * 1000);
    const price = parseFloat(q.f2);
    const convValue = parseFloat(q.f227);
    const premiumRt = convValue > 0 ? (price / convValue - 1) * 100 : 0;
    return {
      cell: {
        bond_id: r.SECURITY_CODE, bond_nm: r.SECURITY_NAME_ABBR,
        stock_id: r.CONVERT_STOCK_CODE, stock_nm: r.SECURITY_SHORT_NAME,
        year_left: yearLeft, premium_rt: parseFloat(premiumRt.toFixed(2)),
        sw_cd: r.SECURITY_CODE, rating_cd: r.RATING || 'AA', pb: '1.5', list_dt: r.LISTING_DATE || '',
        industry_name: sq ? sq.f100 : ''
      }
    };
  }).filter(Boolean);
  
  const sameIndBonds = listedBonds.map(r=>r.cell).filter(c=> c.stock_nm && c.bond_nm && typeof c.premium_rt === 'number');
  const INDUSTRIES = [{name:'机械设备', keywords:['机','车','汽']}]
  console.log(sameIndBonds.slice(0,2));
  console.log('Total listed bonds:', listedBonds.length);
  console.log(' >= 5.5 yrs total:', sameIndBonds.filter(c=>c.year_left >= 5.5).length);
  const indBonds = sameIndBonds.filter(c => {
    const text = (c.stock_nm+c.bond_nm).toLowerCase();
    return INDUSTRIES[0].keywords.some(kw => text.includes(kw));
  });
  console.log('Ind bonds:', indBonds.length);
  console.log('Ind bounds >= 5.5:', indBonds.filter(c=>c.year_left >= 5.5).length);
}
test();
