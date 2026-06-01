const DEFAULT_STOCKS = [
  { code: "600519", name: "贵州茅台", price: null, change: null, pct: null },
  { code: "000001", name: "平安银行", price: null, change: null, pct: null },
  { code: "300750", name: "宁德时代", price: null, change: null, pct: null }
];

const NAME_MAP = {
  "600519": "贵州茅台",
  "000001": "平安银行",
  "300750": "宁德时代",
  "601318": "中国平安",
  "600036": "招商银行",
  "000858": "五粮液",
  "002594": "比亚迪",
  "600900": "长江电力"
};

const DEFAULT_SETTINGS = {
  version: 5,
  fontScale: 82,
  uiScale: 90,
  showMarketColor: true
};

const FALLBACK_INDEXES = [
  { code: "000001", name: "上证指数", price: 0, change: 0, pct: 0 },
  { code: "399001", name: "深证成指", price: 0, change: 0, pct: 0 },
  { code: "399006", name: "创业板指", price: 0, change: 0, pct: 0 }
];

let settings = loadSettings();
let stocks = loadStocks();
let activeIndex = 0;
let expanded = false;
let refreshingStocks = false;

const app = document.getElementById("app");
const expandFromCompact = document.getElementById("expandFromCompact");
const collapseButton = document.getElementById("collapseButton");
const refreshButton = document.getElementById("refreshButton");
const hideButton = document.getElementById("hideButton");
const feedbackButton = document.getElementById("feedbackButton");
const feedbackModal = document.getElementById("feedbackModal");
const feedbackText = document.getElementById("feedbackText");
const saveFeedbackButton = document.getElementById("saveFeedbackButton");
const submitFeedbackButton = document.getElementById("submitFeedbackButton");
const feedbackNote = document.getElementById("feedbackNote");
const watchlist = document.getElementById("watchlist");
const addForm = document.getElementById("addForm");
const stockInput = document.getElementById("stockInput");
const formNote = document.getElementById("formNote");
const fontScaleInput = document.getElementById("fontScale");
const uiScaleInput = document.getElementById("uiScale");
const colorToggle = document.getElementById("colorToggle");
const stepButtons = document.querySelectorAll(".step-button");
const presetButtons = document.querySelectorAll("[data-preset]");
const feedbackStoreKey = "feedbackItems";

function loadSettings() {
  const saved = localStorage.getItem("displaySettings");
  if (!saved) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(saved);
    if (parsed.version !== DEFAULT_SETTINGS.version) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem("displaySettings", JSON.stringify(settings));
}

