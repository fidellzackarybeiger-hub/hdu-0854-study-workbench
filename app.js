const STORAGE_KEY = "hdu0854-workbench-v1";

const SUBJECT_META = {
  "数学一": { className: "subject-math", key: "math" },
  "信号与系统": { className: "subject-signal", key: "signal" },
  "英语一": { className: "subject-english", key: "english" },
  "政治": { className: "subject-politics", key: "politics" },
  "复盘": { className: "subject-review", key: "review" }
};

const DEFAULT_TASKS = [
  { id: "formula", time: "07:00", subject: "信号与系统", title: "公式晨背", detail: "三大变换性质与常用公式", minutes: 30, done: false },
  { id: "calculus", time: "07:35", subject: "数学一", title: "张宇高数强化18讲", detail: "2倍速概念课，例题必须落笔", minutes: 150, done: false },
  { id: "math880", time: "10:15", subject: "数学一", title: "880 基础 + 综合篇", detail: "放弃拓展篇，错题只做标记", minutes: 110, done: false },
  { id: "probability", time: "14:00", subject: "数学一", title: "李良概率论", detail: "推进当前章节并完成配套题", minutes: 90, done: false },
  { id: "signal", time: "15:40", subject: "信号与系统", title: "三大变换核心攻坚", detail: "课后重点题动手计算", minutes: 150, done: false },
  { id: "words", time: "19:20", subject: "英语一", title: "单词二轮滚动", detail: "复习旧词并补充生词", minutes: 60, done: false },
  { id: "reading", time: "20:25", subject: "英语一", title: "阅读真题精做", detail: "2010-2020 阅读一刷", minutes: 100, done: false },
  { id: "review", time: "22:10", subject: "复盘", title: "固定复盘", detail: "只整理标记、原因与明日动作", minutes: 60, done: false }
];

const DEFAULT_STATE = {
  settings: {
    examDate: "2026-12-19",
    summerEnd: "2026-08-31",
    strengthEnd: "2026-08-21",
    sprintEnd: "2026-10-20",
    dailyTargetMinutes: 750,
    reviewMinutes: 60,
    scoreTotal: 330,
    scoreMath: 105,
    scoreEnglish: 55,
    scoreSignal: 120,
    scorePolitics: 60
  },
  progress: {
    math: 58,
    signal: 40,
    english: 35,
    politics: 0
  },
  ratio: {
    applicants: "",
    admitted: "",
    note: ""
  },
  daily: {},
  mistakeNotes: []
};

let state = loadState();
let timerInterval = null;
let timerTotal = 50 * 60;
let timerRemaining = timerTotal;
let timerRunning = false;
let deferredInstallPrompt = null;
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeState(saved) {
  return {
    ...deepClone(DEFAULT_STATE),
    ...saved,
    settings: { ...DEFAULT_STATE.settings, ...(saved?.settings || {}) },
    progress: { ...DEFAULT_STATE.progress, ...(saved?.progress || {}) },
    ratio: { ...DEFAULT_STATE.ratio, ...(saved?.ratio || {}) },
    daily: saved?.daily || {},
    mistakeNotes: Array.isArray(saved?.mistakeNotes) ? saved.mistakeNotes : []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return mergeState(saved);
  } catch {
    return deepClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function inclusiveDaysUntil(dateString) {
  const target = parseLocalDate(dateString);
  const diff = Math.floor((target - startOfToday()) / 86400000) + 1;
  return Math.max(0, diff);
}

function getDaily(dateKey = localDateKey()) {
  if (!state.daily[dateKey]) {
    state.daily[dateKey] = {
      studyMinutes: 0,
      words: 0,
      mistakes: 0,
      mathProblems: 0,
      signalProblems: 0,
      tasks: deepClone(DEFAULT_TASKS)
    };
    saveState();
  }
  return state.daily[dateKey];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatHours(minutes) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} 小时` : `${hours.toFixed(1)} 小时`;
}

function formatDateLabel(date = new Date()) {
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

function renderIcons() {
  if (window.lucide) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
}

function renderCountdown() {
  const settings = state.settings;
  const examDays = inclusiveDaysUntil(settings.examDate);
  const cards = [
    ["summer-days", "summer-track", settings.summerEnd, "2026-07-26"],
    ["strength-days", "strength-track", settings.strengthEnd, "2026-07-26"],
    ["sprint-days", "sprint-track", settings.sprintEnd, "2026-07-26"],
    ["exam-days-small", "exam-track", settings.examDate, "2026-07-26"]
  ];

  $("#exam-days").textContent = examDays;
  $("#exam-days-small").innerHTML = `${examDays}<small>天</small>`;
  $("#exam-date-label").textContent = settings.examDate.replaceAll("-", ".");

  cards.forEach(([numberId, trackId, endDate, startDate]) => {
    const remaining = inclusiveDaysUntil(endDate);
    const total = Math.max(1, Math.floor((parseLocalDate(endDate) - parseLocalDate(startDate)) / 86400000) + 1);
    const progress = clamp(((total - remaining) / total) * 100, 0, 100);
    $(`#${numberId}`).innerHTML = `${remaining}<small>天</small>`;
    $(`#${trackId}`).style.width = `${progress}%`;
  });
}

