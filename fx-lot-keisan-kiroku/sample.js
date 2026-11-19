/* 記入例（架空）— the page opens with these numbers already worked out */
window.FXL_SAMPLES = {
  A: { label: '記入例A（架空）：USD/JPY 買い・口座100万円・許容2%', bal: 1000000, risk: 2, pair: 'USD/JPY', dir: 'buy', entry: '154.20', stop: '153.90', target: '154.80', unit: 10000, step: 0.1, qjpy: '', dayPct: 5, dayLost: 0 },
  B: { label: '記入例B（架空）：今日すでに-36,000円・1日の上限5%', bal: 1000000, risk: 2, pair: 'USD/JPY', dir: 'buy', entry: '154.20', stop: '153.90', target: '154.80', unit: 10000, step: 0.1, qjpy: '', dayPct: 5, dayLost: 36000 },
  C: { label: '記入例C（架空）：EUR/USD 売り・円レート154.20', bal: 1000000, risk: 2, pair: 'EUR/USD', dir: 'sell', entry: '1.0850', stop: '1.0880', target: '1.0790', unit: 10000, step: 0.1, qjpy: '154.20', dayPct: 5, dayLost: 0 }
};
/* 記入例の記録（架空・5トレード）— shown read-only on the free page, so the journal is visible before anyone pays */
window.FXL_LOG_SAMPLE = [
  { date: '2026-11-16', pair: 'USD/JPY', dir: 'buy', entry: '154.20', stop: '153.90', target: '154.80', exit: '154.80', lots: 6.6, unit: 10000, qjpy: '', cost: 0, memo: '押し目買い' },
  { date: '2026-11-16', pair: 'EUR/JPY', dir: 'sell', entry: '166.50', stop: '166.80', target: '165.90', exit: '166.80', lots: 6.6, unit: 10000, qjpy: '', cost: 0, memo: '損切り' },
  { date: '2026-11-17', pair: 'GBP/JPY', dir: 'buy', entry: '203.00', stop: '202.60', target: '203.80', exit: '202.60', lots: 5, unit: 10000, qjpy: '', cost: 0, memo: '指標前に入った' },
  { date: '2026-11-17', pair: 'EUR/USD', dir: 'sell', entry: '1.0850', stop: '1.0880', target: '1.0790', exit: '1.0820', lots: 4.3, unit: 10000, qjpy: '154.20', cost: 0, memo: '半分で利確' },
  { date: '2026-11-18', pair: 'USD/JPY', dir: 'buy', entry: '154.50', stop: '154.20', target: '155.10', exit: '154.38', lots: 6.6, unit: 10000, qjpy: '', cost: 0, memo: '早めに撤退' }
];