function readFeedbackItems() {
  try {
    const items = JSON.parse(localStorage.getItem(feedbackStoreKey) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveFeedback(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const items = readFeedbackItems();
  items.unshift({
    text: trimmed,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(feedbackStoreKey, JSON.stringify(items.slice(0, 50)));
  return true;
}

function quoteNumber(value) {
  if (value === null || value === undefined || value === "" || value === "--") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStock(stock) {
  const code = String(stock.code || "").padStart(6, "0").slice(-6);
  const fallback = DEFAULT_STOCKS.find((item) => item.code === code);
  return {
    code,
    name: NAME_MAP[code] || fallback?.name || stock.name || `股票 ${code}`,
    price: quoteNumber(stock.price) ?? fallback?.price ?? null,
    change: quoteNumber(stock.change) ?? fallback?.change ?? null,
    pct: quoteNumber(stock.pct) ?? fallback?.pct ?? null
  };
}

function loadStocks() {
  const saved = localStorage.getItem("watchlist");
  if (!saved) return DEFAULT_STOCKS.map(normalizeStock);

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeStock) : DEFAULT_STOCKS.map(normalizeStock);
  } catch {
    return DEFAULT_STOCKS.map(normalizeStock);
  }
}

function saveStocks() {
  localStorage.setItem("watchlist", JSON.stringify(stocks));
}

function applySettings({ resizeWindow = false } = {}) {
  document.documentElement.style.setProperty("--font-scale", String(settings.fontScale / 100));
  document.documentElement.style.setProperty("--ui-scale", String(settings.uiScale / 100));
  app.classList.toggle("mono-market", !settings.showMarketColor);
  fontScaleInput.value = String(settings.fontScale);
  uiScaleInput.value = String(settings.uiScale);
  colorToggle.checked = settings.showMarketColor;
  if (resizeWindow) window.floatWindow?.setUiScale(settings.uiScale / 100);
}

function marketClass(stock) {
  if (stock.pct > 0) return "market-up";
  if (stock.pct < 0) return "market-down";
  return "market-flat";
}

function signed(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(digits)}`;
}

function priceText(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "--";
}

function currentStock() {
  if (!stocks.length) return null;
  activeIndex %= stocks.length;
  return stocks[activeIndex];
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function setMarketText(id, text, stock) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = marketClass(stock);
}

function renderCurrent() {
  const stock = currentStock();
  if (!stock) return;

  setText("compactName", stock.name);
  setText("compactCode", stock.code);
  setText("compactPrice", priceText(stock.price));
  setMarketText("compactChange", `${signed(stock.pct)}%`, stock);

  setText("heroName", stock.name);
  setText("heroCode", stock.code);
  setText("heroPrice", priceText(stock.price));
  setMarketText("heroChange", `${signed(stock.change)}  ${signed(stock.pct)}%`, stock);
}

function renderWatchlist() {
  watchlist.innerHTML = "";

  stocks.forEach((stock, index) => {
    const row = document.createElement("article");
    row.className = `stock-row${index === activeIndex ? " active" : ""}`;
    row.innerHTML = `
      <div class="row-title">
        <div class="row-name">${stock.name}</div>
        <div class="row-code">${stock.code}</div>
      </div>
      <div class="row-value">
        <strong>${priceText(stock.price)}</strong>
        <span class="${marketClass(stock)}">${signed(stock.pct)}%</span>
      </div>
      <button class="remove-button" type="button" aria-label="删除 ${stock.code}">×</button>
    `;

    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      activeIndex = index;
      render();
    });

    row.querySelector("button").addEventListener("click", () => {
      stocks = stocks.filter((item) => item.code !== stock.code);
      if (!stocks.length) stocks = DEFAULT_STOCKS.map(normalizeStock);
      activeIndex = Math.min(activeIndex, stocks.length - 1);
      saveStocks();
      render();
    });

    watchlist.appendChild(row);
  });
}

function renderTime() {
  const now = new Date();
  setText("updatedAt", `最后更新 ${now.toLocaleTimeString("zh-CN", { hour12: false })}`);
}

function render() {
  renderCurrent();
  renderWatchlist();
  renderTime();
}

function mergeQuotes(quotes) {
  if (!Array.isArray(quotes) || !quotes.length) return false;
  const quoteMap = new Map(quotes.map((quote) => [quote.code, quote]));
  let changed = false;

  stocks = stocks.map((stock) => {
    const quote = quoteMap.get(stock.code);
    if (!quote || !Number.isFinite(quote.price)) return stock;
    changed = true;
    return {
      ...stock,
      name: quote.name || stock.name,
      price: quote.price,
      change: Number.isFinite(quote.change) ? quote.change : stock.change,
      pct: Number.isFinite(quote.pct) ? quote.pct : stock.pct
    };
  });

  if (changed) saveStocks();
  return changed;
}

async function refreshStocks() {
  if (refreshingStocks) return;
  refreshingStocks = true;
  try {
    formNote.textContent = "正在刷新实时行情...";
    const quotes = await window.marketData?.getStocks(stocks.map((stock) => stock.code));
    const changed = mergeQuotes(quotes);
    formNote.textContent = changed ? "实时行情已更新。" : "暂未拿到新行情，保留当前数据。";
  } catch {
    formNote.textContent = "行情接口暂时不可用，保留当前数据。";
  } finally {
    refreshingStocks = false;
    render();
  }
}

function renderIndexes(indexes) {
  indexes.slice(0, 3).forEach((item, index) => {
    const stock = {
      pct: Number(item.pct) || 0
    };
    setText(`indexName${index}`, item.name || FALLBACK_INDEXES[index].name);
    setText(`indexPrice${index}`, item.price ? Number(item.price).toFixed(2) : "--");
    setMarketText(
      `indexChange${index}`,
      item.price ? `${signed(item.change || 0)}  ${signed(item.pct || 0)}%` : "--",
      stock
    );
  });
}

async function refreshIndexes() {
  try {
    const indexes = await window.marketData?.getIndexes();
    renderIndexes(Array.isArray(indexes) && indexes.length ? indexes : FALLBACK_INDEXES);
  } catch {
    renderIndexes(FALLBACK_INDEXES);
  }
}

function rotateStock() {
  if (expanded || stocks.length <= 1) return;
  activeIndex = (activeIndex + 1) % stocks.length;
  render();
}

async function setExpanded(nextExpanded) {
  expanded = nextExpanded;
  setAppMode();
  await window.floatWindow?.setExpanded(expanded);
  render();
  if (expanded) refreshIndexes();
}

function setAppMode() {
  app.className = `app ${expanded ? "expanded" : "collapsed"}`;
  app.classList.toggle("mono-market", !settings.showMarketColor);
}

async function addStock(code) {
  if (!/^\d{6}$/.test(code)) {
    formNote.textContent = "请输入 6 位 A 股代码。";
    return;
  }

  if (stocks.some((stock) => stock.code === code)) {
    formNote.textContent = `${code} 已在自选列表里。`;
    return;
  }

  formNote.textContent = `正在识别 ${code}...`;
  let quote;

  try {
    const quotes = await window.marketData?.getStocks([code]);
    quote = Array.isArray(quotes) ? quotes.find((item) => item.code === code) : null;
  } catch {
    quote = null;
  }

  if (!quote || !quote.name || !Number.isFinite(Number(quote.price))) {
    formNote.textContent = `没有识别到 ${code} 的实时行情，请检查代码或稍后重试。`;
    return;
  }

  stocks.push({
    code,
    name: quote.name,
    price: Number(quote.price),
    change: Number.isFinite(Number(quote.change)) ? Number(quote.change) : 0,
    pct: Number.isFinite(Number(quote.pct)) ? Number(quote.pct) : 0
  });
  formNote.textContent = `${quote.name} ${code} 已添加。`;
  stockInput.value = "";
  saveStocks();
  render();
}

function updateSetting(key, value, options = {}) {
  const limits = {
    fontScale: [60, 120],
    uiScale: [84, 122]
  };
  const nextValue = limits[key]
    ? Math.max(limits[key][0], Math.min(limits[key][1], Number(value)))
    : value;

  settings = { ...settings, [key]: nextValue };
  saveSettings();
  applySettings({ resizeWindow: key === "uiScale" && options.resizeWindow });
  render();
}

expandFromCompact.addEventListener("click", () => setExpanded(true));
collapseButton.addEventListener("click", () => setExpanded(false));
hideButton.addEventListener("click", () => window.floatWindow?.hide());
feedbackButton.addEventListener("click", () => feedbackModal.showModal());
saveFeedbackButton.addEventListener("click", () => {
  const saved = saveFeedback(feedbackText.value);
  feedbackNote.textContent = saved ? "草稿已保存在本机。" : "先写一点反馈内容再保存。";
});
submitFeedbackButton.addEventListener("click", async () => {
  const text = feedbackText.value.trim();
  if (!text) {
    feedbackNote.textContent = "先写一点反馈内容再提交。";
    return;
  }
  saveFeedback(text);
  feedbackNote.textContent = "正在打开在线反馈页...";
  await window.appActions?.submitFeedback(text);
});
refreshButton.addEventListener("click", () => {
  refreshStocks();
  refreshIndexes();
});

fontScaleInput.addEventListener("input", (event) => {
  updateSetting("fontScale", Number(event.target.value));
});

uiScaleInput.addEventListener("input", (event) => {
  updateSetting("uiScale", Number(event.target.value), { resizeWindow: false });
});

uiScaleInput.addEventListener("change", (event) => {
  updateSetting("uiScale", Number(event.target.value), { resizeWindow: true });
});

stepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const setting = button.dataset.setting;
    const step = Number(button.dataset.step);
    updateSetting(setting, Number(settings[setting]) + step, { resizeWindow: setting === "uiScale" });
  });
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const preset = button.dataset.preset;
    const presets = {
      small: { fontScale: 70, uiScale: 84 },
      normal: { fontScale: 82, uiScale: 90 },
      large: { fontScale: 100, uiScale: 112 },
      reset: { fontScale: DEFAULT_SETTINGS.fontScale, uiScale: DEFAULT_SETTINGS.uiScale }
    };
    settings = { ...settings, ...presets[preset] };
    saveSettings();
    applySettings({ resizeWindow: true });
    render();
  });
});

colorToggle.addEventListener("change", (event) => {
  updateSetting("showMarketColor", event.target.checked);
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addStock(stockInput.value.trim());
});

window.floatWindow?.onExpandedChange((nextExpanded) => {
  expanded = nextExpanded;
  setAppMode();
  render();
  if (expanded) refreshIndexes();
});

applySettings({ resizeWindow: false });
render();
refreshIndexes();
refreshStocks();
setInterval(rotateStock, 5000);
setInterval(refreshStocks, 15000);
setInterval(refreshIndexes, 15000);