function renderToday() {
  const daily = getDaily();
  const completed = daily.tasks.filter((task) => task.done).length;
  const completionRate = daily.tasks.length ? Math.round((completed / daily.tasks.length) * 100) : 0;
  const studyRate = clamp((daily.studyMinutes / state.settings.dailyTargetMinutes) * 100, 0, 100);

  $("#today-label").textContent = formatDateLabel();
  $("#study-minutes").textContent = daily.studyMinutes;
  $("#word-count").textContent = daily.words;
  $("#mistake-count").textContent = daily.mistakes;
  $("#completion-rate").textContent = completionRate;
  $("#study-progress").style.width = `${studyRate}%`;
  $("#completion-progress").style.width = `${completionRate}%`;
  $("#daily-target-label").textContent = formatHours(state.settings.dailyTargetMinutes);
  $("#review-target-label").textContent = formatHours(state.settings.reviewMinutes);
  renderTasks();
  renderWeeklyChart();
}

function renderTasks() {
  const daily = getDaily();
  const list = $("#task-list");
  $("#task-empty").classList.toggle("hidden", daily.tasks.length > 0);
  list.innerHTML = daily.tasks
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((task) => {
      const meta = SUBJECT_META[task.subject] || SUBJECT_META["复盘"];
      return `
        <div class="task-row ${task.done ? "done" : ""}" data-task-id="${escapeHtml(task.id)}">
          <label class="task-check">
            <input type="checkbox" ${task.done ? "checked" : ""} aria-label="完成${escapeHtml(task.title)}">
            <span><i data-lucide="check"></i></span>
          </label>
          <span class="task-time">${escapeHtml(task.time)}</span>
          <div class="task-main">
            <strong>${escapeHtml(task.title)}</strong>
            <small>${escapeHtml(task.detail)} · ${Number(task.minutes)}分钟</small>
          </div>
          <span class="subject-chip ${meta.className}">${escapeHtml(task.subject)}</span>
          <button class="task-delete" aria-label="删除${escapeHtml(task.title)}" title="删除任务">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
    })
    .join("");

  $$(".task-row", list).forEach((row) => {
    const id = row.dataset.taskId;
    $("input", row).addEventListener("change", (event) => {
      const task = getDaily().tasks.find((item) => item.id === id);
      if (!task) return;
      task.done = event.target.checked;
      saveState();
      renderToday();
      renderIcons();
    });
    $(".task-delete", row).addEventListener("click", () => {
      const task = getDaily().tasks.find((item) => item.id === id);
      if (!task || !confirm(`删除任务“${task.title}”？`)) return;
      getDaily().tasks = getDaily().tasks.filter((item) => item.id !== id);
      saveState();
      renderToday();
      renderIcons();
      showToast("任务已删除");
    });
  });
  renderIcons();
}

function renderWeeklyChart() {
  const chart = $("#weekly-chart");
  const today = startOfToday();
  const days = [];
  let total = 0;

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = localDateKey(date);
    const minutes = state.daily[key]?.studyMinutes || 0;
    total += minutes;
    days.push({
      key,
      label: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()],
      minutes,
      isToday: offset === 0
    });
  }

  const target = state.settings.dailyTargetMinutes;
  chart.innerHTML = days.map((day) => {
    const height = day.minutes === 0 ? 2 : clamp((day.minutes / target) * 100, 4, 100);
    return `
      <div class="chart-bar ${day.isToday ? "today" : ""}" title="${day.minutes} 分钟">
        <small>${day.minutes ? (day.minutes / 60).toFixed(1) : "0"}</small>
        <i style="height:${height}%"></i>
        <b>周${day.label}</b>
      </div>
    `;
  }).join("");
  $("#weekly-total").textContent = `${(total / 60).toFixed(1)} 小时`;
}

function renderProgress() {
  Object.entries(state.progress).forEach(([key, value]) => {
    const safeValue = clamp(Number(value) || 0, 0, 100);
    $(`#${key}-progress`).style.width = `${safeValue}%`;
    $(`#${key}-progress-label`).textContent = `${safeValue}%`;
  });
}

