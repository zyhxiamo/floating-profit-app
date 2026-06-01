const http = require("http");
const path = require("path");
const fs = require("fs");

const port = Number(process.env.PORT || 8787);
const reviews = [];
let downloadCount = 0;

function json(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function body(request) {
  return new Promise((resolve) => {
    let value = "";
    request.on("data", (chunk) => { value += chunk; });
    request.on("end", () => {
      try { resolve(JSON.parse(value || "{}")); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  if (request.method === "OPTIONS") return json(response, 204, {});
  if (request.method === "GET" && url.pathname === "/api/reviews") {
    return json(response, 200, { reviews: reviews.filter((item) => item.status === "approved").slice(0, 6) });
  }
  if (request.method === "POST" && url.pathname === "/api/reviews") {
    const payload = await body(request);
    if (!payload.nickname || !payload.content) return json(response, 400, { message: "请填写昵称和评价内容。" });
    reviews.unshift({
      id: String(Date.now()),
      nickname: String(payload.nickname).slice(0, 20),
      content: String(payload.content).slice(0, 100),
      status: "pending",
      createdAt: new Date().toISOString()
    });
    return json(response, 201, { ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/download/count") {
    return json(response, 200, { count: downloadCount });
  }
  if (request.method === "GET" && url.pathname === "/api/download/latest") {
    downloadCount += 1;
    response.writeHead(302, { Location: "/downloads/floating-profit-app-green-latest.zip" });
    return response.end();
  }
  if (request.method === "GET" && url.pathname === "/api/admin/reviews") {
    return json(response, 200, { reviews: reviews.filter((item) => item.status === (url.searchParams.get("status") || "pending")) });
  }
  const match = url.pathname.match(/^\/api\/admin\/reviews\/([^/]+)$/);
  if (request.method === "PATCH" && match) {
    const payload = await body(request);
    const review = reviews.find((item) => item.id === match[1]);
    if (review) review.status = payload.status === "approved" ? "approved" : "rejected";
    return json(response, 200, { ok: true });
  }

  const file = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
  if (file === "config.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    return response.end(`window.FLOATING_PROFIT_CONFIG={apiBaseUrl:"http://localhost:${port}",authGatewayUrl:"",fallbackDownloadUrl:"/downloads/floating-profit-app-green-latest.zip",baiduDownloadUrl:""};`);
  }
  const resolved = path.join(__dirname, "..", "docs", file);
  if (!resolved.startsWith(path.join(__dirname, "..", "docs")) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    response.writeHead(404);
    return response.end("Not found");
  }
  response.writeHead(200);
  fs.createReadStream(resolved).pipe(response);
});

server.listen(port, () => console.log(`mock api: http://localhost:${port}`));
