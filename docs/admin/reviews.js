(function () {
  const config = window.FLOATING_PROFIT_CONFIG || {};
  const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const authGatewayUrl = String(config.authGatewayUrl || "").replace(/\/$/, "");
  const loginPanel = document.getElementById("loginPanel");
  const reviewPanel = document.getElementById("reviewPanel");
  const emailInput = document.getElementById("emailInput");
  const codeInput = document.getElementById("codeInput");
  const sendCodeButton = document.getElementById("sendCodeButton");
  const verifyCodeButton = document.getElementById("verifyCodeButton");
  const logoutButton = document.getElementById("logoutButton");
  const loginNote = document.getElementById("loginNote");
  const adminReviewList = document.getElementById("adminReviewList");
  let verificationToken = "";
  let selectedStatus = "pending";

  function showNote(message) {
    loginNote.textContent = message;
  }

  async function readJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `请求失败：${response.status}`);
    return payload;
  }

  function accessToken() {
    return sessionStorage.getItem("floatingProfitAdminToken") || "";
  }

  function adminHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`
    };
  }

  async function sendCode() {
    if (!authGatewayUrl) throw new Error("请先配置 CloudBase 认证网关。");
    const email = emailInput.value.trim();
    if (!email) throw new Error("请输入管理员邮箱。");
    const payload = await readJson(`${authGatewayUrl}/auth/v1/verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, target: "USER" })
    });
    verificationToken = payload.verification_token;
    codeInput.classList.remove("hidden");
    verifyCodeButton.classList.remove("hidden");
    showNote("验证码已发送，请查看邮箱。");
  }

  async function verifyCode() {
    const email = emailInput.value.trim();
    const verificationCode = codeInput.value.trim();
    const verified = await readJson(`${authGatewayUrl}/auth/v1/verification/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verification_token: verificationToken,
        verification_code: verificationCode
      })
    });
    const loginOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, verification_token: verified.verification_token })
    };
    let signedIn;
    try {
      signedIn = await readJson(`${authGatewayUrl}/auth/v1/signin`, loginOptions);
    } catch {
      signedIn = await readJson(`${authGatewayUrl}/auth/v1/signup`, loginOptions);
    }
    sessionStorage.setItem("floatingProfitAdminToken", signedIn.access_token);
    await showReviews();
  }

  async function loadReviews() {
    const payload = await readJson(`${apiBaseUrl}/api/admin/reviews?status=${selectedStatus}`, {
      headers: adminHeaders()
    });
    adminReviewList.innerHTML = "";
    if (!payload.reviews.length) {
      adminReviewList.textContent = "暂无评价。";
      return;
    }
    payload.reviews.forEach((review) => {
      const card = document.createElement("article");
      card.className = "admin-review";
      card.innerHTML = `
        <div class="admin-meta"><strong></strong><span></span></div>
        <p></p>
        <div class="admin-actions"></div>
      `;
      card.querySelector("strong").textContent = review.nickname;
      card.querySelector("span").textContent = new Date(review.createdAt).toLocaleString("zh-CN");
      card.querySelector("p").textContent = review.content;
      const actions = card.querySelector(".admin-actions");
      if (review.status !== "approved") actions.append(createAction("通过", review.id, "approved"));
      if (review.status !== "rejected") actions.append(createAction("删除", review.id, "rejected"));
      adminReviewList.appendChild(card);
    });
  }

  function createAction(label, id, status) {
    const button = document.createElement("button");
    button.className = status === "approved" ? "primary" : "secondary";
    button.textContent = label;
    button.addEventListener("click", async () => {
      await readJson(`${apiBaseUrl}/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status })
      });
      await loadReviews();
    });
    return button;
  }

  async function showReviews() {
    if (!apiBaseUrl) throw new Error("请先配置 CloudBase API 地址。");
    await loadReviews();
    loginPanel.classList.add("hidden");
    reviewPanel.classList.remove("hidden");
    logoutButton.classList.remove("hidden");
  }

  sendCodeButton.addEventListener("click", () => sendCode().catch((error) => showNote(error.message)));
  verifyCodeButton.addEventListener("click", () => verifyCode().catch((error) => showNote(error.message)));
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("floatingProfitAdminToken");
    location.reload();
  });
  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("[data-status]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      selectedStatus = button.dataset.status;
      await loadReviews();
    });
  });

  if (accessToken()) showReviews().catch(() => sessionStorage.removeItem("floatingProfitAdminToken"));
})();
