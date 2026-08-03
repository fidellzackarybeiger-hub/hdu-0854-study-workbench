const STORAGE_KEY = "hdu0854-workbench-v1";
const REVIEW_INTERVALS = [1, 3, 7, 14];
const DATA_VERSION = 4;
const THEME_COLORS = { blue: "#24313d", graphite: "#24272a", coral: "#332727", teal: "#203033", green: "#1f2923" };

const SUBJECT_META = {
  "数学一": { className: "subject-math", key: "math" },
  "信号与系统": { className: "subject-signal", key: "signal" },
  "英语一": { className: "subject-english", key: "english" },
  "政治": { className: "subject-politics", key: "politics" },
  "复盘": { className: "subject-review", key: "review" }
};

const DEFAULT_TASKS = [
  { id: "formula", block: "morning", subject: "信号与系统", title: "公式晨背", detail: "三大变换性质与常用公式", minimumMinutes: 20, standardMinutes: 30, priority: "required", topicLevel: "重点大题", eyeLoad: "low", done: false },
  { id: "calculus", block: "morning", subject: "数学一", title: "高数强化与刷题", detail: "概念课加速听，例题和计算必须落笔", minimumMinutes: 90, standardMinutes: 150, priority: "required", minimumRequired: true, topicLevel: "必拿分", eyeLoad: "medium", done: false },
  { id: "math880", block: "morning", subject: "数学一", title: "880 基础 + 综合篇", detail: "基础必做，拔高选做，放弃拓展篇", minimumMinutes: 90, standardMinutes: 110, priority: "required", topicLevel: "基础", eyeLoad: "high", done: false },
  { id: "probability", block: "morning", subject: "数学一", title: "概率论", detail: "推进当前章节并完成配套题", minimumMinutes: 60, standardMinutes: 90, priority: "required", topicLevel: "必拿分", eyeLoad: "high", done: false },
  { id: "signal", block: "afternoon", subject: "信号与系统", title: "三大变换核心攻坚", detail: "新知识学习后独立完成课后重点题", minimumMinutes: 120, standardMinutes: 150, priority: "required", minimumRequired: true, topicLevel: "重点大题", eyeLoad: "high", done: false },
  { id: "optional-review", block: "afternoon", subject: "复盘", title: "错题二刷 / 额外刷题", detail: "状态良好且保底任务顺利时再执行", minimumMinutes: 30, standardMinutes: 60, priority: "optional", topicLevel: "进阶", eyeLoad: "high", done: false },
  { id: "eye-noon", block: "afternoon", subject: "复盘", title: "午睡前眼部护理", detail: "温敷 + 睑板腺按摩，不计学习时长", minimumMinutes: 10, standardMinutes: 10, priority: "required", eyeLoad: "low", kind: "care", done: false },
  { id: "words", block: "evening", subject: "英语一", title: "单词二轮滚动", detail: "复习旧词并补充生词", minimumMinutes: 40, standardMinutes: 60, priority: "required", minimumRequired: true, topicLevel: "核心优先", eyeLoad: "low", done: false },
  { id: "reading", block: "evening", subject: "英语一", title: "阅读真题精做", detail: "2010-2020 阅读一刷并记录正确率", minimumMinutes: 70, standardMinutes: 100, priority: "required", topicLevel: "核心优先", eyeLoad: "high", done: false },
  { id: "review", block: "evening", subject: "复盘", title: "当日复盘", detail: "只整理标记、原因与明日动作", minimumMinutes: 40, standardMinutes: 60, priority: "required", topicLevel: "闭环", eyeLoad: "medium", done: false },
  { id: "eye-night", block: "evening", subject: "复盘", title: "睡前眼部护理", detail: "温敷 + 睑板腺按摩，不计学习时长", minimumMinutes: 10, standardMinutes: 10, priority: "required", eyeLoad: "low", kind: "care", done: false }
];

const DEFAULT_STATE = {
  version: DATA_VERSION,
  settings: {
    examDate: "2026-12-19",
    summerEnd: "2026-08-31",
    strengthEnd: "2026-08-21",
    sprintEnd: "2026-10-20",
    dailyTargetMinutes: 750,
    reviewMinutes: 60,
    bufferMinutes: 15,
    politicsStartDate: "2026-08-15",
    scoreTotal: 360,
    scoreMath: 120,
    scoreEnglish: 65,
    scoreSignal: 120,
    scorePolitics: 65,
    customFocusMinutes: 50,
    theme: "blue",
    wakeStartDate: "2026-08-02",
    wakeCurrent: "08:00",
    wakeTarget: "07:00",
    wakeTransitionDays: 10,
    lastBackupDate: ""
  },
  progress: {
    math: 58,
    signal: 40,
    english: 35,
    politics: 0
  },
  progressDetails: {},
  stageQuality: {
    stage1: { value: 0, target: 70, unit: "%" },
    stage2: { value: 0, target: 80, unit: "%" },
    stage3: { value: 0, target: "", unit: "分" }
  },
  ratio: {
    applicants: "",
    admitted: "",
    note: ""
  },
  daily: {},
  mistakeNotes: [],
  weeklyReviews: {}
};

let state = loadState();
applyTheme(state.settings.theme);
const initialFocusMinutes = clamp(Number(state.settings.customFocusMinutes) || 50, 1, 720);
let timerInterval = null;
let timerTotal = initialFocusMinutes * 60;
let timerRemaining = timerTotal;
let timerRunning = false;
let timerIsBreak = false;
let deferredInstallPrompt = null;
let toastTimer = null;
let mobilePagesReady = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function inferTaskBlock(task = {}) {
  if (["morning", "afternoon", "evening"].includes(task.block)) return task.block;
  const hour = Number(String(task.time || "19:00").split(":")[0]);
  if (hour < 13) return "morning";
  if (hour < 19) return "afternoon";
  return "evening";
}

function normalizeTask(task) {
  const preset = DEFAULT_TASKS.find((item) => item.id === task?.id) || {};
  const standardMinutes = Math.max(5, Number(task?.standardMinutes ?? task?.minutes ?? preset.standardMinutes ?? preset.minimumMinutes) || 60);
  const minimumMinutes = clamp(Number(task?.minimumMinutes ?? preset.minimumMinutes ?? Math.round(standardMinutes * 0.75)) || 5, 5, standardMinutes);
  const done = Boolean(task?.done);
  return {
    ...preset,
    ...task,
    block: inferTaskBlock({ ...preset, ...task }),
    minimumMinutes,
    standardMinutes,
    actualMinutes: Math.max(0, Number(task?.actualMinutes) || (done ? minimumMinutes : 0)),
    attempted: Math.max(0, Number(task?.attempted) || 0),
    correct: Math.max(0, Number(task?.correct) || 0),
    mastery: clamp(Number(task?.mastery) || 0, 0, 100),
    topicLevel: task?.topicLevel || preset.topicLevel || (task?.priority === "optional" ? "进阶" : "基础"),
    minimumRequired: Boolean(task?.minimumRequired ?? preset.minimumRequired),
    priority: task?.priority || preset.priority || "required",
    eyeLoad: task?.eyeLoad || preset.eyeLoad || "medium",
    kind: task?.kind || preset.kind || "study",
    done
  };
}

function normalizeDaily(daily = {}) {
  const sourceTasks = Array.isArray(daily.tasks) ? daily.tasks : DEFAULT_TASKS;
  return {
    studyMinutes: 0,
    words: 0,
    mistakes: 0,
    mathProblems: 0,
    signalProblems: 0,
    chapters: 0,
    readingTotal: 0,
    readingWrong: 0,
    statusMode: "good",
    blockBufferUsed: { morning: 0, afternoon: 0, evening: 0 },
    ...daily,
    blockBufferUsed: { morning: 0, afternoon: 0, evening: 0, ...(daily.blockBufferUsed || {}) },
    tasks: sourceTasks.filter((task) => task?.id !== "buffer").map(normalizeTask)
  };
}
function applyTheme(theme) {
  const safeTheme = THEME_COLORS[theme] ? theme : "blue";
  document.documentElement.dataset.theme = safeTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[safeTheme]);
}