function updateSummerPhase() {
  const today = startOfToday();
  const phases = [
    { start: "2026-07-26", end: "2026-08-10", label: "第一阶段进行中" },
    { start: "2026-08-11", end: "2026-08-25", label: "第二阶段进行中" },
    { start: "2026-08-26", end: "2026-08-31", label: "第三阶段进行中" }
  ];
  const blocks = $$(".phase-block");
  let activeIndex = -1;

  phases.forEach((phase, index) => {
    if (today >= parseLocalDate(phase.start) && today <= parseLocalDate(phase.end)) activeIndex = index;
  });

  blocks.forEach((block, index) => {
    block.classList.toggle("current", index === activeIndex);
    $(".phase-state", block).textContent =
      index < activeIndex || today > parseLocalDate(phases[index].end)
        ? "已完成"
        : index === activeIndex
          ? "当前"
          : "待执行";
  });

  const pill = $("#current-phase-pill");
  if (activeIndex >= 0) {
    pill.textContent = phases[activeIndex].label;
  } else if (today < parseLocalDate(phases[0].start)) {
    pill.textContent = "计划尚未开始";
  } else {
    pill.textContent = "暑假计划已结束";
  }
}

function renderAll() {
  renderCountdown();
  renderToday();
  renderProgress();
  updateSummerPhase();
  renderIcons();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function showDialog({ kicker = "工作台", title, content, actions = "" }) {
  $("#dialog-kicker").textContent = kicker;
  $("#dialog-title").textContent = title;
  $("#dialog-content").innerHTML = content;
  $("#dialog-actions").innerHTML = actions;
  $("#app-dialog").showModal();
  renderIcons();
}

function closeDialog() {
  $("#app-dialog").close();
}

function openAddTaskDialog() {
  showDialog({
    kicker: "今日执行",
    title: "新增学习任务",
    content: `
      <div class="form-grid">
        <div class="form-field">
          <label for="task-time-input">开始时间</label>
          <input id="task-time-input" type="time" value="14:00">
        </div>
        <div class="form-field">
          <label for="task-minutes-input">计划分钟</label>
          <input id="task-minutes-input" type="number" min="5" max="360" step="5" value="60">
        </div>
        <div class="form-field full">
          <label for="task-subject-input">科目</label>
          <select id="task-subject-input">
            ${Object.keys(SUBJECT_META).map((subject) => `<option>${subject}</option>`).join("")}
          </select>
        </div>
        <div class="form-field full">
          <label for="task-title-input">任务名称</label>
          <input id="task-title-input" type="text" maxlength="40" placeholder="例如：880 综合篇第3章">
        </div>
        <div class="form-field full">
          <label for="task-detail-input">执行标准</label>
          <input id="task-detail-input" type="text" maxlength="80" placeholder="例如：做20题，错题只标记">
        </div>
      </div>
    `,
    actions: `
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-task-button">添加任务</button>
    `
  });

  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-task-button").addEventListener("click", () => {
    const title = $("#task-title-input").value.trim();
    const detail = $("#task-detail-input").value.trim();
    const minutes = clamp(Number($("#task-minutes-input").value) || 0, 5, 360);
    if (!title) {
      showToast("请填写任务名称");
      return;
    }
    getDaily().tasks.push({
      id: `task-${Date.now()}`,
      time: $("#task-time-input").value || "14:00",
      subject: $("#task-subject-input").value,
      title,
      detail: detail || "按计划完成并记录结果",
      minutes,
      done: false
    });
    saveState();
    closeDialog();
    renderToday();
    showToast("任务已添加到今日计划");
  });
}

