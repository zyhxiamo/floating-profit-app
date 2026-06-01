const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const http = require("http");
const https = require("https");
const path = require("path");
const { TextDecoder } = require("util");
const { API_BASE_URL } = require("./runtime-config");

const COLLAPSED_SIZE = { width: 218, height: 48 };
const EXPANDED_SIZE = { width: 380, height: 620 };

let mainWindow;
let expanded = false;
let uiScale = 0.9;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function currentSize() {
  if (!expanded) return COLLAPSED_SIZE;
  return {
    width: Math.round(EXPANDED_SIZE.width * uiScale),
    height: Math.round(EXPANDED_SIZE.height * uiScale)
  };
}

function resizeWindow() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const size = currentSize();
  const keepRightEdge = !expanded;
  const nextBounds = {
    x: keepRightEdge ? bounds.x + bounds.width - size.width : bounds.x,
    y: bounds.y,
    width: size.width,
    height: size.height
  };
  mainWindow.setBounds(nextBounds, false);
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  mainWindow = new BrowserWindow({
    width: COLLAPSED_SIZE.width,
    height: COLLAPSED_SIZE.height,
    x: workArea.x + workArea.width - COLLAPSED_SIZE.width - 32,
    y: workArea.y + 88,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: COLLAPSED_SIZE.width,
    minHeight: COLLAPSED_SIZE.height,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    show: false,
    icon: path.join(__dirname, "assets", "app-icon.ico"),
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

function setExpanded(nextExpanded) {
  if (!mainWindow) return;
  expanded = nextExpanded;
  const minSize = expanded ? { width: 320, height: 520 } : COLLAPSED_SIZE;
  mainWindow.setMinimumSize(minSize.width, minSize.height);
  mainWindow.setResizable(expanded);
  resizeWindow();
  mainWindow.webContents.send("window:expanded", expanded);
}

function setUiScale(nextScale) {
  uiScale = Math.max(0.84, Math.min(1.22, Number(nextScale) || 0.9));
  if (expanded) resizeWindow();
  return uiScale;
}

function marketPrefix(code) {
  return code.startsWith("6") || code.startsWith("5") || code.startsWith("9") ? "1" : "0";
}

function toQuote(item) {
  return {
    code: String(item.f12 || ""),
    name: String(item.f14 || ""),
    price: Number(item.f2),
    change: Number(item.f4),
    pct: Number(item.f3)
  };
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Referer: "https://finance.qq.com/",
        "User-Agent": "Mozilla/5.0"
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve(new TextDecoder("gb18030").decode(buffer));
      });
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", reject);
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Referer: "https://quote.eastmoney.com/",
        "User-Agent": "Mozilla/5.0"
      }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", reject);
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const transport = target.protocol === "http:" ? http : https;
    const request = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "http:" ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "floating-profit-app/0.2.1"
      }
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        let parsed = {};
        try {
          parsed = responseBody ? JSON.parse(responseBody) : {};
        } catch {
          parsed = {};
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
          return;
        }
        reject(new Error(parsed.message || `request failed: ${response.statusCode}`));
      });
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function tencentSymbol(code, isIndex = false) {
  const indexSymbols = {
    "000001": "sh000001",
    "399001": "sz399001",
    "399006": "sz399006"
  };
  if (isIndex && indexSymbols[code]) return indexSymbols[code];
  return `${marketPrefix(code) === "1" ? "sh" : "sz"}${code}`;
}

function parseTencentQuotes(text) {
  return String(text)
    .split(";")
    .map((line) => {
      const match = line.match(/v_(?:sh|sz)(\d{6})="([^"]*)"/);
      if (!match) return null;
      const parts = match[2].split("~");
      const price = Number(parts[3]);
      return {
        code: match[1],
        name: parts[1] || "",
        price,
        change: Number(parts[31]),
        pct: Number(parts[32])
      };
    })
    .filter((item) => item && item.code && Number.isFinite(item.price));
}

async function getEastmoneyQuotes(codes) {
  const fields = "f12,f14,f2,f3,f4";
  const secids = codes.map((code) => `${marketPrefix(code)}.${code}`).join(",");
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${secids}&fields=${fields}`;
  const payload = await requestJson(url);
  const items = payload?.data?.diff || [];
  return items.map(toQuote).filter((item) => item.code && Number.isFinite(item.price));
}

async function getTencentQuotes(codes, isIndex = false) {
  const symbols = codes.map((code) => tencentSymbol(code, isIndex)).join(",");
  const text = await requestText(`https://qt.gtimg.cn/q=${symbols}`);
  return parseTencentQuotes(text);
}

async function getQuotes(codes) {
  try {
    const quotes = await getEastmoneyQuotes(codes);
    if (quotes.length) return quotes;
  } catch {
    // Fall through to backup provider.
  }
  return getTencentQuotes(codes);
}

function toggleWindowVisibility() {
  if (!mainWindow) return;
  mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
}

app.whenReady().then(() => {
  createWindow();

  ["CommandOrControl+Alt+S", "CommandOrControl+Alt+H", "CommandOrControl+Shift+H", "Alt+Q"].forEach((accelerator) => {
    globalShortcut.register(accelerator, toggleWindowVisibility);
  });

  globalShortcut.register("CommandOrControl+Alt+Space", () => {
    setExpanded(!expanded);
  });
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("window:set-expanded", (_event, nextExpanded) => {
  setExpanded(Boolean(nextExpanded));
  return expanded;
});

ipcMain.handle("window:get-expanded", () => expanded);

ipcMain.handle("window:set-ui-scale", (_event, nextScale) => {
  return setUiScale(nextScale);
});

ipcMain.handle("window:hide", () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle("market:get-indexes", async () => {
  try {
    const fields = "f12,f14,f2,f3,f4";
    const secids = "1.000001,0.399001,0.399006";
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${secids}&fields=${fields}`;
    const payload = await requestJson(url);
    const items = payload?.data?.diff || [];
    const quotes = items.map(toQuote).filter((item) => item.code && Number.isFinite(item.price));
    if (quotes.length) return quotes;
  } catch {
    // Fall through to backup provider.
  }
  return getTencentQuotes(["000001", "399001", "399006"], true);
});

ipcMain.handle("market:get-stocks", async (_event, codes) => {
  const cleanCodes = Array.from(new Set((codes || [])
    .map((code) => String(code).trim())
    .filter((code) => /^\d{6}$/.test(code))));

  if (!cleanCodes.length) return [];

  return getQuotes(cleanCodes);
});

ipcMain.handle("app:submit-review", async (_event, review) => {
  const nickname = String(review?.nickname || "").trim().slice(0, 20);
  const content = String(review?.content || "").trim().slice(0, 100);
  if (!nickname || !content) throw new Error("请填写昵称和评价内容。");
  if (!API_BASE_URL) throw new Error("评价服务正在准备中，请先保存草稿。");
  return postJson(`${API_BASE_URL}/api/reviews`, { nickname, content });
});
