const params = new URLSearchParams(location.search);
const duration = Number(params.get("duration") || 26);
const stage = document.querySelector(".stage");
const caption = document.getElementById("caption");
const input = document.getElementById("codeInput");
const note = document.getElementById("addNote");

const captions = [
  [0, 2, "看盘，不必一直打开交易软件。"],
  [2, 7, "大盘、自选股、实时涨跌，一眼看清。"],
  [7, 12, "折叠后，只留一只股票自动轮动。"],
  [12, 17, "输入六位 A 股代码，就能加入自选。"],
  [17, 21, "需要专注时，Alt + Q 一键隐藏。"],
  [21, 26, "浮盈 app，为盯盘做减法。评论区获取。"]
];

function renderAt(seconds) {
  stage.className = "stage";
  if (seconds >= 2) stage.classList.add("show-desktop");
  if (seconds >= 7 && seconds < 12) stage.classList.add("collapsed");
  if (seconds >= 12) stage.classList.add("adding");
  if (seconds >= 17 && seconds < 21) stage.classList.add("hidden-widget");
  if (seconds >= 21) stage.classList.add("show-outro");

  if (seconds >= 12 && seconds < 14) {
    input.textContent = "002594";
    note.textContent = "正在识别 002594...";
  } else if (seconds >= 14) {
    input.textContent = "输入代码 600519";
    note.textContent = "比亚迪 002594 已添加。";
  } else {
    input.textContent = "输入代码 600519";
    note.textContent = "支持 6 位 A 股代码。";
  }

  const current = captions.find(([start, end]) => seconds >= start && seconds < end);
  caption.textContent = current ? current[2] : "";
}

window.renderAt = renderAt;
renderAt(Math.min(duration, Number(params.get("time") || 0)));