function openSettingsDialog() {
  const s = state.settings;
  showDialog({
    kicker: "全局配置",
    title: "工作台设置",
    content: `
      <div class="dialog-section">
        <h3>考试与阶段日期</h3>
        <div class="form-grid">
          <div class="form-field">
            <label for="setting-exam">初试日期</label>
            <input id="setting-exam" type="date" value="${escapeHtml(s.examDate)}">
          </div>
          <div class="form-field">
            <label for="setting-summer">暑假黄金期截止</label>
            <input id="setting-summer" type="date" value="${escapeHtml(s.summerEnd)}">
          </div>
          <div class="form-field">
            <label for="setting-strength">强化阶段节点</label>
            <input id="setting-strength" type="date" value="${escapeHtml(s.strengthEnd)}">
          </div>
          <div class="form-field">
            <label for="setting-sprint">冲刺阶段节点</label>
            <input id="setting-sprint" type="date" value="${escapeHtml(s.sprintEnd)}">
          </div>
        </div>
      </div>
      <div class="dialog-section">
        <h3>每日时间基准</h3>
        <div class="form-grid">
          <div class="form-field">
            <label for="setting-daily">净学习分钟</label>
            <input id="setting-daily" type="number" min="60" max="1000" step="10" value="${s.dailyTargetMinutes}">
          </div>
          <div class="form-field">
            <label for="setting-review">固定复盘分钟</label>
            <input id="setting-review" type="number" min="10" max="180" step="10" value="${s.reviewMinutes}">
          </div>
        </div>
      </div>
      <div class="dialog-section">
        <h3>分数目标</h3>
        <div class="form-grid">
          <div class="form-field"><label for="score-total">总分底线</label><input id="score-total" type="number" value="${s.scoreTotal}"></div>
          <div class="form-field"><label for="score-math">数学一</label><input id="score-math" type="number" value="${s.scoreMath}"></div>
          <div class="form-field"><label for="score-english">英语一</label><input id="score-english" type="number" value="${s.scoreEnglish}"></div>
          <div class="form-field"><label for="score-signal">专业课843</label><input id="score-signal" type="number" value="${s.scoreSignal}"></div>
          <div class="form-field"><label for="score-politics">政治</label><input id="score-politics" type="number" value="${s.scorePolitics}"></div>
        </div>
        <p class="form-help">当前单科目标合计 340 分，比 330 分总目标多 10 分，用作科目波动缓冲。</p>
      </div>
    `,
    actions: `
      <button type="button" class="danger-button" id="reset-data-button">恢复初始数据</button>
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-settings-button">保存设置</button>
    `
  });

  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-settings-button").addEventListener("click", () => {
    state.settings = {
      examDate: $("#setting-exam").value,
      summerEnd: $("#setting-summer").value,
      strengthEnd: $("#setting-strength").value,
      sprintEnd: $("#setting-sprint").value,
      dailyTargetMinutes: clamp(Number($("#setting-daily").value), 60, 1000),
      reviewMinutes: clamp(Number($("#setting-review").value), 10, 180),
      scoreTotal: Number($("#score-total").value) || 330,
      scoreMath: Number($("#score-math").value) || 105,
      scoreEnglish: Number($("#score-english").value) || 55,
      scoreSignal: Number($("#score-signal").value) || 120,
      scorePolitics: Number($("#score-politics").value) || 60
    };
    saveState();
    closeDialog();
    renderAll();
    showToast("设置已保存");
  });
  $("#reset-data-button").addEventListener("click", () => {
    if (!confirm("恢复初始数据会清除当前浏览器中的任务和学习记录，确定继续？")) return;
    state = deepClone(DEFAULT_STATE);
    saveState();
    closeDialog();
    renderAll();
    showToast("已恢复初始数据");
  });
}

