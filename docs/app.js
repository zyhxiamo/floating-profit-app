(function () {
  const config = window.FLOATING_PROFIT_CONFIG || {};
  const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const downloadButton = document.getElementById("downloadButton");
  const baiduDownloadButton = document.getElementById("baiduDownloadButton");
  const downloadCount = document.getElementById("downloadCount");
  const reviewList = document.getElementById("reviewList");

  downloadButton.href = apiBaseUrl
    ? `${apiBaseUrl}/api/download/latest`
    : config.fallbackDownloadUrl;

  if (config.baiduDownloadUrl) {
    baiduDownloadButton.href = config.baiduDownloadUrl;
    baiduDownloadButton.classList.remove("hidden");
  }

  async function readJson(path) {
    if (!apiBaseUrl) return null;
    const response = await fetch(`${apiBaseUrl}${path}`);
    if (!response.ok) throw new Error(`request failed: ${response.status}`);
    return response.json();
  }

  function renderReviews(reviews) {
    if (!Array.isArray(reviews) || !reviews.length) return;
    reviewList.innerHTML = "";
    reviews.slice(0, 6).forEach((review) => {
      const card = document.createElement("article");
      card.className = "testimonial-card";
      const quote = document.createElement("p");
      quote.textContent = review.content;
      const nickname = document.createElement("strong");
      nickname.textContent = review.nickname;
      card.append(quote, nickname);
      reviewList.appendChild(card);
    });
  }

  readJson("/api/download/count")
    .then((result) => {
      if (result && Number.isFinite(Number(result.count))) {
        downloadCount.textContent = `累计下载 ${Number(result.count)} 次`;
      }
    })
    .catch(() => {});

  readJson("/api/reviews")
    .then((result) => renderReviews(result?.reviews))
    .catch(() => {});
})();
