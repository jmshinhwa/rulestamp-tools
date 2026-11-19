// i18n.js — UI strings. ja = the page text itself (read from the DOM at load) + the dynamic strings below; en complete; de/es/pt main lines (missing → en)
self.HB_I18N = {
  ja: {
    kInc: '収入', kSpend: '支出', kSp: '特別費の積立（月）', kLeft: '残り', kRate: '貯蓄率', kBud: '予算合計',
    settle: '今月の精算：{from}→{to} {amt}', settleNone: '今月の精算：なし（負担どおりに払えています）',
    over: '{cat} が予算を {amt} オーバー', dueNow: '今月払う特別費：{name} {amt}', dueNext: '来月の特別費：{name} {amt}（毎月の積立 {m}）',
    allOk: 'すべての分類が予算内です', shared: '共通', auto: '自動', del: '削除', monthly: '毎月 {m}',
    spSum: '特別費 合計 {t} ÷ 12 = 毎月 {m} の積立（端数は切り上げ）',
    ratioText: '{a} {pa}% ・ {b} {pb}%',
    calc: '共通の支出 {sh} × {pa}% = {a} の負担 {sa}\n共通の支出 {sh} − {sa} = {b} の負担 {sb}\n{a} の負担すべき額 = {sa} + 自分の支出 {oa} = {wa}\n{a} が実際に払った額 = {pda}\n{pda} − {wa} = {net}',
    free: '無料版：今月の1か月分（行数の制限なし）', pro: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', tierM: '月額', tierY: '年額',
    payCsv: '',
    payXlsx: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    payMonth: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    csvDone: '{n} 行を読み込みました（読めなかった行 {s}）。月：{months}', csvNone: '日付と金額の列が見つかりませんでした。カード会社のサイトでCSV形式を選んでダウンロードしてください。',
    keyOk: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', keyBad: 'このキーは確認できませんでした。', keyOff: 'ネットにつながらず確認できませんでした。',
    expDone: 'バックアップを保存しました。', impDone: 'バックアップを開きました。', impBad: 'このファイルはこの家計簿のバックアップではありません。',
    resetQ: 'この端末の家計簿データをすべて消しますか？', proFirst: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    rTitle: '家計簿 {ym}', rSettle: '夫婦精算', rSp: '特別費', rLines: '明細'
  },
  en: {
    lang: 'Language', h1rest: ' | couples\' settle-up and yearly costs calculated for you (no bank login)',
    sub: 'A household budget for two: no hand-typed template rows, no bank linking. Mark each cost as person 1, person 2 or shared and see budget vs actual and this month\'s settle-up.',
    lede: 'Example (made-up household): shared costs of ¥201,620 split 6:4 give this month\'s settle-up "妻→夫 ¥27,548". Eating out: budget ¥15,000, actual ¥22,410, ¥7,410 over. Next month\'s car insurance of ¥60,000 is covered by saving ¥5,000 a month.',
    b1: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    b2: 'Mark each line person 1 / person 2 / shared and the settle-up for your split (e.g. 6:4 or by income) appears on screen. Yearly costs (car tax, property tax, insurance…) become a monthly saving (÷ 12) and are flagged in the month they are due.',
    why: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    sample: 'Calculate the example', own: 'Start with my household', buyM: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', buyY: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    freeLine: 'Free: one household, one month, any number of lines. Budget vs actual, settle-up and the yearly-cost saving all on screen. No account, no ads, data stays in this browser.',
    secResult: 'This month', resultEmpty: 'Press "Calculate the example" or enter costs below.', thCat: 'Category', thBud: 'Budget', thAct: 'Actual', thDiff: 'Left', calcHow: 'Show the settle-up maths',
    secSetup: 'Household and month', nameA: 'Person 1 name', nameB: 'Person 2 name', incA: 'Person 1 take-home (this month)', incB: 'Person 2 take-home (this month)', ratioA: 'Share of shared costs (person 1 %)', ratioInc: 'Use income ratio', month: 'Month',
    monthNote: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', secEntry: 'Add costs', add: 'Add', entryHint: 'Leave the category on "auto" and it is chosen from the shop name. You can change it later.',
    thDate: 'Date', thShop: 'Shop / item', thAmt: 'Amount', thWho: 'Whose', thPaid: 'Paid by', secBudget: 'Budget (add or rename categories freely)', catAdd: '+ Add category',
    secSpecial: 'Yearly costs → monthly saving', thName: 'Name', thMonth: 'Month due', thMonthly: 'Monthly saving', spAdd: '+ Add yearly cost',
    proLead: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    secPro: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', csvT: 'Import card / bank CSV', csvD: 'Choose the CSV you downloaded from your card or bank. It is read only inside this browser and sent nowhere. Date, shop and amount columns are found from the header (or guessed from the values).', csvPick: 'Choose CSV',
    xlsxT: 'Save as Excel and print', xlsxD: 'The .xlsx has live formulas: month (budget/actual/left) · settle-up · yearly costs · year (12 months) · lines. Opens in Excel, Google Sheets and Numbers.', xlsxBtn: 'Download Excel (.xlsx)', printBtn: 'Print / PDF', icsBtn: 'Yearly-cost reminders (.ics)',
    yearT: 'Year table (12 months)', thMonth2: 'Month', thInc: 'Income', thSpend: 'Spent', thSp: 'Saving', thLeft: 'Left', thSettle: 'Settle-up',
    proNote: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', keyBtn: 'Activate key', keyDel: 'Remove key',
    secData: 'Data (only on this device)', dataD: 'Your entries are saved in this browser automatically. No login. A backup file opens the same household on another device or your partner\'s phone.', expBtn: 'Save backup', impBtn: 'Open backup', resetBtn: 'Delete all',
    secMore: 'More tools', moreAll: 'All rulestamp tools (Japanese)', foot: 'The example household and amounts are made up. Everything is calculated in your browser.',
    phShop: 'Shop / item (e.g. AEON)', phAmt: 'Amount', phCard: 'Card name (e.g. my card)', phKey: '',
    kInc: 'Income', kSpend: 'Spent', kSp: 'Yearly-cost saving (month)', kLeft: 'Left', kRate: 'Savings rate', kBud: 'Budget total',
    settle: 'Settle-up this month: {from}→{to} {amt}', settleNone: 'Settle-up this month: none', over: '{cat} is {amt} over budget', dueNow: 'Yearly cost due this month: {name} {amt}', dueNext: 'Yearly cost next month: {name} {amt} (monthly saving {m})',
    allOk: 'Every category is within budget', shared: 'shared', auto: 'auto', del: 'Delete', monthly: 'monthly {m}', spSum: 'Yearly costs {t} ÷ 12 = save {m} a month (rounded up)', ratioText: '{a} {pa}% · {b} {pb}%',
    calc: 'Shared {sh} × {pa}% = {a} share {sa}\nShared {sh} − {sa} = {b} share {sb}\n{a} should pay {sa} + own {oa} = {wa}\n{a} actually paid {pda}\n{pda} − {wa} = {net}',
    free: 'Free: this month (any number of lines)', pro: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', tierM: 'monthly', tierY: 'yearly',
    payCsv: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', payXlsx: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', payMonth: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    csvDone: 'Imported {n} lines (unreadable {s}). Months: {months}', csvNone: 'No date and amount columns found. Download the statement as CSV from your card site.',
    keyOk: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', keyBad: 'This key could not be confirmed.', keyOff: 'Offline — could not check the key.', expDone: 'Backup saved.', impDone: 'Backup opened.', impBad: 'This file is not a backup of this app.', resetQ: 'Delete all household data on this device?', proFirst: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    rTitle: 'Household budget {ym}', rSettle: 'Settle-up', rSp: 'Yearly costs', rLines: 'Lines'
  },
  de: {
    lang: 'Sprache', h1rest: ' | Ausgleich unter Paaren und Jahreskosten automatisch berechnet (ohne Bank-Login)', sample: 'Beispiel berechnen', own: 'Mit meinem Haushalt starten', buyM: 'Pro monatlich', buyY: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    secResult: 'Dieser Monat', secSetup: 'Haushalt und Monat', secEntry: 'Ausgaben eintragen', secBudget: 'Budget', secSpecial: 'Jahreskosten → monatliche Rücklage', secPro: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', secData: 'Daten (nur auf diesem Gerät)', secMore: 'Weitere Tools',
    add: 'Hinzufügen', thCat: 'Kategorie', thBud: 'Budget', thAct: 'Ist', thDiff: 'Rest', thDate: 'Datum', thShop: 'Geschäft', thAmt: 'Betrag', thWho: 'Wessen', thPaid: 'Bezahlt von', xlsxBtn: 'Excel (.xlsx) herunterladen', printBtn: 'Drucken / PDF', keyBtn: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    kInc: 'Einnahmen', kSpend: 'Ausgaben', kLeft: 'Rest', kRate: 'Sparquote', settle: 'Ausgleich diesen Monat: {from}→{to} {amt}', shared: 'gemeinsam', auto: 'auto', del: 'Löschen'
  },
  es: {
    lang: 'Idioma', h1rest: ' | liquidación de pareja y gastos anuales calculados (sin conectar el banco)', sample: 'Calcular el ejemplo', own: 'Empezar con mi hogar', buyM: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', buyY: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    secResult: 'Este mes', secSetup: 'Hogar y mes', secEntry: 'Añadir gastos', secBudget: 'Presupuesto', secSpecial: 'Gastos anuales → ahorro mensual', secPro: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', secData: 'Datos (solo en este dispositivo)', secMore: 'Más herramientas',
    add: 'Añadir', thCat: 'Categoría', thBud: 'Presupuesto', thAct: 'Real', thDiff: 'Queda', thDate: 'Fecha', thShop: 'Tienda', thAmt: 'Importe', thWho: 'De quién', thPaid: 'Pagó', xlsxBtn: 'Descargar Excel (.xlsx)', printBtn: 'Imprimir / PDF', keyBtn: 'Activar clave',
    kInc: 'Ingresos', kSpend: 'Gastos', kLeft: 'Queda', kRate: 'Tasa de ahorro', settle: 'Liquidación del mes: {from}→{to} {amt}', shared: 'común', auto: 'auto', del: 'Borrar'
  },
  pt: {
    lang: 'Idioma', h1rest: ' | acerto do casal e despesas anuais calculados (sem conectar o banco)', sample: 'Calcular o exemplo', own: 'Começar com minha casa', buyM: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', buyY: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/',
    secResult: 'Este mês', secSetup: 'Casa e mês', secEntry: 'Lançar gastos', secBudget: 'Orçamento', secSpecial: 'Despesas anuais → reserva mensal', secPro: ' — 保存して続ける: https://getreadystack.com/ja/apps/household-budget-planning/', secData: 'Dados (só neste aparelho)', secMore: 'Mais ferramentas',
    add: 'Adicionar', thCat: 'Categoria', thBud: 'Orçamento', thAct: 'Real', thDiff: 'Sobra', thDate: 'Data', thShop: 'Loja', thAmt: 'Valor', thWho: 'De quem', thPaid: 'Pagou', xlsxBtn: 'Baixar Excel (.xlsx)', printBtn: 'Imprimir / PDF', keyBtn: 'Ativar chave',
    kInc: 'Renda', kSpend: 'Gastos', kLeft: 'Sobra', kRate: 'Taxa de poupança', settle: 'Acerto do mês: {from}→{to} {amt}', shared: 'comum', auto: 'auto', del: 'Apagar'
  }
};