function openScoresDialog() {
  const s = state.settings;
  const sum = s.scoreMath + s.scoreEnglish + s.scoreSignal + s.scorePolitics;
  showDialog({
    kicker: "目标拆分",
    title: "初试分数目标",
    content: `
      <div class="score-list">
        <div class="score-row"><span>数学一<small>主拉分科目</small></span><strong>${s.scoreMath}+</strong></div>
        <div class="score-row"><span>英语一<small>阅读与单词保底</small></span><strong>${s.scoreEnglish}+</strong></div>
        <div class="score-row"><span>843 信号与系统<small>专业课核心优势</small></span><strong>${s.scoreSignal}+</strong></div>
        <div class="score-row"><span>政治<small>选择题优先，大题延后</small></span><strong>${s.scorePolitics}+</strong></div>
      </div>
      <div class="callout" style="margin-top:12px">
        单科目标合计 <b>${sum}</b> 分，相对总分底线 ${s.scoreTotal} 分保留 <b>${sum - s.scoreTotal}</b> 分缓冲。
      </div>
    `,
    actions: `<button type="button" class="primary-button" data-dialog-close>知道了</button>`
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
}

function openRatioDialog() {
  const ratio = state.ratio;
  const result = ratio.applicants && ratio.admitted
    ? `${ratio.applicants} ÷ ${ratio.admitted} = ${(ratio.applicants / ratio.admitted).toFixed(1)} : 1`
    : "录入报考与录取人数后自动计算";
  showDialog({
    kicker: "院校信息",
    title: "报录比数据记录",
    content: `
      <div class="form-grid">
        <div class="form-field">
          <label for="ratio-applicants">报考人数</label>
          <input id="ratio-applicants" type="number" min="0" value="${escapeHtml(ratio.applicants)}" placeholder="待录入">
        </div>
        <div class="form-field">
          <label for="ratio-admitted">录取人数</label>
          <input id="ratio-admitted" type="number" min="1" value="${escapeHtml(ratio.admitted)}" placeholder="待录入">
        </div>
        <div class="form-field full">
          <label for="ratio-note">数据来源或备注</label>
          <input id="ratio-note" type="text" value="${escapeHtml(ratio.note)}" placeholder="建议记录官方公示年份与口径">
        </div>
      </div>
      <div class="ratio-result" style="margin-top:12px">${result}</div>
      <p class="form-help">报录比口径容易混入推免、调剂或不同方向人数，工作台只保存你核验后的数据，不自动填入未经确认的信息。</p>
    `,
    actions: `
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-ratio-button">保存记录</button>
    `
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-ratio-button").addEventListener("click", () => {
    state.ratio = {
      applicants: $("#ratio-applicants").value,
      admitted: $("#ratio-admitted").value,
      note: $("#ratio-note").value.trim()
    };
    saveState();
    closeDialog();
    showToast("报录比记录已保存");
  });
}

const MODULES = {
  math: {
    title: "数学一刷题",
    kicker: "强化主线",
    key: "math",
    rows: [
      ["张宇高数强化18讲", "2倍速概念课，1.5倍速例题课"],
      ["李良概率论", "推进章节并完成配套计算"],
      ["880题", "仅做基础篇与综合篇，放弃拓展篇"],
      ["错题处理", "只标记原因，不誊抄错题本"]
    ]
  },
  signal: {
    title: "843 信号与系统",
    kicker: "专业课主线",
    key: "signal",
    rows: [
      ["三大变换", "傅里叶、拉普拉斯、Z变换优先"],
      ["公式晨背", "每日30分钟，性质与常用对照"],
      ["课后重点题", "完成一刷后安排二刷"],
      ["早年真题", "8月末进入超前试跑"]
    ]
  },
  english: {
    title: "英语一",
    kicker: "持续输入",
    key: "english",
    rows: [
      ["阅读真题", "2010-2020 一刷，重逻辑与定位"],
      ["单词二轮", "滚动复习，记录今日背诵量"],
      ["小三门", "当前延后，不抢阅读主线时间"],
      ["复盘方式", "归因句法、词义或定位偏差"]
    ]
  },
  politics: {
    title: "政治刷题",
    kicker: "8月中旬启动",
    key: "politics",
    rows: [
      ["启动时间", "2026年8月15日前后"],
      ["当前范围", "只刷选择题"],
      ["大题安排", "现阶段延后"],
      ["时间原则", "不挤占数学和专业课主线"]
    ]
  }
};

function openModuleDialog(moduleKey) {
  const module = MODULES[moduleKey];
  const current = state.progress[module.key];
  const politicsCallout = moduleKey === "politics"
    ? `<div class="callout amber-callout" style="margin-bottom:12px">政治按计划在 8 月中旬启动。现在无需用大块时间提前挤占数学和专业课。</div>`
    : "";
  showDialog({
    kicker: module.kicker,
    title: module.title,
    content: `
      ${politicsCallout}
      <div class="module-list">
        ${module.rows.map(([title, detail]) => `
          <div class="module-row">
            <span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span>
            <i data-lucide="chevron-right"></i>
          </div>
        `).join("")}
      </div>
      <div class="form-field" style="margin-top:16px">
        <label for="module-progress-input">当前阶段完成度：<b id="module-progress-value">${current}%</b></label>
        <input id="module-progress-input" type="range" min="0" max="100" step="1" value="${current}" style="width:100%">
      </div>
    `,
    actions: `
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-module-button">保存进度</button>
    `
  });
  const slider = $("#module-progress-input");
  slider.addEventListener("input", () => {
    $("#module-progress-value").textContent = `${slider.value}%`;
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-module-button").addEventListener("click", () => {
    state.progress[module.key] = Number(slider.value);
    saveState();
    closeDialog();
    renderProgress();
    showToast(`${module.title}进度已更新`);
  });
}

function openMistakesDialog() {
  showDialog({
    kicker: "复盘系统",
    title: "错题标记",
    content: `
      <div class="callout amber-callout" style="margin-bottom:14px">执行规则：不誊抄整题，只记录题源、错误原因和下一次动作。</div>
      <div class="form-grid">
        <div class="form-field">
          <label for="mistake-subject-input">科目</label>
          <select id="mistake-subject-input">
            <option>数学一</option><option>信号与系统</option><option>英语一</option><option>政治</option>
          </select>
        </div>
        <div class="form-field">
          <label for="mistake-source-input">题源</label>
          <input id="mistake-source-input" type="text" placeholder="例如：880 P126-18">
        </div>
        <div class="form-field full">
          <label for="mistake-reason-input">错误原因与下次动作</label>
          <input id="mistake-reason-input" type="text" placeholder="例如：忽略定义域；明早重算">
        </div>
      </div>
      <button type="button" class="icon-text-button" id="add-mistake-note" style="margin:12px 0 14px">
        <i data-lucide="plus"></i><span>添加标记</span>
      </button>
      <div class="mistake-list" id="mistake-note-list">
        ${renderMistakeNotesHtml()}
      </div>
    `,
    actions: `<button type="button" class="primary-button" data-dialog-close>完成</button>`
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#add-mistake-note").addEventListener("click", () => {
    const source = $("#mistake-source-input").value.trim();
    const reason = $("#mistake-reason-input").value.trim();
    if (!source || !reason) {
      showToast("请填写题源和错误原因");
      return;
    }
    state.mistakeNotes.unshift({
      id: `mistake-${Date.now()}`,
      subject: $("#mistake-subject-input").value,
      source,
      reason,
      date: localDateKey()
    });
    getDaily().mistakes += 1;
    saveState();
    $("#mistake-note-list").innerHTML = renderMistakeNotesHtml();
    bindMistakeDeleteButtons();
    renderToday();
    renderIcons();
    $("#mistake-source-input").value = "";
    $("#mistake-reason-input").value = "";
  });
  bindMistakeDeleteButtons();
}

function renderMistakeNotesHtml() {
  if (!state.mistakeNotes.length) {
    return `<div class="empty-state"><i data-lucide="notebook-tabs"></i><p>还没有错题标记。</p></div>`;
  }
  return state.mistakeNotes.slice(0, 20).map((note) => `
    <div class="mistake-row" data-note-id="${escapeHtml(note.id)}">
      <span><b>${escapeHtml(note.subject)} · ${escapeHtml(note.source)}</b><small>${escapeHtml(note.reason)} · ${escapeHtml(note.date)}</small></span>
      <button type="button" class="task-delete" title="删除标记"><i data-lucide="trash-2"></i></button>
    </div>
  `).join("");
}

function bindMistakeDeleteButtons() {
  $$(".mistake-row").forEach((row) => {
    $(".task-delete", row).addEventListener("click", () => {
      state.mistakeNotes = state.mistakeNotes.filter((note) => note.id !== row.dataset.noteId);
      saveState();
      $("#mistake-note-list").innerHTML = renderMistakeNotesHtml();
      bindMistakeDeleteButtons();
      renderIcons();
    });
  });
}

function openManualLogDialog() {
  const daily = getDaily();
  showDialog({
    kicker: "数据复盘",
    title: "补录今日数据",
    content: `
      <div class="form-grid">
        <div class="form-field">
          <label for="log-minutes">净学习分钟</label>
          <input id="log-minutes" type="number" min="0" max="1440" value="${daily.studyMinutes}">
        </div>
        <div class="form-field">
          <label for="log-words">单词背诵量</label>
          <input id="log-words" type="number" min="0" value="${daily.words}">
        </div>
        <div class="form-field">
          <label for="log-mistakes">新增错题数</label>
          <input id="log-mistakes" type="number" min="0" value="${daily.mistakes}">
        </div>
        <div class="form-field">
          <label for="log-math">数学刷题量</label>
          <input id="log-math" type="number" min="0" value="${daily.mathProblems}">
        </div>
        <div class="form-field">
          <label for="log-signal">专业课刷题量</label>
          <input id="log-signal" type="number" min="0" value="${daily.signalProblems}">
        </div>
      </div>
      <p class="form-help">番茄钟完成后会自动累计学习时长；这里用于补录线下学习记录。</p>
    `,
    actions: `
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-log-button">保存数据</button>
    `
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-log-button").addEventListener("click", () => {
    daily.studyMinutes = clamp(Number($("#log-minutes").value) || 0, 0, 1440);
    daily.words = Math.max(0, Number($("#log-words").value) || 0);
    daily.mistakes = Math.max(0, Number($("#log-mistakes").value) || 0);
    daily.mathProblems = Math.max(0, Number($("#log-math").value) || 0);
    daily.signalProblems = Math.max(0, Number($("#log-signal").value) || 0);
    saveState();
    closeDialog();
    renderToday();
    showToast("今日数据已更新");
  });
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;
  $("#timer-display").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progress = ((timerTotal - timerRemaining) / timerTotal) * 100;
  $("#timer-ring").style.setProperty("--timer-progress", `${progress}%`);
  $("#timer-status").textContent = timerRunning ? `${$("#timer-subject").value}专注中` : "准备开始";
  $("#timer-toggle").innerHTML = timerRunning
    ? `<i data-lucide="pause"></i><span>暂停计时</span>`
    : `<i data-lucide="play"></i><span>${timerRemaining < timerTotal ? "继续专注" : "开始专注"}</span>`;
  renderIcons();
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    updateTimerDisplay();
    return;
  }

  timerRunning = true;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerRemaining -= 1;
    if (timerRemaining <= 0) {
      completeTimer();
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function completeTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRemaining = 0;
  updateTimerDisplay();
  const minutes = Math.round(timerTotal / 60);
  if (minutes !== 10) {
    getDaily().studyMinutes += minutes;
    saveState();
    renderToday();
    showToast(`完成 ${minutes} 分钟${$("#timer-subject").value}专注，已计入今日时长`);
  } else {
    showToast("休息结束，可以进入下一轮专注");
  }
  setTimeout(() => resetTimer(minutes), 800);
}

function resetTimer(minutes) {
  clearInterval(timerInterval);
  timerRunning = false;
  const selected = minutes || Number($("#timer-mode button.active").dataset.minutes);
  timerTotal = selected * 60;
  timerRemaining = timerTotal;
  updateTimerDisplay();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `杭电0854考研工作台备份-${localDateKey()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("本机数据已导出");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object") throw new Error("invalid");
      state = mergeState(parsed);
      saveState();
      renderAll();
      showToast("备份数据已导入");
    } catch {
      showToast("导入失败：文件格式不正确");
    }
  };
  reader.readAsText(file, "utf-8");
}

function bindNavigation() {
  $$("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.scroll);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      $$("[data-scroll]").forEach((item) => item.classList.remove("active"));
      $$(`[data-scroll="${button.dataset.scroll}"]`).forEach((item) => item.classList.add("active"));
    });
  });
}

function bindQuickActions() {
  $$("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "plan") {
        $("#today-plan").scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "timer") {
        $("#focus-panel").scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (action === "overview") {
        $("#progress-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "mistakes") {
        openMistakesDialog();
      } else if (action === "scores") {
        openScoresDialog();
      } else if (action === "ratio") {
        openRatioDialog();
      } else if (MODULES[action]) {
        openModuleDialog(action);
      }
    });
  });
}

function bindEvents() {
  bindNavigation();
  bindQuickActions();

  $("#settings-button").addEventListener("click", openSettingsDialog);
  $("#mobile-settings-button").addEventListener("click", openSettingsDialog);
  $("#add-task-button").addEventListener("click", openAddTaskDialog);
  $("#manual-log-button").addEventListener("click", openManualLogDialog);
  $("#export-button").addEventListener("click", exportData);
  $("#import-input").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importData(file);
    event.target.value = "";
  });

  $$(".stepper").forEach((stepper) => {
    const [minus, plus] = $$("button", stepper);
    const field = stepper.dataset.field;
    minus.addEventListener("click", () => {
      const daily = getDaily();
      daily[field] = Math.max(0, daily[field] - (field === "words" ? 20 : 1));
      saveState();
      renderToday();
    });
    plus.addEventListener("click", () => {
      const daily = getDaily();
      daily[field] += field === "words" ? 20 : 1;
      saveState();
      renderToday();
    });
  });

  $$("#timer-mode button").forEach((button) => {
    button.addEventListener("click", () => {
      if (timerRunning && !confirm("切换模式会重置当前计时，确定继续？")) return;
      $$("#timer-mode button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      resetTimer(Number(button.dataset.minutes));
    });
  });

  $("#timer-toggle").addEventListener("click", toggleTimer);
  $("#reset-timer-button").addEventListener("click", () => resetTimer());

  $("#app-dialog").addEventListener("click", (event) => {
    if (event.target === $("#app-dialog")) closeDialog();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("#install-button").classList.remove("hidden");
  });

  $("#install-button").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#install-button").classList.add("hidden");
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      showToast("离线缓存注册失败，不影响本机数据保存");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  bindEvents();
  updateTimerDisplay();
  registerServiceWorker();
});
