const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const command = db.command;
const REVIEWS = "reviews";
const METRICS = "metrics";
const DOWNLOAD_METRIC_ID = "downloads";

function response(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {};
  }
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function requestPath(event) {
  return String(event.path || event.rawPath || "/").replace(/\/+$/, "") || "/";
}

function requestMethod(event) {
  return String(event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase();
}

function authorization(event) {
  const headers = event.headers || {};
  return headers.authorization || headers.Authorization || "";
}

async function requireAdmin(event) {
  const authGatewayUrl = String(process.env.AUTH_GATEWAY_URL || "").replace(/\/$/, "");
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const token = authorization(event);
  if (!authGatewayUrl || !adminEmail || !token) throw new Error("unauthorized");
  const result = await fetch(`${authGatewayUrl}/auth/v1/user`, {
    headers: { Authorization: token }
  });
  if (!result.ok) throw new Error("unauthorized");
  const user = await result.json();
  if (String(user.email || "").toLowerCase() !== adminEmail) throw new Error("unauthorized");
}

async function publicReviews() {
  const result = await db.collection(REVIEWS)
    .where({ status: "approved" })
    .orderBy("reviewedAt", "desc")
    .limit(6)
    .get();
  return response(200, {
    reviews: result.data.map((review) => ({
      id: review._id,
      nickname: review.nickname,
      content: review.content
    }))
  });
}

async function submitReview(event) {
  const body = parseBody(event);
  const nickname = cleanText(body.nickname, 20);
  const content = cleanText(body.content, 100);
  if (!nickname || !content) return response(400, { message: "请填写昵称和评价内容。" });
  await db.collection(REVIEWS).add({
    nickname,
    content,
    status: "pending",
    createdAt: new Date(),
    reviewedAt: null
  });
  return response(201, { ok: true });
}

async function countDownloads() {
  try {
    const result = await db.collection(METRICS).doc(DOWNLOAD_METRIC_ID).get();
    return Number(result.data?.[0]?.count || 0);
  } catch {
    return 0;
  }
}

async function downloadCount() {
  return response(200, { count: await countDownloads() });
}

async function latestDownload() {
  const downloadUrl = process.env.DOWNLOAD_URL;
  if (!downloadUrl) return response(503, { message: "下载包正在准备中。" });
  try {
    await db.collection(METRICS).doc(DOWNLOAD_METRIC_ID).update({ count: command.inc(1) });
  } catch {
    await db.collection(METRICS).doc(DOWNLOAD_METRIC_ID).set({ count: 1 });
  }
  return response(302, "", { Location: downloadUrl });
}

async function adminReviews(event) {
  await requireAdmin(event);
  const status = cleanText(event.queryStringParameters?.status, 20) || "pending";
  const result = await db.collection(REVIEWS)
    .where({ status })
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return response(200, {
    reviews: result.data.map((review) => ({
      id: review._id,
      nickname: review.nickname,
      content: review.content,
      status: review.status,
      createdAt: review.createdAt,
      reviewedAt: review.reviewedAt
    }))
  });
}

async function updateReview(event, id) {
  await requireAdmin(event);
  const body = parseBody(event);
  const status = body.status === "approved" ? "approved" : "rejected";
  await db.collection(REVIEWS).doc(id).update({
    status,
    reviewedAt: new Date()
  });
  return response(200, { ok: true });
}

exports.main = async (event) => {
  const method = requestMethod(event);
  const path = requestPath(event);
  if (method === "OPTIONS") return response(204, "");
  try {
    if (method === "GET" && path.endsWith("/api/reviews")) return publicReviews();
    if (method === "POST" && path.endsWith("/api/reviews")) return submitReview(event);
    if (method === "GET" && path.endsWith("/api/download/count")) return downloadCount();
    if (method === "GET" && path.endsWith("/api/download/latest")) return latestDownload();
    if (method === "GET" && path.endsWith("/api/admin/reviews")) return adminReviews(event);
    const match = path.match(/\/api\/admin\/reviews\/([^/]+)$/);
    if (method === "PATCH" && match) return updateReview(event, match[1]);
    return response(404, { message: "Not found" });
  } catch (error) {
    if (error.message === "unauthorized") return response(401, { message: "管理员登录已失效。" });
    console.error(error);
    return response(500, { message: "服务暂时不可用，请稍后再试。" });
  }
};