function mergeState(saved) {
  const savedVersion = Number(saved?.version) || 1;
  const settings = { ...DEFAULT_STATE.settings, ...(saved?.settings || {}) };
  const usedOldDefaults = savedVersion < DATA_VERSION &&
    Number(settings.scoreTotal) === 330 && Number(settings.scoreMath) === 105 &&
    Number(settings.scoreEnglish) === 55 && Number(settings.scoreSignal) === 120 &&
    Number(settings.scorePolitics) === 60;
  if (usedOldDefaults) {
    Object.assign(settings, { scoreTotal: 360, scoreMath: 120, scoreEnglish: 65, scoreSignal: 120, scorePolitics: 65 });
  }
  const daily = Object.fromEntries(
    Object.entries(saved?.daily || {}).map(([key, value]) => [key, normalizeDaily(value)])
  );
  if (savedVersion < DATA_VERSION && daily[localDateKey()]) {
    ["optional-review", "eye-noon", "eye-night"].forEach((id) => {
      if (!daily[localDateKey()].tasks.some((task) => task.id === id)) {
        daily[localDateKey()].tasks.push(normalizeTask(DEFAULT_TASKS.find((task) => task.id === id)));
      }
    });
  }
  if (savedVersion < 4) {
    if (Number(settings.bufferMinutes) === 90) settings.bufferMinutes = 15;
  }
  const stageQuality = { ...deepClone(DEFAULT_STATE.stageQuality), ...(saved?.stageQuality || {}) };
  if (savedVersion < 4) {
    if (Number(stageQuality.stage1?.target) === 65) stageQuality.stage1.target = 70;
    if (Number(stageQuality.stage2?.target) === 70) stageQuality.stage2.target = 80;
  }
  return {
    ...deepClone(DEFAULT_STATE),
    ...saved,
    version: DATA_VERSION,
    settings,
    progress: { ...DEFAULT_STATE.progress, ...(saved?.progress || {}) },
    progressDetails: saved?.progressDetails && typeof saved.progressDetails === "object" ? saved.progressDetails : {},
    stageQuality,
    ratio: { ...DEFAULT_STATE.ratio, ...(saved?.ratio || {}) },
    daily,
    mistakeNotes: Array.isArray(saved?.mistakeNotes) ? saved.mistakeNotes.map(normalizeMistakeNote) : [],
    weeklyReviews: saved?.weeklyReviews && typeof saved.weeklyReviews === "object" ? saved.weeklyReviews : {}
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const merged = mergeState(saved);
    if (!saved || Number(saved.version) !== DATA_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
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

function addDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function normalizeMistakeNote(note) {
  const date = note?.date || localDateKey();
  return {
    ...note,
    date,
    category: note?.category || "knowledge",
    reviewStep: clamp(Number(note?.reviewStep) || 0, 0, REVIEW_INTERVALS.length - 1),
    nextReviewDate: note?.nextReviewDate || date,
    reviewComplete: Boolean(note?.reviewComplete)
  };
}

function getDaily(dateKey = localDateKey()) {
  if (!state.daily[dateKey]) {
    state.daily[dateKey] = normalizeDaily();
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

function getWakeRecommendation() {
  const toMinutes = (value) => {
    const [hours, minutes] = String(value || "07:00").split(":").map(Number);
    return hours * 60 + minutes;
  };
  const start = parseLocalDate(state.settings.wakeStartDate || localDateKey());
  const elapsed = Math.max(0, Math.floor((startOfToday() - start) / 86400000));
  const days = Math.max(1, Number(state.settings.wakeTransitionDays) || 10);
  const progress = clamp(elapsed / Math.max(1, days - 1), 0, 1);
  const current = toMinutes(state.settings.wakeCurrent);
  const target = toMinutes(state.settings.wakeTarget);
  const result = Math.round(current + (target - current) * progress);
  return `${String(Math.floor(result / 60)).padStart(2, "0")}:${String(result % 60).padStart(2, "0")}`;
}

function isTaskRecommended(task, status) {
  if (status === "good") return true;
  if (task.kind === "care") return true;
  if (status === "mild") return task.priority !== "optional" && task.eyeLoad !== "high";
  return task.eyeLoad === "low" && task.priority !== "optional";
}

function isTaskComplete(task) {
  if (task.kind === "care") return Boolean(task.done);
  return Boolean(task.done) || Number(task.actualMinutes) >= Number(task.minimumMinutes);
}

function taskAccuracy(task) {
  const attempted = Math.max(0, Number(task.attempted) || 0);
  const correct = clamp(Number(task.correct) || 0, 0, attempted);
  return attempted ? Math.round((correct / attempted) * 100) : null;
}

function taskExecutionScore(task) {
  if (task.kind === "care") return task.done ? 100 : 0;
  const actual = Math.max(0, Number(task.actualMinutes) || 0);
  const minimum = Math.max(1, Number(task.minimumMinutes) || 1);
  const standard = Math.max(minimum, Number(task.standardMinutes) || minimum);
  if (actual <= minimum) return clamp(Math.round((actual / minimum) * 100), 0, 100);
  if (standard === minimum) return 120;
  return clamp(Math.round(100 + ((actual - minimum) / (standard - minimum)) * 20), 100, 120);
}
function getEffectiveStudyMinutes(daily) {
  if (!daily) return 0;
  const taskMinutes = (daily.tasks || []).filter((task) => task.kind === "study").reduce((sum, task) => sum + Math.max(0, Number(task.actualMinutes) || 0), 0);
  return Math.max(Math.max(0, Number(daily.studyMinutes) || 0), taskMinutes);
}
function getPoliticsCountdown() {
  const startDate = state.settings.politicsStartDate || "2026-08-15";
  const days = Math.ceil((parseLocalDate(startDate) - startOfToday()) / 86400000);
  if (days > 0) return { label: `距离政治开始 ${days} 天`, detail: `${startDate.slice(5).replace("-", ".")} 启动，只刷选择题` };
  if (days === 0) return { label: "政治今天启动", detail: "按计划开始选择题，不挤占数学和专业课" };
  return { label: `政治已启动 ${Math.abs(days)} 天`, detail: "检查选择题是否持续推进" };
}

function renderMinimumPlan(daily) {
  const minimumTasks = daily.tasks.filter((task) => task.minimumRequired && isTaskRecommended(task, daily.statusMode));
  const done = minimumTasks.filter(isTaskComplete).length;
  const achieved = minimumTasks.length > 0 && done === minimumTasks.length;
  $("#minimum-plan").innerHTML = `
    <div class="minimum-heading"><span><i data-lucide="shield-check"></i><b>今日最低完成</b></span><strong class="${achieved ? "achieved" : ""}">${achieved ? "今日达标" : `${done}/${minimumTasks.length}`}</strong></div>
    <div class="minimum-items">${minimumTasks.map((task) => `<span class="${isTaskComplete(task) ? "done" : ""}"><i data-lucide="${isTaskComplete(task) ? "check-circle-2" : "circle"}"></i>${escapeHtml(task.title)}</span>`).join("") || "<span>当前状态下只执行恢复任务</span>"}</div>
  `;
  const politics = getPoliticsCountdown();
  $("#politics-reminder").innerHTML = `<i data-lucide="bell-ring"></i><span><b>${escapeHtml(politics.label)}</b><small>${escapeHtml(politics.detail)}</small></span>`;
}

function renderToday() {
  const daily = getDaily();
  const requiredTasks = daily.tasks.filter((task) =>
    task.priority === "required" && task.kind !== "care" && isTaskRecommended(task, daily.statusMode)
  );
  const completedRequired = requiredTasks.filter(isTaskComplete).length;
  const completionRate = requiredTasks.length ? Math.round((completedRequired / requiredTasks.length) * 100) : 100;
  const effectiveStudyMinutes = getEffectiveStudyMinutes(daily);
  const studyRate = clamp((effectiveStudyMinutes / state.settings.dailyTargetMinutes) * 100, 0, 100);
  const readingCorrect = Math.max(0, daily.readingTotal - daily.readingWrong);
  const readingAccuracy = daily.readingTotal ? Math.round((readingCorrect / daily.readingTotal) * 100) : null;
  const blindspots = state.mistakeNotes.filter((note) =>
    note.date === localDateKey() && ["knowledge", "thinking"].includes(note.category)
  ).length;
  const scoreSum = Number(state.settings.scoreMath) + Number(state.settings.scoreEnglish) +
    Number(state.settings.scoreSignal) + Number(state.settings.scorePolitics);

  $("#today-label").textContent = formatDateLabel();
  $("#study-minutes").textContent = effectiveStudyMinutes;
  $("#word-count").textContent = daily.words;
  $("#mistake-count").textContent = daily.mistakes;
  $("#completion-rate").textContent = completionRate;
  $("#study-progress").style.width = `${studyRate}%`;
  $("#completion-progress").style.width = `${completionRate}%`;
  $("#daily-target-label").textContent = formatHours(state.settings.dailyTargetMinutes);
  $("#review-target-label").textContent = formatHours(state.settings.reviewMinutes);
  $("#buffer-target-label").textContent = `${state.settings.bufferMinutes} 分钟`;
  $("#wake-target-label").textContent = getWakeRecommendation();
  $("#score-total-hero").textContent = `${state.settings.scoreTotal}+`;
  $("#target-score-card").textContent = `${state.settings.scoreTotal}+`;
  $("#score-sum-card").textContent = scoreSum;
  $("#score-buffer-card").textContent = `缓冲 ${scoreSum - state.settings.scoreTotal} 分`;
  $("#output-problems").textContent = `${daily.mathProblems + daily.signalProblems} 题`;
  $("#output-chapters").textContent = `${daily.chapters} 章`;
  $("#output-reading").textContent = readingAccuracy === null ? "待记录" : `${readingAccuracy}%（错${daily.readingWrong}）`;
  $("#output-blindspots").textContent = `${blindspots} 题`;
  const hiddenCount = daily.tasks.filter((task) => !isTaskRecommended(task, daily.statusMode)).length;
  const advice = {
    good: "显示完整计划，先保底再做进阶任务",
    mild: `已隐藏 ${hiddenCount} 个选做或高用眼任务，优先听课、背词和整理`,
    severe: `已暂停 ${hiddenCount} 个刷题或长阅读任务，只保留低用眼与恢复任务`
  }[daily.statusMode] || "按完整计划执行";
  $("#status-advice").textContent = advice;
  $$("#status-mode button").forEach((button) => button.classList.toggle("active", button.dataset.status === daily.statusMode));
  renderMinimumPlan(daily);
  renderTasks();
  renderWeeklyChart();
  renderYearOverview();
  renderTargetTrend();
  renderReviewReminder();
  renderStageQuality();
  renderBackupReminder();
}

function renderTaskRow(task, daily) {
  const meta = SUBJECT_META[task.subject] || SUBJECT_META["复盘"];
  const completed = isTaskComplete(task);
  const accuracy = taskAccuracy(task);
  const priorityLabel = task.kind === "care" ? "护理" : task.minimumRequired ? "保底" : task.priority === "optional" ? "进阶" : "必做";
  const priorityClass = task.kind === "care" ? "care" : task.priority;
  const timeContent = task.kind === "care"
    ? `<span>建议 ${task.minimumMinutes} 分钟，不计学习时长</span>`
    : `<span>保底 <b>${task.minimumMinutes}</b> 分钟 · 标准 <b>${task.standardMinutes}</b> 分钟 <em class="execution-badge ${taskExecutionScore(task) >= 100 ? "passed" : ""}">完成度 ${taskExecutionScore(task)}%</em></span><label>已投入 <input class="task-actual-input" type="number" min="0" max="720" step="5" inputmode="numeric" value="${Number(task.actualMinutes) || 0}"> 分</label>`;
  const quality = task.kind === "study" && (accuracy !== null || Number(task.mastery) > 0)
    ? `<div class="task-quality"><span>知识掌握 <b>${Number(task.mastery) || 0}%</b></span><span>题目正确率 <b>${accuracy === null ? "待录入" : `${accuracy}%`}</b></span></div>`
    : "";
  return `
    <div class="task-row ${completed ? "done" : ""}" data-task-id="${escapeHtml(task.id)}">
      <label class="task-check"><input type="checkbox" ${completed ? "checked" : ""} aria-label="完成${escapeHtml(task.title)}"><span><i data-lucide="check"></i></span></label>
      <div class="task-main">
        <strong>${escapeHtml(task.title)} <em class="priority-tag ${priorityClass}">${priorityLabel}</em><em class="topic-tag">${escapeHtml(task.topicLevel)}</em></strong>
        <small>${escapeHtml(task.detail)}</small>
        <div class="task-duration">${timeContent}</div>
        ${quality}
      </div>
      <span class="subject-chip ${meta.className}">${escapeHtml(task.subject)}</span>
      ${task.kind === "study" ? '<button class="task-assess" aria-label="任务验收" title="记录正确率和掌握度"><i data-lucide="clipboard-check"></i></button>' : ""}
      <button class="task-delete" aria-label="删除${escapeHtml(task.title)}" title="删除任务"><i data-lucide="trash-2"></i></button>
    </div>
  `;
}

function renderTasks() {
  const daily = getDaily();
  const list = $("#task-list");
  const blocks = [
    { key: "morning", title: "上午学习块", icon: "sunrise" },
    { key: "afternoon", title: "下午学习块", icon: "sun" },
    { key: "evening", title: "晚间学习块", icon: "moon" }
  ];
  const visibleTasks = daily.tasks.filter((task) => isTaskRecommended(task, daily.statusMode));
  $("#task-empty").classList.toggle("hidden", visibleTasks.length > 0);
  const baseBuffer = Math.max(0, Number(state.settings.bufferMinutes) || 15);
  let carried = 0;
  list.innerHTML = blocks.map((block) => {
    const tasks = visibleTasks.filter((task) => task.block === block.key);
    const required = tasks.filter((task) => task.priority === "required" && task.kind !== "care");
    const unfinished = required.filter((task) => !isTaskComplete(task)).length;
    const minimumTotal = tasks.filter((task) => task.kind === "study").reduce((sum, task) => sum + Number(task.minimumMinutes), 0);
    const standardTotal = tasks.filter((task) => task.kind === "study").reduce((sum, task) => sum + Number(task.standardMinutes), 0);
    const available = block.key === "evening" ? baseBuffer + carried : baseBuffer;
    const used = clamp(Number(daily.blockBufferUsed[block.key]) || 0, 0, available);
    const result = `
      <section class="study-block ${unfinished === 0 && required.length ? "block-done" : ""}" data-block="${block.key}">
        <div class="study-block-heading">
          <span class="block-title"><i data-lucide="${block.icon}"></i><span><b>${block.title}</b><small>${unfinished} 个必做未完成 · 保底 ${minimumTotal} 分 / 标准 ${standardTotal} 分</small></span></span>
          <strong>${unfinished === 0 && required.length ? "已完成" : `${tasks.length} 项`}</strong>
        </div>
        <div class="block-task-list">${tasks.map((task) => renderTaskRow(task, daily)).join("") || '<div class="block-empty">当前状态下本时段无执行任务</div>'}</div>
        <div class="block-buffer"><span><i data-lucide="clock-3"></i><b>缓冲 ${available} 分钟</b><small>${carried ? `含前序累计 ${carried} 分钟` : "用于延迟补偿、休息或临时事务"}</small></span><label>已用 <input class="buffer-used-input" type="number" min="0" max="${available}" step="5" inputmode="numeric" value="${used}"> 分</label></div>
      </section>`;
    if (block.key !== "evening") carried += Math.max(0, baseBuffer - used);
    return result;
  }).join("");

  $$(".task-row", list).forEach((row) => {
    const id = row.dataset.taskId;
    const checkbox = $(".task-check input", row);
    checkbox.addEventListener("change", (event) => {
      const task = getDaily().tasks.find((item) => item.id === id);
      if (!task) return;
      task.done = event.target.checked;
      if (task.kind !== "care") task.actualMinutes = event.target.checked ? Math.max(task.actualMinutes, task.minimumMinutes) : 0;
      saveState(); renderToday(); renderIcons();
    });
    const actualInput = $(".task-actual-input", row);
    actualInput?.addEventListener("change", () => {
      const task = getDaily().tasks.find((item) => item.id === id);
      if (!task) return;
      task.actualMinutes = clamp(Number(actualInput.value) || 0, 0, 720);
      task.done = task.actualMinutes >= task.minimumMinutes;
      saveState(); renderToday(); renderIcons();
    });
    $(".task-assess", row)?.addEventListener("click", () => openTaskAssessmentDialog(id));
    $(".task-delete", row).addEventListener("click", () => {
      const task = getDaily().tasks.find((item) => item.id === id);
      if (!task || !confirm(`删除任务“${task.title}”？`)) return;
      getDaily().tasks = getDaily().tasks.filter((item) => item.id !== id);
      saveState(); renderToday(); renderIcons(); showToast("任务已删除");
    });
  });
  $$(".study-block", list).forEach((block) => {
    $(".buffer-used-input", block).addEventListener("change", (event) => {
      const key = block.dataset.block;
      const max = Number(event.target.max) || 15;
      getDaily().blockBufferUsed[key] = clamp(Number(event.target.value) || 0, 0, max);
      saveState(); renderTasks();
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
    const minutes = getEffectiveStudyMinutes(state.daily[key]);
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

function formatCompactHours(minutes) {
  const hours = minutes / 60;
  if (hours >= 100) return `${Math.round(hours)} 小时`;
  return `${hours.toFixed(1)} 小时`;
}

function renderYearOverview() {
  const today = startOfToday();
  const year = today.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const monthPrefix = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-`;
  const target = Math.max(1, Number(state.settings.dailyTargetMinutes) || 1);
  let totalMinutes = 0;
  let monthMinutes = 0;
  let studyDays = 0;
  let targetDays = 0;

  Object.entries(state.daily).forEach(([key, daily]) => {
    if (!key.startsWith(`${year}-`)) return;
    const minutes = getEffectiveStudyMinutes(daily);
    totalMinutes += minutes;
    if (key.startsWith(monthPrefix)) monthMinutes += minutes;
    if (minutes > 0) studyDays += 1;
    if (minutes >= target) targetDays += 1;
  });

  let streak = 0;
  const cursor = new Date(today);
  while (getEffectiveStudyMinutes(state.daily[localDateKey(cursor)]) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  $("#year-overview-title").textContent = `${year} 年累计`;
  $("#year-total-hours").textContent = formatCompactHours(totalMinutes);
  $("#month-total-hours").textContent = formatCompactHours(monthMinutes);
  $("#year-study-days").textContent = `${studyDays} 天`;
  $("#year-target-days").textContent = `${targetDays} 天`;
  $("#current-streak").textContent = `${streak} 天`;

  const cells = [];
  for (let blank = 0; blank < yearStart.getDay(); blank += 1) {
    cells.push('<i class="heat-cell empty" aria-hidden="true"></i>');
  }
  for (const date = new Date(yearStart); date <= yearEnd; date.setDate(date.getDate() + 1)) {
    const key = localDateKey(date);
    const minutes = getEffectiveStudyMinutes(state.daily[key]);
    const ratio = minutes / target;
    const level = minutes === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    const future = date > today ? " future" : "";
    cells.push(`<i class="heat-cell${future}" data-level="${level}" title="${key} · ${minutes} 分钟"></i>`);
  }
  $("#year-heatmap").innerHTML = cells.join("");

  requestAnimationFrame(() => {
    const scroll = $("#year-heatmap-scroll");
    if (scroll && scroll.scrollWidth > scroll.clientWidth) {
      const yearProgress = (today - yearStart) / Math.max(1, yearEnd - yearStart);
      scroll.scrollLeft = Math.max(0, yearProgress * scroll.scrollWidth - scroll.clientWidth * 0.72);
    }
  });
}

function renderTargetTrend() {
  const today = startOfToday();
  const weekday = (today.getDay() + 6) % 7;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - weekday);
  const weeks = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - offset * 7);
    let hitDays = 0;
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + day);
      if (date <= today && getEffectiveStudyMinutes(state.daily[localDateKey(date)]) >= state.settings.dailyTargetMinutes) hitDays += 1;
    }
    weeks.push({ label: `${start.getMonth() + 1}.${start.getDate()}`, hitDays });
  }
  $("#target-trend").innerHTML = weeks.map((week) => `
    <div class="trend-week"><span><i style="height:${Math.max(4, (week.hitDays / 7) * 100)}%"></i></span><b>${week.hitDays}</b><small>${week.label}</small></div>
  `).join("");
}

function renderStageQuality() {
  Object.entries(state.stageQuality).forEach(([key, quality]) => {
    const value = Math.max(0, Number(quality?.value) || 0);
    const target = Number(quality?.target);
    const hasTarget = Number.isFinite(target) && target > 0;
    const unit = quality?.unit || "%";
    const ratio = hasTarget ? clamp((value / target) * 100, 0, 100) : 0;
    $(`#${key}-quality`).style.width = `${ratio}%`;
    $(`#${key}-quality-label`).textContent = hasTarget ? `${value} / ${target}${unit}` : "待设置";
    $(`#${key}-quality-label`).classList.toggle("passed", hasTarget && value >= target);
  });
}

function renderBackupReminder() {
  const last = state.settings.lastBackupDate;
  const daysSince = last ? Math.floor((startOfToday() - parseLocalDate(last)) / 86400000) : Infinity;
  $("#backup-reminder").classList.toggle("hidden", daysSince < 7);
}
function getDueMistakes() {
  const todayKey = localDateKey();
  return state.mistakeNotes.filter((note) =>
    !note.reviewComplete && note.nextReviewDate && note.nextReviewDate <= todayKey
  );
}

function renderReviewReminder() {
  const dueCount = getDueMistakes().length;
  $("#review-reminder-title").textContent = dueCount ? `今日有 ${dueCount} 条错题到期` : "今日无到期复盘";
  $("#review-reminder-detail").textContent = dueCount
    ? "只看题源和错误原因，重新动手计算后标记完成"
    : "新错题将在 1、3、7、14 天后提醒";
  $("#review-reminder").classList.toggle("due", dueCount > 0);
  $("#mistake-review-summary").textContent = dueCount ? `${dueCount} 条今日到期` : "按 1·3·7·14 天复盘";
}

function renderProgress() {
  Object.entries(state.progress).forEach(([key, value]) => {
    const detail = state.progressDetails[key];
    const completed = Number(detail?.completed);
    const total = Number(detail?.total);
    const hasCalculation = Number.isFinite(completed) && completed >= 0 && Number.isFinite(total) && total > 0;
    const safeValue = hasCalculation
      ? clamp(Math.round((completed / total) * 100), 0, 100)
      : clamp(Number(value) || 0, 0, 100);
    const attempted = Math.max(0, Number(detail?.attempted) || 0);
    const correct = Math.max(0, Number(detail?.correct) || 0);
    const quality = attempted ? clamp(Math.round((correct / attempted) * 100), 0, 100) : 0;
    state.progress[key] = safeValue;
    $(`#${key}-progress`).style.width = `${safeValue}%`;
    $(`#${key}-progress-label`).textContent = `${safeValue}%`;
    const basis = $(`#${key}-progress-basis`);
    if (basis) {
      if (hasCalculation) {
        const unit = detail.unit || "项";
        const remaining = Math.max(0, total - completed);
        const deadline = detail.deadline || state.settings.summerEnd;
        const daysLeft = inclusiveDaysUntil(deadline);
        const dailyPace = daysLeft > 0 ? remaining / daysLeft : 0;
        const deadlineLabel = deadline.slice(5).replace("-", ".");
        basis.textContent = remaining === 0
          ? `已完成 ${completed} / ${total} ${unit}，本阶段完成`
          : daysLeft > 0
            ? `剩余 ${remaining} ${unit} · 至 ${deadlineLabel} 每天需 ${dailyPace < 10 ? dailyPace.toFixed(1) : Math.ceil(dailyPace)} ${unit}`
            : `剩余 ${remaining} ${unit} · 已超过 ${deadlineLabel} 截止日`;
      } else {
        basis.textContent = "点击铅笔填写完成量、总量和截止日期";
      }
    }
    const mastery = clamp(Number(detail?.mastery) || 0, 0, 100);
    const row = $(`#${key}-progress`).closest(".subject-progress-row");
    let qualityWrap = $(".subject-quality", row);
    if (!qualityWrap) {
      qualityWrap = document.createElement("div");
      qualityWrap.className = "subject-quality";
      row.insertBefore(qualityWrap, $("small", row));
    }
    qualityWrap.innerHTML = `
      <div><span>知识点掌握度</span><b>${mastery ? `${mastery}%` : "待录入"}</b></div><div class="subject-track quality"><i style="width:${mastery}%"></i></div>
      <div class="subject-quality-second"><span>做题正确率</span><b>${attempted ? `${quality}%（${correct}/${attempted}）` : "待录入"}</b></div><div class="subject-track quality"><i style="width:${quality}%"></i></div>`;
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
  document.documentElement.classList.add("dialog-open");
  $("#app-dialog").showModal();
  renderIcons();
}

function closeDialog() {
  $("#app-dialog").close();
  document.documentElement.classList.remove("dialog-open");
}

function openAddTaskDialog() {
  showDialog({
    kicker: "弹性计划",
    title: "新增任务块",
    content: `
      <div class="form-grid">
        <div class="form-field"><label for="task-block-input">学习时段</label><select id="task-block-input"><option value="morning">上午学习块</option><option value="afternoon">下午学习块</option><option value="evening">晚间学习块</option></select></div>
        <div class="form-field"><label for="task-subject-input">科目</label><select id="task-subject-input">${Object.keys(SUBJECT_META).map((subject) => `<option>${subject}</option>`).join("")}</select></div>
        <div class="form-field"><label for="task-minimum-input">保底分钟</label><input id="task-minimum-input" type="number" min="5" max="360" step="5" value="60"></div>
        <div class="form-field"><label for="task-standard-input">标准分钟</label><input id="task-standard-input" type="number" min="5" max="480" step="5" value="90"></div>
        <div class="form-field"><label for="task-priority-input">任务级别</label><select id="task-priority-input"><option value="required">必做项</option><option value="optional">进阶任务</option></select></div>
        <div class="form-field"><label for="task-minimum-required-input">今日保底清单</label><select id="task-minimum-required-input"><option value="false">普通任务</option><option value="true">加入今日最低完成</option></select></div>
        <div class="form-field"><label for="task-eye-input">用眼强度</label><select id="task-eye-input"><option value="high">高：纸笔刷题/精读</option><option value="medium">中：听课+笔记</option><option value="low">低：听课/背词/回忆</option></select></div>
        <div class="form-field"><label for="task-topic-input">考点标签</label><select id="task-topic-input"><option>必拿分</option><option>基础</option><option>拔高</option><option>低频</option><option>重点大题</option><option>高频小题</option><option>核心优先</option><option>进阶</option></select></div>
        <div class="form-field full"><label for="task-title-input">任务名称</label><input id="task-title-input" type="text" maxlength="40" placeholder="例如：高数第一章刷题"></div>
        <div class="form-field full"><label for="task-detail-input">执行标准</label><input id="task-detail-input" type="text" maxlength="80" placeholder="例如：完成20题并记录正确率"></div>
      </div>
      <p class="form-help">达到保底分钟后任务自动完成；超过标准分钟会计入超额完成度。任务不绑定具体开始时间。</p>
    `,
    actions: `<button type="button" class="secondary-button" data-dialog-close>取消</button><button type="button" class="primary-button" id="save-task-button">添加任务</button>`
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-task-button").addEventListener("click", () => {
    const title = $("#task-title-input").value.trim();
    const detail = $("#task-detail-input").value.trim();
    const minimumMinutes = clamp(Number($("#task-minimum-input").value) || 0, 5, 360);
    const standardMinutes = clamp(Number($("#task-standard-input").value) || 0, minimumMinutes, 480);
    if (!title) { showToast("请填写任务名称"); return; }
    getDaily().tasks.push(normalizeTask({
      id: `task-${Date.now()}`,
      block: $("#task-block-input").value,
      subject: $("#task-subject-input").value,
      title,
      detail: detail || "达到保底时间并记录验收结果",
      minimumMinutes,
      standardMinutes,
      actualMinutes: 0,
      priority: $("#task-priority-input").value,
      minimumRequired: $("#task-minimum-required-input").value === "true",
      topicLevel: $("#task-topic-input").value,
      eyeLoad: $("#task-eye-input").value,
      kind: "study",
      done: false
    }));
    saveState(); closeDialog(); renderToday(); showToast("任务已加入弹性学习块");
  });
}

function openTaskAssessmentDialog(taskId) {
  const task = getDaily().tasks.find((item) => item.id === taskId);
  if (!task) return;
  const accuracy = taskAccuracy(task);
  showDialog({
    kicker: "任务验收",
    title: task.title,
    content: `
      <div class="assessment-summary"><span>保底 <b>${task.minimumMinutes} 分</b></span><span>标准 <b>${task.standardMinutes} 分</b></span><span>已投入 <b>${task.actualMinutes || 0} 分</b></span></div>
      <div class="form-grid">
        <div class="form-field"><label for="assessment-attempted">完成题数</label><input id="assessment-attempted" type="number" min="0" step="1" value="${task.attempted || 0}"></div>
        <div class="form-field"><label for="assessment-correct">正确题数</label><input id="assessment-correct" type="number" min="0" step="1" value="${task.correct || 0}"></div>
        <div class="form-field full"><label for="assessment-mastery">知识点掌握度：<b id="assessment-mastery-value">${task.mastery || 0}%</b></label><input id="assessment-mastery" type="range" min="0" max="100" step="5" value="${task.mastery || 0}"></div>
      </div>
      <div class="quality-preview"><span>知识掌握 <b id="preview-mastery">${task.mastery || 0}%</b></span><span>题目正确率 <b id="preview-accuracy">${accuracy === null ? "待录入" : `${accuracy}%`}</b></span></div>
      <p class="form-help">正确率 = 正确题数 ÷ 完成题数。知识掌握度与做题正确率分开记录，不再合并成一个质量分。</p>
    `,
    actions: `<button type="button" class="secondary-button" data-dialog-close>取消</button><button type="button" class="primary-button" id="save-assessment">保存验收</button>`
  });
  const update = () => {
    const attempted = Math.max(0, Number($("#assessment-attempted").value) || 0);
    const correct = clamp(Number($("#assessment-correct").value) || 0, 0, attempted);
    const mastery = clamp(Number($("#assessment-mastery").value) || 0, 0, 100);
    $("#assessment-correct").max = attempted;
    $("#assessment-mastery-value").textContent = `${mastery}%`;
    $("#preview-mastery").textContent = `${mastery}%`;
    $("#preview-accuracy").textContent = attempted ? `${Math.round((correct / attempted) * 100)}%` : "待录入";
    return { attempted, correct, mastery };
  };
  [$("#assessment-attempted"), $("#assessment-correct"), $("#assessment-mastery")].forEach((input) => input.addEventListener("input", update));
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-assessment").addEventListener("click", () => {
    Object.assign(task, update());
    saveState(); closeDialog(); renderToday(); showToast("任务正确率和掌握度已保存");
  });
}
function openSettingsDialog() {
  const s = state.settings;
  const scoreSum = Number(s.scoreMath) + Number(s.scoreEnglish) + Number(s.scoreSignal) + Number(s.scorePolitics);
  showDialog({
    kicker: "全局配置",
    title: "工作台设置",
    content: `
      <div class="dialog-section">
        <h3>主题颜色</h3>
        <div class="theme-grid" id="theme-grid">
          <button type="button" class="theme-choice" data-theme="blue"><i style="background:#356f9f"></i><span>海蓝</span></button>
          <button type="button" class="theme-choice" data-theme="graphite"><i style="background:#626b73"></i><span>石墨灰</span></button>
          <button type="button" class="theme-choice" data-theme="coral"><i style="background:#9b4a43"></i><span>砖红</span></button>
          <button type="button" class="theme-choice" data-theme="teal"><i style="background:#39777a"></i><span>青灰</span></button>
          <button type="button" class="theme-choice" data-theme="green"><i style="background:#3d7654"></i><span>原绿色</span></button>
        </div>
      </div>
      <div class="dialog-section">
        <h3>考试与阶段日期</h3>
        <div class="form-grid">
          <div class="form-field"><label for="setting-exam">初试日期</label><input id="setting-exam" type="date" value="${escapeHtml(s.examDate)}"></div>
          <div class="form-field"><label for="setting-summer">暑假黄金期截止</label><input id="setting-summer" type="date" value="${escapeHtml(s.summerEnd)}"></div>
          <div class="form-field"><label for="setting-strength">强化阶段节点</label><input id="setting-strength" type="date" value="${escapeHtml(s.strengthEnd)}"></div>
          <div class="form-field"><label for="setting-sprint">冲刺阶段节点</label><input id="setting-sprint" type="date" value="${escapeHtml(s.sprintEnd)}"></div>
        </div>
      </div>
      <div class="dialog-section">
        <h3>每日时间基准</h3>
        <div class="form-grid">
          <div class="form-field"><label for="setting-daily">净学习分钟</label><input id="setting-daily" type="number" min="60" max="1000" step="10" value="${s.dailyTargetMinutes}"></div>
          <div class="form-field"><label for="setting-review">固定复盘分钟</label><input id="setting-review" type="number" min="10" max="180" step="10" value="${s.reviewMinutes}"></div>
          <div class="form-field"><label for="setting-buffer">每个学习块缓冲分钟</label><input id="setting-buffer" type="number" min="0" max="60" step="5" value="${s.bufferMinutes}"></div>
          <div class="form-field"><label for="setting-politics-start">政治启动日期</label><input id="setting-politics-start" type="date" value="${escapeHtml(s.politicsStartDate || "2026-08-15")}"></div>
        </div>
      </div>
      <div class="dialog-section">
        <h3>起床过渡期</h3>
        <div class="form-grid">
          <div class="form-field"><label for="wake-start-date">过渡开始日期</label><input id="wake-start-date" type="date" value="${escapeHtml(s.wakeStartDate)}"></div>
          <div class="form-field"><label for="wake-days">过渡天数</label><input id="wake-days" type="number" min="1" max="30" value="${s.wakeTransitionDays}"></div>
          <div class="form-field"><label for="wake-current">当前起床时间</label><input id="wake-current" type="time" value="${escapeHtml(s.wakeCurrent)}"></div>
          <div class="form-field"><label for="wake-target">目标起床时间</label><input id="wake-target" type="time" value="${escapeHtml(s.wakeTarget)}"></div>
        </div>
      </div>
      <div class="dialog-section">
        <h3>分数目标</h3>
        <div class="form-grid">
          <div class="form-field"><label for="score-total">总分目标</label><input id="score-total" type="number" value="${s.scoreTotal}"></div>
          <div class="form-field"><label for="score-math">数学一</label><input id="score-math" type="number" value="${s.scoreMath}"></div>
          <div class="form-field"><label for="score-signal">专业课843</label><input id="score-signal" type="number" value="${s.scoreSignal}"></div>
          <div class="form-field"><label for="score-english">英语一</label><input id="score-english" type="number" value="${s.scoreEnglish}"></div>
          <div class="form-field"><label for="score-politics">政治</label><input id="score-politics" type="number" value="${s.scorePolitics}"></div>
        </div>
        <p class="form-help">当前单科目标合计 ${scoreSum} 分，相对总分目标保留 ${scoreSum - s.scoreTotal} 分波动缓冲。</p>
      </div>
    `,
    actions: `
      <button type="button" class="danger-button" id="reset-data-button">恢复初始数据</button>
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-settings-button">保存设置</button>
    `
  });

  let selectedTheme = THEME_COLORS[s.theme] ? s.theme : "blue";
  const syncThemeChoices = () => {
    $$(".theme-choice").forEach((button) => {
      const active = button.dataset.theme === selectedTheme;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  syncThemeChoices();
  $$(".theme-choice").forEach((button) => button.addEventListener("click", () => {
    selectedTheme = button.dataset.theme;
    applyTheme(selectedTheme);
    syncThemeChoices();
  }));
  $("[data-dialog-close]").addEventListener("click", () => {
    applyTheme(state.settings.theme);
    closeDialog();
  });
  $("#save-settings-button").addEventListener("click", () => {
    state.settings = {
      ...state.settings,
      examDate: $("#setting-exam").value,
      summerEnd: $("#setting-summer").value,
      strengthEnd: $("#setting-strength").value,
      sprintEnd: $("#setting-sprint").value,
      dailyTargetMinutes: clamp(Number($("#setting-daily").value), 60, 1000),
      reviewMinutes: clamp(Number($("#setting-review").value), 10, 180),
      bufferMinutes: clamp(Number($("#setting-buffer").value), 0, 60),
      politicsStartDate: $("#setting-politics-start").value || "2026-08-15",
      wakeStartDate: $("#wake-start-date").value || localDateKey(),
      wakeTransitionDays: clamp(Number($("#wake-days").value), 1, 30),
      wakeCurrent: $("#wake-current").value || "08:00",
      wakeTarget: $("#wake-target").value || "07:00",
      scoreTotal: Number($("#score-total").value) || 360,
      scoreMath: Number($("#score-math").value) || 120,
      scoreEnglish: Number($("#score-english").value) || 65,
      scoreSignal: Number($("#score-signal").value) || 120,
      scorePolitics: Number($("#score-politics").value) || 65,
      theme: selectedTheme
    };
    applyTheme(selectedTheme);
    saveState();
    closeDialog();
    renderAll();
    showToast("设置已保存");
  });
  $("#reset-data-button").addEventListener("click", () => {
    if (!confirm("恢复初始数据会清除当前浏览器中的任务和学习记录，确定继续？")) return;
    state = deepClone(DEFAULT_STATE);
    applyTheme(state.settings.theme);
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
    kicker: "数一抓分主线",
    key: "math",
    rows: [
      ["三重积分、曲线/曲面积分", "数一独有，计算链长，安排持续手算", "高权重"],
      ["无穷级数", "判敛、幂级数与展开综合训练", "高权重"],
      ["概率论与数理统计", "概率计算、估计与检验不能只听课", "高权重"],
      ["880 基础篇", "主线必做，确保基础题正确率", "基础必做"],
      ["880 综合篇", "用于质量验收和综合计算", "综合必做"],
      ["880 拓展篇", "不进入当前计划，守住时间边界", "明确放弃"]
    ]
  },
  signal: {
    title: "843 信号与系统",
    kicker: "专业课抓分主线",
    key: "signal",
    notice: "2027年843考试大纲处于拟调整阶段，以下是复习优先级标签，不代表官方固定出题频率；最终以杭电正式招生目录为准。",
    rows: [
      ["傅里叶变换 + 采样定理", "连续/离散频谱、调制与采样恢复联动", "必考大题"],
      ["Z变换 + 系统稳定性", "ROC、因果稳定与差分系统综合", "必考大题"],
      ["系统函数零极点", "零极点图、频率响应与系统性质", "必考大题"],
      ["拉普拉斯变换", "系统响应、初终值与连续系统分析", "高频小题"],
      ["卷积与LTI性质", "基本方法必须熟练，避免概念失分", "高频小题"],
      ["证明型与边缘性质", "主干完成后再补，不抢核心题时间", "低频了解"]
    ]
  },
  english: {
    title: "英语一",
    kicker: "阅读正确率主线",
    key: "english",
    rows: [
      ["阅读真题", "2010-2020 一刷，记录总题数与错题数", "核心优先"],
      ["单词二轮", "滚动复习，服务阅读定位与句意", "核心优先"],
      ["完形 / 新题型", "不挤占阅读主线，后续集中训练", "次优先"],
      ["翻译 / 写作", "当前建立素材，冲刺阶段系统推进", "阶段延后"]
    ]
  },
  politics: {
    title: "政治刷题",
    kicker: "选择题优先",
    key: "politics",
    rows: [
      ["启动时间", "2026年8月15日前后", "按期启动"],
      ["选择题", "当前质量统计以选择题正确率为准", "核心优先"],
      ["分析题", "现阶段延后", "阶段延后"],
      ["时间原则", "不挤占数学和专业课主线", "守住边界"]
    ]
  }
};
function openModuleDialog(moduleKey) {
  const module = MODULES[moduleKey];
  const current = clamp(Number(state.progress[module.key]) || 0, 0, 100);
  const savedDetail = state.progressDetails[module.key];
  const detail = savedDetail || { completed: current, total: 100, unit: "计划点", correct: 0, attempted: 0, mastery: 0 };
  const politicsCallout = moduleKey === "politics"
    ? `<div class="callout amber-callout" style="margin-bottom:12px">政治按计划在 8 月中旬启动。现在无需用大块时间提前挤占数学和专业课。</div>`
    : "";
  const noticeCallout = module.notice
    ? `<div class="callout amber-callout" style="margin-bottom:12px">${escapeHtml(module.notice)}</div>`
    : "";
  const qualityLabel = moduleKey === "english" ? "阅读正确题数 / 阅读答题数" : "做对题数 / 实际答题数";
  showDialog({
    kicker: module.kicker,
    title: module.title,
    content: `
      ${politicsCallout}${noticeCallout}
      <div class="module-list">
        ${module.rows.map(([title, detailText, tag]) => `
          <div class="module-row">
            <span><b>${escapeHtml(title)}</b><small>${escapeHtml(detailText)}</small></span>
            <em class="topic-tag">${escapeHtml(tag)}</em>
          </div>
        `).join("")}
      </div>
      <div class="callout" style="margin-top:16px">
        内容进度和质量完成度分开计算：学完不等于掌握，质量以独立做题正确率为准。
      </div>
      <div class="form-grid" style="margin-top:14px">
        <div class="form-field"><label for="module-completed-input">已完成量</label><input id="module-completed-input" type="number" min="0" step="1" value="${escapeHtml(detail.completed)}"></div>
        <div class="form-field"><label for="module-total-input">本阶段计划总量</label><input id="module-total-input" type="number" min="1" step="1" value="${escapeHtml(detail.total)}"></div>
        <div class="form-field"><label for="module-unit-input">单位</label><input id="module-unit-input" type="text" maxlength="12" value="${escapeHtml(detail.unit || "项")}" placeholder="题、讲、篇、章、套"></div>
        <div class="form-field"><label for="module-deadline-input">本阶段截止日期</label><input id="module-deadline-input" type="date" value="${escapeHtml(detail.deadline || state.settings.summerEnd)}"></div>
        <div class="form-field"><label for="module-correct-input">${qualityLabel.split(" / ")[0]}</label><input id="module-correct-input" type="number" min="0" step="1" value="${escapeHtml(detail.correct || 0)}"></div>
        <div class="form-field"><label for="module-attempted-input">${qualityLabel.split(" / ")[1]}</label><input id="module-attempted-input" type="number" min="0" step="1" value="${escapeHtml(detail.attempted || 0)}"></div>
        <div class="form-field full"><label for="module-mastery-input">知识点掌握度：<b id="module-mastery-label">${escapeHtml(detail.mastery || 0)}%</b></label><input id="module-mastery-input" type="range" min="0" max="100" step="5" value="${escapeHtml(detail.mastery || 0)}"></div>
      </div>
      <p class="form-help">内容进度：<b id="module-progress-value">${current}%</b>　做题正确率：<b id="module-quality-value">${detail.quality || 0}%</b></p>
    `,
    actions: `
      <button type="button" class="secondary-button" data-dialog-close>取消</button>
      <button type="button" class="primary-button" id="save-module-button">保存验收</button>
    `
  });

  const completedInput = $("#module-completed-input");
  const totalInput = $("#module-total-input");
  const correctInput = $("#module-correct-input");
  const attemptedInput = $("#module-attempted-input");
  const masteryInput = $("#module-mastery-input");
  const calculateProgress = () => {
    const completed = Math.max(0, Number(completedInput.value) || 0);
    const total = Math.max(1, Number(totalInput.value) || 1);
    const correct = Math.max(0, Number(correctInput.value) || 0);
    const attempted = Math.max(0, Number(attemptedInput.value) || 0);
    const percentage = clamp(Math.round((completed / total) * 100), 0, 100);
    const quality = attempted ? clamp(Math.round((correct / attempted) * 100), 0, 100) : 0;
    const mastery = clamp(Number(masteryInput.value) || 0, 0, 100);
    $("#module-progress-value").textContent = `${percentage}%（${completed} ÷ ${total}）`;
    $("#module-quality-value").textContent = attempted ? `${quality}%（${correct} ÷ ${attempted}）` : "待录入";
    $("#module-mastery-label").textContent = `${mastery}%`;
    return { completed, total, percentage, correct, attempted, quality, mastery };
  };
  [completedInput, totalInput, correctInput, attemptedInput, masteryInput].forEach((input) => input.addEventListener("input", calculateProgress));
  calculateProgress();
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-module-button").addEventListener("click", () => {
    const result = calculateProgress();
    state.progressDetails[module.key] = {
      ...result,
      unit: $("#module-unit-input").value.trim().slice(0, 12) || "项",
      deadline: $("#module-deadline-input").value || state.settings.summerEnd
    };
    state.progress[module.key] = result.percentage;
    saveState();
    closeDialog();
    renderProgress();
    showToast(`${module.title}内容进度和质量验收已更新`);
  });
}
function openMistakesDialog() {
  showDialog({
    kicker: "复盘系统",
    title: "错题分类复盘",
    content: `
      <div class="callout amber-callout" style="margin-bottom:14px">不誊抄整题，只记录题源、错误类型和下次动作。知识盲区与思路不会优先显示。</div>
      <div class="mistake-treatment"><span><b>计算失误</b>重新计算一次，记录错误原因</span><span><b>知识点盲区</b>重学知识点，再做对应例题</span><span><b>思路不会</b>整理标准步骤，记录解题模板</span></div>
      <div class="form-grid">
        <div class="form-field"><label for="mistake-subject-input">科目</label><select id="mistake-subject-input"><option>数学一</option><option>信号与系统</option><option>英语一</option><option>政治</option></select></div>
        <div class="form-field"><label for="mistake-category-input">错误类型</label><select id="mistake-category-input"><option value="calculation">计算失误</option><option value="knowledge">知识点盲区</option><option value="thinking">思路不会</option></select></div>
        <div class="form-field full"><label for="mistake-source-input">题源</label><input id="mistake-source-input" type="text" placeholder="例如：880 P126-18"></div>
        <div class="form-field full"><label for="mistake-reason-input">错误原因与下次动作</label><input id="mistake-reason-input" type="text" placeholder="例如：不会构造辅助函数；明早脱离答案重算"></div>
      </div>
      <button type="button" class="icon-text-button" id="add-mistake-note" style="margin:12px 0 14px"><i data-lucide="plus"></i><span>添加标记</span></button>
      <div class="segmented mistake-filters" id="mistake-filters">
        <button class="active" data-mistake-filter="all">全部</button><button data-mistake-filter="due">今日到期</button><button data-mistake-filter="knowledge">知识盲区</button><button data-mistake-filter="thinking">思路不会</button><button data-mistake-filter="calculation">计算失误</button>
      </div>
      <div class="mistake-list" id="mistake-note-list">${renderMistakeNotesHtml()}</div>
    `,
    actions: `<button type="button" class="primary-button" data-dialog-close>完成</button>`
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  const refreshList = () => {
    const filter = $("#mistake-filters .active")?.dataset.mistakeFilter || "all";
    $("#mistake-note-list").innerHTML = renderMistakeNotesHtml(filter);
    bindMistakeListButtons(refreshList);
    renderIcons();
  };
  $$("#mistake-filters button").forEach((button) => button.addEventListener("click", () => {
    $$("#mistake-filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    refreshList();
  }));
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
      category: $("#mistake-category-input").value,
      source,
      reason,
      date: localDateKey(),
      reviewStep: 0,
      nextReviewDate: addDays(localDateKey(), REVIEW_INTERVALS[0]),
      reviewComplete: false
    });
    getDaily().mistakes += 1;
    saveState();
    refreshList();
    renderToday();
    $("#mistake-source-input").value = "";
    $("#mistake-reason-input").value = "";
  });
  bindMistakeListButtons(refreshList);
}

function renderMistakeNotesHtml(filter = "all") {
  const todayKey = localDateKey();
  const categoryLabels = { calculation: "计算失误", knowledge: "知识点盲区", thinking: "思路不会" };
  const priority = { thinking: 0, knowledge: 1, calculation: 2 };
  const notes = [...state.mistakeNotes]
    .filter((note) => filter === "all" || (filter === "due" ? !note.reviewComplete && note.nextReviewDate <= todayKey : note.category === filter))
    .sort((a, b) => {
      if (a.reviewComplete !== b.reviewComplete) return a.reviewComplete ? 1 : -1;
      if ((priority[a.category] ?? 9) !== (priority[b.category] ?? 9)) return (priority[a.category] ?? 9) - (priority[b.category] ?? 9);
      return (a.nextReviewDate || "9999-12-31").localeCompare(b.nextReviewDate || "9999-12-31");
    });
  if (!notes.length) return `<div class="empty-state"><i data-lucide="notebook-tabs"></i><p>当前筛选下没有错题。</p></div>`;
  return notes.slice(0, 40).map((note) => {
    const due = !note.reviewComplete && note.nextReviewDate <= todayKey;
    const reviewLabel = note.reviewComplete ? "四轮复盘已完成" : due ? `第 ${note.reviewStep + 1} 轮已到期` : `下次 ${note.nextReviewDate.slice(5).replace("-", ".")} · 第 ${note.reviewStep + 1} 轮`;
    return `
      <div class="mistake-row" data-note-id="${escapeHtml(note.id)}">
        <span><b>${escapeHtml(note.subject)} · ${escapeHtml(note.source)}</b><small><em class="mistake-category ${note.category}">${categoryLabels[note.category] || "知识点盲区"}</em>${escapeHtml(note.reason)} · ${escapeHtml(reviewLabel)}</small></span>
        <span class="mistake-actions">${due ? '<button type="button" class="review-done-button"><i data-lucide="check"></i><span>完成复盘</span></button>' : ""}<button type="button" class="task-delete" title="删除标记"><i data-lucide="trash-2"></i></button></span>
      </div>`;
  }).join("");
}

function bindMistakeListButtons(refreshList) {
  $$(".mistake-row").forEach((row) => {
    $(".review-done-button", row)?.addEventListener("click", () => {
      const note = state.mistakeNotes.find((item) => item.id === row.dataset.noteId);
      if (!note) return;
      const nextStep = note.reviewStep + 1;
      if (nextStep >= REVIEW_INTERVALS.length) {
        note.reviewComplete = true;
        note.nextReviewDate = "";
      } else {
        note.reviewStep = nextStep;
        note.nextReviewDate = addDays(localDateKey(), REVIEW_INTERVALS[nextStep]);
      }
      saveState();
      refreshList();
      renderToday();
      showToast(note.reviewComplete ? "这道错题已完成四轮复盘" : `已安排下一轮复盘：${note.nextReviewDate}`);
    });
    $(".task-delete", row).addEventListener("click", () => {
      state.mistakeNotes = state.mistakeNotes.filter((note) => note.id !== row.dataset.noteId);
      saveState();
      refreshList();
      renderToday();
    });
  });
}
function openStageQualityDialog() {
  const q = state.stageQuality;
  showDialog({
    kicker: "阶段验收",
    title: "掌握度门槛",
    content: `
      <div class="callout">掌握度与内容进度分开：只有独立做题结果达到门槛，才算阶段质量过关。</div>
      <div class="form-grid" style="margin-top:14px">
        <div class="form-field"><label for="stage1-value">第一阶段当前正确率</label><input id="stage1-value" type="number" min="0" max="100" value="${q.stage1.value}"></div>
        <div class="form-field"><label for="stage1-target">第一阶段门槛</label><input id="stage1-target" type="number" min="1" max="100" value="${q.stage1.target}"></div>
        <div class="form-field"><label for="stage2-value">第二阶段当前正确率</label><input id="stage2-value" type="number" min="0" max="100" value="${q.stage2.value}"></div>
        <div class="form-field"><label for="stage2-target">第二阶段门槛</label><input id="stage2-target" type="number" min="1" max="100" value="${q.stage2.target}"></div>
        <div class="form-field"><label for="stage3-value">第三阶段真题当前分</label><input id="stage3-value" type="number" min="0" max="150" value="${q.stage3.value}"></div>
        <div class="form-field"><label for="stage3-target">第三阶段达标分</label><input id="stage3-target" type="number" min="1" max="150" value="${q.stage3.target}" placeholder="由你设置"></div>
      </div>
      <p class="form-help">第三阶段达标分不替你猜测，按正式试卷满分和你的目标自行填写。</p>
    `,
    actions: `<button type="button" class="secondary-button" data-dialog-close>取消</button><button type="button" class="primary-button" id="save-stage-quality">保存验收</button>`
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-stage-quality").addEventListener("click", () => {
    state.stageQuality = {
      stage1: { value: clamp(Number($("#stage1-value").value) || 0, 0, 100), target: clamp(Number($("#stage1-target").value) || 70, 1, 100), unit: "%" },
      stage2: { value: clamp(Number($("#stage2-value").value) || 0, 0, 100), target: clamp(Number($("#stage2-target").value) || 80, 1, 100), unit: "%" },
      stage3: { value: Math.max(0, Number($("#stage3-value").value) || 0), target: $("#stage3-target").value ? Math.max(1, Number($("#stage3-target").value)) : "", unit: "分" }
    };
    saveState();
    closeDialog();
    renderStageQuality();
    showToast("阶段掌握度已更新");
  });
}

function getWeekDates() {
  const today = startOfToday();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function buildWeeklySummary() {
  const dates = getWeekDates().filter((date) => date <= startOfToday());
  const dateKeys = new Set(dates.map(localDateKey));
  const subjectStats = {};
  let requiredTotal = 0;
  let requiredDone = 0;
  let studyMinutes = 0;
  let problems = 0;
  let chapters = 0;
  let readingTotal = 0;
  let readingWrong = 0;
  let discomfortDays = 0;
  dates.forEach((date) => {
    const daily = state.daily[localDateKey(date)];
    if (!daily) return;
    studyMinutes += getEffectiveStudyMinutes(daily);
    problems += (Number(daily.mathProblems) || 0) + (Number(daily.signalProblems) || 0);
    chapters += Number(daily.chapters) || 0;
    readingTotal += Number(daily.readingTotal) || 0;
    readingWrong += Number(daily.readingWrong) || 0;
    if (daily.statusMode !== "good") discomfortDays += 1;
    daily.tasks.forEach((task) => {
      if (task.kind === "care" || task.priority !== "required") return;
      requiredTotal += 1;
      if (isTaskComplete(task)) requiredDone += 1;
      if (!subjectStats[task.subject]) subjectStats[task.subject] = { total: 0, done: 0 };
      subjectStats[task.subject].total += 1;
      if (isTaskComplete(task)) subjectStats[task.subject].done += 1;
    });
  });
  const completion = requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 0;
  const subjectRows = Object.entries(subjectStats).map(([subject, value]) => ({ subject, completion: value.total ? Math.round((value.done / value.total) * 100) : 0 })).sort((a, b) => a.completion - b.completion);
  const lagging = subjectRows[0];
  const readingAccuracy = readingTotal ? Math.round(((readingTotal - readingWrong) / readingTotal) * 100) : null;
  const weeklyMistakes = state.mistakeNotes.filter((note) => dateKeys.has(note.date));
  const mistakeCounts = { calculation: 0, knowledge: 0, thinking: 0 };
  weeklyMistakes.forEach((note) => { if (mistakeCounts[note.category] !== undefined) mistakeCounts[note.category] += 1; });
  const mistakeTotal = weeklyMistakes.length;
  const mistakeBreakdown = Object.fromEntries(Object.entries(mistakeCounts).map(([key, value]) => [key, mistakeTotal ? Math.round((value / mistakeTotal) * 100) : 0]));
  const problem = lagging ? `${lagging.subject}完成率最低（${lagging.completion}%）` : "本周数据不足，先保持保底任务连续记录";
  const reason = lagging && lagging.completion < 70 ? "该科保底任务投入不足或任务量超过当天承载" : discomfortDays >= 2 ? "身体不适天数较多，高用眼任务被主动顺延" : "主线基本稳定，需要继续积累正确率数据";
  const suggestions = [];
  if (completion < 70) suggestions.push("下周先隐藏进阶任务，缩小必做范围直到保底完成率恢复。 ");
  if (lagging) suggestions.push(`${lagging.subject}每天增加 30 分钟保底投入，优先安排在对应学习块前部。`);
  if (mistakeBreakdown.knowledge >= 50) suggestions.push("知识盲区占比最高，先回看知识点和例题，再进行同类题复测。 ");
  if (mistakeBreakdown.thinking >= 40) suggestions.push("思路问题偏多，下周为高频题型整理标准解题步骤和模板。 ");
  if (discomfortDays >= 2) suggestions.push("本周不适天数较多，下周减少连续高用眼时段并保留两次护理。 ");
  if (!suggestions.length) suggestions.push("本周主线稳定，下周保持结构，只小幅提高章节正确率门槛。 ");
  return { dates, completion, studyMinutes, problems, chapters, readingAccuracy, subjectRows, lagging, mistakeBreakdown, mistakeTotal, problem, reason, suggestions };
}

function openWeeklyReviewDialog() {
  const summary = buildWeeklySummary();
  const mondayKey = localDateKey(summary.dates[0] || startOfToday());
  const savedNote = state.weeklyReviews[mondayKey]?.nextFocus || "";
  showDialog({
    kicker: startOfToday().getDay() === 0 ? "周日固定复盘" : "本周实时预览",
    title: "3分钟周度复盘",
    content: `
      <div class="weekly-summary-grid">
        <div><span>必做完成率</span><strong>${summary.completion}%</strong></div><div><span>净学习时长</span><strong>${formatCompactHours(summary.studyMinutes)}</strong></div><div><span>核心做题</span><strong>${summary.problems} 题</strong></div><div><span>推进章节</span><strong>${summary.chapters} 章</strong></div><div><span>阅读正确率</span><strong>${summary.readingAccuracy === null ? "待记录" : `${summary.readingAccuracy}%`}</strong></div>
      </div>
      <div class="dialog-section"><h3>各科必做完成率</h3><div class="score-list">${summary.subjectRows.map((row) => `<div class="score-row"><span>${escapeHtml(row.subject)}</span><strong>${row.completion}%</strong></div>`).join("") || '<div class="empty-state"><p>本周还没有任务记录。</p></div>'}</div></div>
      <div class="dialog-section"><h3>本周错题分析（${summary.mistakeTotal} 条）</h3><div class="mistake-breakdown"><span>计算失误 <b>${summary.mistakeBreakdown.calculation}%</b></span><span>知识盲区 <b>${summary.mistakeBreakdown.knowledge}%</b></span><span>思路问题 <b>${summary.mistakeBreakdown.thinking}%</b></span></div></div>
      <div class="dialog-section"><h3>系统诊断</h3><div class="weekly-diagnosis"><p><b>本周问题</b>${escapeHtml(summary.problem)}</p><p><b>可能原因</b>${escapeHtml(summary.reason)}</p></div></div>
      <div class="dialog-section"><h3>下周自动调整建议</h3><div class="callout amber-callout">${summary.suggestions.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div></div>
      <div class="form-field"><label for="weekly-next-focus">最终总结（只需填写这一项）</label><input id="weekly-next-focus" type="text" maxlength="120" value="${escapeHtml(savedNote)}" placeholder="例如：下周先守住数学、信号和单词三个保底任务"></div>
    `,
    actions: `<button type="button" class="secondary-button" data-dialog-close>关闭</button><button type="button" class="primary-button" id="save-weekly-review">保存周复盘</button>`
  });
  $("[data-dialog-close]").addEventListener("click", closeDialog);
  $("#save-weekly-review").addEventListener("click", () => {
    state.weeklyReviews[mondayKey] = { date: localDateKey(), completion: summary.completion, nextFocus: $("#weekly-next-focus").value.trim() };
    saveState(); closeDialog(); showToast("本周复盘已保存");
  });
}function openManualLogDialog() {
  const daily = getDaily();
  showDialog({
    kicker: "数据复盘",
    title: "补录今日数据",
    content: `
      <div class="form-grid">
        <div class="form-field">
          <label for="log-minutes">净学习分钟</label>
          <input id="log-minutes" type="number" min="0" max="1440" value="${getEffectiveStudyMinutes(daily)}">
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
        <div class="form-field">
          <label for="log-chapters">推进章节数</label>
          <input id="log-chapters" type="number" min="0" step="0.5" value="${daily.chapters}">
        </div>
        <div class="form-field">
          <label for="log-reading-total">英语阅读答题数</label>
          <input id="log-reading-total" type="number" min="0" value="${daily.readingTotal}">
        </div>
        <div class="form-field">
          <label for="log-reading-wrong">英语阅读错题数</label>
          <input id="log-reading-wrong" type="number" min="0" value="${daily.readingWrong}">
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
    daily.chapters = Math.max(0, Number($("#log-chapters").value) || 0);
    daily.readingTotal = Math.max(0, Number($("#log-reading-total").value) || 0);
    daily.readingWrong = clamp(Number($("#log-reading-wrong").value) || 0, 0, daily.readingTotal);
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
  const progress = timerTotal > 0 ? ((timerTotal - timerRemaining) / timerTotal) * 100 : 0;
  $("#timer-ring").style.setProperty("--timer-progress", `${progress}%`);
  $("#timer-status").textContent = timerRunning
    ? timerIsBreak ? "休息中" : `${$("#timer-subject").value}专注中`
    : timerRemaining < timerTotal ? "已暂停" : timerIsBreak ? "准备休息" : "准备开始";
  const startLabel = timerRemaining < timerTotal ? "继续计时" : timerIsBreak ? "开始休息" : "开始专注";
  $("#timer-toggle").innerHTML = timerRunning
    ? `<i data-lucide="pause"></i><span>暂停计时</span>`
    : `<i data-lucide="play"></i><span>${startLabel}</span>`;
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
  const completedWasBreak = timerIsBreak;
  if (!completedWasBreak) {
    getDaily().studyMinutes += minutes;
    saveState();
    renderToday();
    showToast(`完成 ${minutes} 分钟${$("#timer-subject").value}专注，已计入今日时长`);
  } else {
    showToast("休息结束，可以进入下一轮专注");
  }
  setTimeout(() => resetTimer(minutes, completedWasBreak), 800);
}

function resetTimer(minutes = Math.round(timerTotal / 60), isBreak = timerIsBreak) {
  clearInterval(timerInterval);
  timerRunning = false;
  timerIsBreak = Boolean(isBreak);
  const selected = clamp(Math.round(Number(minutes) || 50), 1, 720);
  timerTotal = selected * 60;
  timerRemaining = timerTotal;
  updateTimerDisplay();
}

function exportData() {
  state.settings.lastBackupDate = localDateKey();
  saveState();
  renderBackupReminder();
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
      applyTheme(state.settings.theme);
      saveState();
      renderAll();
      showToast("备份数据已导入");
    } catch {
      showToast("导入失败：文件格式不正确");
    }
  };
  reader.readAsText(file, "utf-8");
}

function syncMobilePageNav(pageId) {
  $$(".mobile-nav [data-mobile-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mobilePage === pageId);
  });
}

function navigateToMobilePage(pageId, behavior = "smooth") {
  const host = $("#mobile-pages");
  const page = document.getElementById(pageId);
  if (!host || !page) return false;
  host.scrollTo({ left: page.offsetLeft, behavior });
  syncMobilePageNav(pageId);
  return true;
}

function setupMobilePages() {
  if (mobilePagesReady || window.innerWidth > 860) return;
  const workspace = $(".workspace");
  const definitions = [
    { id: "mobile-page-overview", title: "总览", selectors: [".topbar", ".countdown-panel", ".metrics-strip", ".output-strip", ".quick-section"] },
    { id: "mobile-page-plan", title: "今日计划", selectors: ["#today-plan"] },
    { id: "mobile-page-focus", title: "专注计时", selectors: ["#focus-panel", ".target-panel"] },
    { id: "mobile-page-summer", title: "暑假战役", selectors: ["#summer-plan"] },
    { id: "mobile-page-progress", title: "进度复盘", selectors: ["#progress-panel", "footer"] }
  ];
  const host = document.createElement("div");
  host.id = "mobile-pages";
  host.className = "mobile-pages";
  definitions.forEach((definition) => {
    const page = document.createElement("section");
    page.id = definition.id;
    page.className = `mobile-page ${definition.id}`;
    page.setAttribute("aria-label", definition.id.replace("mobile-page-", ""));
    if (definition.id !== "mobile-page-overview") {
      const header = document.createElement("header");
      header.className = "mobile-page-header";
      header.innerHTML = `<h2>${definition.title}</h2><button type="button" class="icon-button subtle" data-open-settings aria-label="工作台设置" title="工作台设置"><i data-lucide="settings-2"></i></button>`;
      page.appendChild(header);
    }
    definition.selectors.forEach((selector) => {
      const node = $(selector);
      if (node) page.appendChild(node);
    });
    host.appendChild(page);
  });
  $(".main-grid")?.remove();
  workspace.prepend(host);
  renderIcons();
  mobilePagesReady = true;
  let scrollTimer = null;
  host.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const index = clamp(Math.round(host.scrollLeft / Math.max(1, host.clientWidth)), 0, definitions.length - 1);
      syncMobilePageNav(definitions[index].id);
    }, 70);
  }, { passive: true });
  syncMobilePageNav(definitions[0].id);
}
function bindNavigation() {
  $$("[data-mobile-page]").forEach((button) => {
    button.addEventListener("click", () => navigateToMobilePage(button.dataset.mobilePage));
  });
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
        if (!navigateToMobilePage("mobile-page-plan")) $("#today-plan").scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "timer") {
        if (!navigateToMobilePage("mobile-page-focus")) $("#focus-panel").scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (action === "overview") {
        if (!navigateToMobilePage("mobile-page-progress")) $("#progress-panel").scrollIntoView({ behavior: "smooth", block: "start" });
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
  $$('[data-open-settings]').forEach((button) => button.addEventListener("click", openSettingsDialog));
  $("#add-task-button").addEventListener("click", openAddTaskDialog);
  $("#manual-log-button").addEventListener("click", openManualLogDialog);
  $("#weekly-review-button").addEventListener("click", openWeeklyReviewDialog);
  $("#stage-quality-button").addEventListener("click", openStageQualityDialog);
  $("#export-button").addEventListener("click", exportData);
  $("#backup-now-button").addEventListener("click", exportData);
  $$("#status-mode button").forEach((button) => button.addEventListener("click", () => {
    getDaily().statusMode = button.dataset.status;
    saveState();
    renderToday();
    showToast("今日任务清单已按身体状态调整");
  }));
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
      if (timerRunning && !confirm("切换时长会重置当前计时，确定继续？")) return;
      const minutes = Number(button.dataset.minutes);
      const isBreak = button.dataset.kind === "break";
      $$("#timer-mode button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      if (!isBreak) {
        state.settings.customFocusMinutes = minutes;
        $("#custom-timer-minutes").value = minutes;
        saveState();
      }
      resetTimer(minutes, isBreak);
    });
  });

  const applyCustomTimer = () => {
    const input = $("#custom-timer-minutes");
    const rawMinutes = Number(input.value);
    if (!Number.isFinite(rawMinutes) || rawMinutes < 1 || rawMinutes > 720) {
      showToast("请输入 1 到 720 分钟之间的时长");
      input.focus();
      return;
    }
    if (timerRunning && !confirm("应用新时长会重置当前计时，确定继续？")) return;
    const minutes = Math.round(rawMinutes);
    input.value = minutes;
    $$("#timer-mode button").forEach((item) => item.classList.remove("active"));
    state.settings.customFocusMinutes = minutes;
    saveState();
    resetTimer(minutes, false);
    showToast(`本轮专注时长已设为 ${minutes} 分钟`);
  };

  $("#apply-custom-timer").addEventListener("click", applyCustomTimer);
  $("#custom-timer-minutes").addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyCustomTimer();
  });
  $("#timer-toggle").addEventListener("click", toggleTimer);
  $("#reset-timer-button").addEventListener("click", () => resetTimer());

  $("#app-dialog").addEventListener("click", (event) => {
    if (event.target === $("#app-dialog")) closeDialog();
  });
  $("#app-dialog").addEventListener("close", () => {
    document.documentElement.classList.remove("dialog-open");
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
    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      location.reload();
    });

    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {
      showToast("离线缓存注册失败，不影响本机数据保存");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedFocusMinutes = clamp(Number(state.settings.customFocusMinutes) || 50, 1, 720);
  $("#custom-timer-minutes").value = savedFocusMinutes;
  $$("#timer-mode button").forEach((button) => button.classList.remove("active"));
  const matchingPreset = $$("#timer-mode button").find((button) =>
    button.dataset.kind === "focus" && Number(button.dataset.minutes) === savedFocusMinutes
  );
  matchingPreset?.classList.add("active");
  timerIsBreak = false;
  timerTotal = savedFocusMinutes * 60;
  timerRemaining = timerTotal;
  renderAll();
  setupMobilePages();
  bindEvents();
  updateTimerDisplay();
  registerServiceWorker();
});
