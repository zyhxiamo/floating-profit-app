const params = new URLSearchParams(location.search);
const duration = Number(params.get("duration") || 40);
const stage = document.querySelector(".stage");
const caption = document.getElementById("caption");
const input = document.getElementById("codeInput");
const note = document.getElementById("addNote");

const captions = [
  [0, 4, "盯盘，不一定要一直打开交易软件。"],
  [4, 10, "把自选股放在桌面边缘。"],
  [10, 17, "折叠后，只保留真正需要的信息。"],
  [17, 24, "大盘、自选股、涨跌，一眼看清。"],
  [24, 30, "输入 A 股代码，就能加入自选。"],
  [30, 35, "需要专注时，Alt + Q 一键隐藏。"],
  [35, 40, "浮盈 app，为盯盘做减法。评论区获取。"]
];

function renderAt(seconds) {
  stage.className = "stage";
  if (seconds >= 4) stage.classList.add("show-desktop");
  if (seconds >= 10 && seconds < 17) stage.classList.add("collapsed");
  if (seconds >= 24) stage.classList.add("adding");
  if (seconds >= 30 && seconds < 35) stage.classList.add("hidden-widget");
  if (seconds >= 35) stage.classList.add("show-outro");

  if (seconds >= 24 && seconds < 26) {
    input.textContent = "002594";
    note.textContent = "正在识别 002594...";
  } else if (seconds >= 26) {
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
