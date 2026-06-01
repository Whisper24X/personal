const SPEC_FILES = [
  { file: "admin-flows.spec.js", label: "管理后台流程" },
  { file: "ui-regressions.spec.js", label: "UI 回归" },
  { file: "api-flows.spec.js", label: "API 接口" }
];

const SCROLL_THRESHOLD = 200;
const FILE_COLLAPSE = new Set();
const GROUP_COLLAPSE = new Set();

const state = {
  specTree: [],
  selected: {},
  running: false,
  userScrolledUp: false,
  lastRunLabel: "尚未执行",
  lastRunUpdatedAt: "等待初始化",
  serviceHealthy: false
};

const dom = {
  treeBody: document.getElementById("tree-body"),
  selSummary: document.getElementById("sel-summary"),
  treeSummarySelected: document.getElementById("tree-summary-selected"),
  treeSummarySpecs: document.getElementById("tree-summary-specs"),
  statFiles: document.getElementById("stat-files"),
  statSelected: document.getElementById("stat-selected"),
  statMode: document.getElementById("stat-mode"),
  statUpdated: document.getElementById("stat-updated"),
  healthPill: document.getElementById("health-pill"),
  runBadge: document.getElementById("run-badge"),
  runContext: document.getElementById("run-context"),
  logWrap: document.getElementById("log-wrap"),
  logIdle: document.getElementById("log-idle"),
  logConnecting: document.getElementById("log-connecting"),
  logContent: document.getElementById("log-content"),
  logStatus: document.getElementById("log-status"),
  statusText: document.getElementById("status-text"),
  reportLink: document.getElementById("report-link"),
  scrollBtn: document.getElementById("scroll-btn"),
  btnTheme: document.getElementById("btn-theme"),
  btnSelectAll: document.getElementById("btn-select-all"),
  btnDeselectAll: document.getElementById("btn-deselect-all"),
  btnRunAll: document.getElementById("btn-run-all"),
  btnRunSelected: document.getElementById("btn-run-selected"),
  dockSelection: document.getElementById("dock-selection")
};

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function markUpdated() {
  state.lastRunUpdatedAt = `${formatTime()} 更新`;
}

function parseSpec(content) {
  const groups = [];
  let current = null;

  for (const line of content.split("\n")) {
    const describeMatch = line.match(/test\.describe\s*\(\s*["'`](.+?)["'`]/);
    if (describeMatch) {
      current = { describe: describeMatch[1], tests: [] };
      groups.push(current);
      continue;
    }

    const testMatch = line.match(/^\s+test\s*\(\s*["'`](.+?)["'`]/);
    if (testMatch && current) {
      current.tests.push(testMatch[1]);
    }
  }

  return groups;
}

function initSelected(tree) {
  state.selected = {};

  tree.forEach(({ file, groups }) => {
    state.selected[file] = {};
    groups.forEach(({ describe, tests }) => {
      state.selected[file][describe] = {};
      tests.forEach((testName) => {
        state.selected[file][describe][testName] = true;
      });
    });
  });
}

function countAll() {
  let total = 0;
  let checked = 0;

  state.specTree.forEach(({ file, groups }) => {
    groups.forEach(({ describe, tests }) => {
      tests.forEach((testName) => {
        total += 1;
        if (state.selected[file][describe][testName]) {
          checked += 1;
        }
      });
    });
  });

  return { total, checked };
}

function getSelectionMode(checked, total) {
  if (total === 0) return "等待载入";
  if (checked === 0) return "未选择测试";
  if (checked === total) return "执行全部测试";
  return `执行 ${checked} 个选中测试`;
}

function updateSummary() {
  const { total, checked } = countAll();
  const selectedLabel = `${checked} / ${total || 0}`;

  dom.selSummary.innerHTML = `已选 <b>${selectedLabel}</b>`;
  dom.treeSummarySelected.textContent = `${checked}`;
  dom.treeSummarySpecs.textContent = `${state.specTree.length}`;
  if (dom.statFiles) dom.statFiles.textContent = `${state.specTree.length}`;
  if (dom.statSelected) dom.statSelected.textContent = `${checked}`;
  if (dom.statMode) dom.statMode.textContent = state.running ? "运行中" : getSelectionMode(checked, total);
  if (dom.statUpdated) dom.statUpdated.textContent = state.lastRunUpdatedAt;
  dom.dockSelection.textContent = checked === 0
    ? "当前未选择任何测试"
    : `当前已选择 ${checked} / ${total} 个测试`;

  dom.btnRunSelected.disabled = state.running || checked === 0;
  dom.btnRunAll.disabled = state.running || total === 0;
}

function getFileState(file) {
  let on = 0;
  let total = 0;

  state.specTree.find((item) => item.file === file)?.groups.forEach(({ describe, tests }) => {
    tests.forEach((testName) => {
      total += 1;
      if (state.selected[file][describe][testName]) on += 1;
    });
  });

  if (on === 0) return "none";
  if (on === total) return "all";
  return "partial";
}

function getDescribeState(file, describe) {
  const tests = state.specTree.find((item) => item.file === file)
    ?.groups.find((group) => group.describe === describe)?.tests || [];
  const on = tests.filter((testName) => state.selected[file][describe][testName]).length;

  if (on === 0) return "none";
  if (on === tests.length) return "all";
  return "partial";
}

function applyCheckboxState(checkbox, status) {
  checkbox.checked = status === "all";
  checkbox.indeterminate = status === "partial";
}

function createCollapseButton(collapsed, onToggle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "collapse-btn" + (collapsed ? " collapsed" : "");
  button.textContent = "▾";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle();
  });
  return button;
}

function createLabelText(text, className, title) {
  const wrapper = document.createElement("span");
  wrapper.className = "tree-text";

  const label = document.createElement("span");
  label.className = className;
  label.textContent = text;
  if (title) label.title = title;

  wrapper.appendChild(label);
  return wrapper;
}

function createCountBubble(count) {
  const bubble = document.createElement("span");
  bubble.className = "tree-count";
  bubble.textContent = String(count);
  return bubble;
}

function renderTree() {
  dom.treeBody.innerHTML = "";

  if (state.specTree.length === 0) {
    dom.treeBody.innerHTML = '<div class="log-empty">暂未发现可用的 spec 文件</div>';
    updateSummary();
    return;
  }

  state.specTree.forEach(({ file, label, groups }) => {
    const fileWrap = document.createElement("div");
    fileWrap.className = "spec-file";

    const fileRow = document.createElement("div");
    fileRow.className = "tree-row tree-row-file";

    const fileKey = file;
    const fileCollapsed = FILE_COLLAPSE.has(fileKey);
    const totalTests = groups.reduce((sum, group) => sum + group.tests.length, 0);

    const fileCollapseBtn = createCollapseButton(fileCollapsed, () => {
      if (FILE_COLLAPSE.has(fileKey)) FILE_COLLAPSE.delete(fileKey);
      else FILE_COLLAPSE.add(fileKey);
      renderTree();
    });
    fileRow.appendChild(fileCollapseBtn);

    const fileCheckbox = document.createElement("input");
    fileCheckbox.type = "checkbox";
    applyCheckboxState(fileCheckbox, getFileState(file));
    fileCheckbox.addEventListener("change", () => {
      const nextChecked = fileCheckbox.checked;
      groups.forEach(({ describe, tests }) => {
        tests.forEach((testName) => {
          state.selected[file][describe][testName] = nextChecked;
        });
      });
      markUpdated();
      renderTree();
      updateSummary();
    });
    fileRow.appendChild(fileCheckbox);
    fileRow.appendChild(createLabelText(label, "tree-name tree-file-name", file));
    fileRow.appendChild(createCountBubble(totalTests));
    fileWrap.appendChild(fileRow);

    const fileChildren = document.createElement("div");
    fileChildren.className = "tree-children" + (fileCollapsed ? " hidden" : "");

    groups.forEach(({ describe, tests }) => {
      const groupRow = document.createElement("div");
      groupRow.className = "tree-row tree-row-group";

      const groupKey = `${file}::${describe}`;
      const groupCollapsed = GROUP_COLLAPSE.has(groupKey);

      const groupCollapseBtn = createCollapseButton(groupCollapsed, () => {
        if (GROUP_COLLAPSE.has(groupKey)) GROUP_COLLAPSE.delete(groupKey);
        else GROUP_COLLAPSE.add(groupKey);
        renderTree();
      });
      groupRow.appendChild(groupCollapseBtn);

      const groupCheckbox = document.createElement("input");
      groupCheckbox.type = "checkbox";
      applyCheckboxState(groupCheckbox, getDescribeState(file, describe));
      groupCheckbox.addEventListener("change", () => {
        const nextChecked = groupCheckbox.checked;
        tests.forEach((testName) => {
          state.selected[file][describe][testName] = nextChecked;
        });
        markUpdated();
        renderTree();
        updateSummary();
      });
      groupRow.appendChild(groupCheckbox);
      groupRow.appendChild(createLabelText(describe, "tree-name tree-group-name", describe));
      groupRow.appendChild(createCountBubble(tests.length));
      fileChildren.appendChild(groupRow);

      const groupChildren = document.createElement("div");
      groupChildren.className = "tree-children" + (groupCollapsed ? " hidden" : "");

      tests.forEach((testName) => {
        const testRow = document.createElement("label");
        testRow.className = "tree-row tree-row-test" + (state.selected[file][describe][testName] ? " tree-item-checked" : "");

        const spacer = document.createElement("span");
        spacer.style.width = "24px";
        spacer.style.flexShrink = "0";
        testRow.appendChild(spacer);

        const testCheckbox = document.createElement("input");
        testCheckbox.type = "checkbox";
        testCheckbox.checked = Boolean(state.selected[file][describe][testName]);
        testCheckbox.addEventListener("change", (event) => {
          state.selected[file][describe][testName] = event.target.checked;
          markUpdated();
          renderTree();
          updateSummary();
        });
        testRow.appendChild(testCheckbox);
        testRow.appendChild(createLabelText(testName, "tree-name tree-test-name", testName));
        groupChildren.appendChild(testRow);
      });

      fileChildren.appendChild(groupChildren);
    });

    fileWrap.appendChild(fileChildren);
    dom.treeBody.appendChild(fileWrap);
  });

  updateSummary();
}

function buildTestArgs() {
  const { total, checked } = countAll();
  if (checked === total) return "";

  const fileMap = {};

  state.specTree.forEach(({ file, groups }) => {
    groups.forEach(({ describe, tests }) => {
      tests.forEach((testName) => {
        if (state.selected[file][describe][testName]) {
          if (!fileMap[file]) fileMap[file] = [];
          fileMap[file].push(testName);
        }
      });
    });
  });

  const files = Object.keys(fileMap);
  const allTests = files.flatMap((file) => fileMap[file]);

  if (files.length === 1) {
    const file = files[0];
    const totalInFile = state.specTree.find((item) => item.file === file)
      .groups.flatMap((group) => group.tests).length;

    if (fileMap[file].length === totalInFile) {
      return `tests/${file}`;
    }
  }

  const pattern = allTests
    .map((testName) => testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return `--grep "(${pattern})"`;
}

function setupScrollTracking() {
  dom.logWrap.addEventListener("scroll", () => {
    const dist = dom.logWrap.scrollHeight - dom.logWrap.scrollTop - dom.logWrap.clientHeight;
    state.userScrolledUp = dist > SCROLL_THRESHOLD;
    dom.scrollBtn.style.display = state.userScrolledUp ? "inline-flex" : "none";
  }, { passive: true });

  dom.scrollBtn.addEventListener("click", () => {
    dom.logWrap.scrollTo({ top: dom.logWrap.scrollHeight, behavior: "smooth" });
    state.userScrolledUp = false;
    dom.scrollBtn.style.display = "none";
  });
}

function autoScroll() {
  if (state.userScrolledUp) return;
  dom.logWrap.scrollTop = dom.logWrap.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (/✗|×|✕|FAILED|failed|Error:|error:|错误|exit [1-9]|[Ee]rror\b/.test(trimmed)) return "log-err";
  if (/✓|✔|PASSED|passed|通过|completed|全绿|[0-9]+ passed/.test(trimmed)) return "log-ok";
  if (/warn|WARN|⚠|Warning/.test(trimmed)) return "log-warn";
  if (/^──|^##|^###|^={3,}|^-{3,}/.test(trimmed)) return "log-head";
  if (/^\s*at |^\s*\d+\s*\|/.test(trimmed)) return "log-dim";
  return "";
}

function normalizeLogText(text) {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n");
}

function shouldHideLogLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  return [
    /^## 工具执行$/,
    /^## 原始命令输出$/,
    /NO_COLOR/,
    /FORCE_COLOR/,
    /trace-warnings/,
    /^Error Context:/,
    /test-results\//,
    /playwright-report\//,
    /^Call log:$/,
    /^Locator:/
  ].some((pattern) => pattern.test(trimmed));
}

function filterLogText(text) {
  const filteredLines = [];
  let lastWasBlank = false;

  for (const line of text.split("\n")) {
    if (shouldHideLogLine(line)) {
      continue;
    }

    const isBlank = line.trim() === "";
    if (isBlank && lastWasBlank) {
      continue;
    }

    filteredLines.push(line);
    lastWasBlank = isBlank;
  }

  return filteredLines.join("\n").trimEnd();
}

function appendText(text) {
  if (!text) return;

  const normalizedText = filterLogText(normalizeLogText(text));
  if (!normalizedText) return;

  if (dom.logContent.style.display !== "block") {
    dom.logConnecting.style.display = "none";
    dom.logIdle.style.display = "none";
    dom.logContent.style.display = "block";
    dom.statusText.innerHTML = '<span class="spinner"></span> cursor agent 执行中...';
  }

  const html = normalizedText.split("\n").map((line, index, lines) => {
    const className = classifyLine(line);
    const safe = escapeHtml(line);
    const suffix = index < lines.length - 1 ? "\n" : "";
    return className
      ? `<span class="log-line ${className}">${safe}</span>${suffix}`
      : safe + suffix;
  }).join("");

  dom.logContent.innerHTML += html;
  autoScroll();
}

function updateHealthPill(ok, text) {
  if (!dom.healthPill) return;
  dom.healthPill.className = "status-pill";
  dom.healthPill.classList.add(ok ? "status-pill-ok" : "status-pill-warn");
  dom.healthPill.textContent = text;
  state.serviceHealthy = ok;
}

async function loadHealth() {
  updateHealthPill(false, "服务检查中");
  try {
    const response = await fetch("/api/tr/health");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    updateHealthPill(true, `${data.service} · ${data.port}`);
  } catch (_error) {
    if (dom.healthPill) {
      dom.healthPill.className = "status-pill status-pill-err";
      dom.healthPill.textContent = "服务不可用";
    }
  }
}

function updateRunMeta(testArgs) {
  const { total, checked } = countAll();
  state.lastRunLabel = !testArgs
    ? `本次执行：全部 ${total} 个测试`
    : `本次执行：${checked} 个选中测试`;
  state.lastRunUpdatedAt = `${formatTime()} 开始`;
  dom.runContext.textContent = state.lastRunLabel;
}

function onRunDone(isErr) {
  state.running = false;

  if (dom.logContent.style.display !== "block") {
    dom.logConnecting.style.display = "none";
    dom.logIdle.style.display = "none";
    dom.logContent.style.display = "block";
    dom.logContent.innerHTML = isErr
      ? '<span class="log-line log-err">[错误] 未收到任何输出</span>'
      : '<span class="log-line log-dim">[完成] 未产生输出</span>';
  }

  const logText = dom.logContent.innerText;
  const exitOk = !isErr
    && !logText.includes("exit 1")
    && !logText.includes("exit 2")
    && !logText.includes("exit 127")
    && !logText.includes("[错误]");

  dom.runBadge.innerHTML = exitOk
    ? '<span class="badge badge-ok">完成</span>'
    : '<span class="badge badge-err">失败 / 中断</span>';
  dom.statusText.innerHTML = exitOk
    ? '<span style="color:var(--ok)">OK</span> 执行完成，可查看报告'
    : '<span style="color:var(--err)">ERR</span> 执行结束，存在失败或错误';
  dom.reportLink.innerHTML = '<a class="btn btn-report" href="/playwright-report/" target="_blank" rel="noreferrer">查看 HTML 报告</a>';
  state.lastRunUpdatedAt = `${formatTime()} 完成`;

  updateSummary();
  renderTree();
  autoScroll();
}

function startRun(testArgs) {
  if (state.running) return;

  state.running = true;
  state.userScrolledUp = false;
  updateRunMeta(testArgs);

  dom.logIdle.style.display = "none";
  dom.logConnecting.style.display = "flex";
  dom.logContent.style.display = "none";
  dom.logContent.textContent = "";
  dom.logStatus.style.display = "flex";
  dom.scrollBtn.style.display = "none";
  dom.reportLink.innerHTML = "";
  dom.runBadge.innerHTML = '<span class="badge badge-run">运行中</span>';
  dom.statusText.innerHTML = '<span class="spinner"></span> cursor agent 启动中...';

  updateSummary();
  renderTree();

  let buffer = "";
  let isDone = false;
  let receivedStreamText = false;

  const slowStartTimer = setTimeout(() => {
    if (!receivedStreamText && !isDone) {
      dom.statusText.innerHTML = "<span style=\"color:var(--warn)\">等待中</span> agent 启动较慢，通常是模型初始化、网络或登录状态导致";
    }
  }, 8000);

  const stalledTimer = setTimeout(() => {
    if (!receivedStreamText && !isDone) {
      dom.statusText.innerHTML = "<span style=\"color:var(--err)\">仍未收到日志</span> 请检查被测应用是否可访问、Cursor 是否在线，以及 cursor-agent 是否可用";
    }
  }, 18000);

  function flushChunk(chunk) {
    const lines = chunk.split("\n");
    let eventType;
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      const raw = dataLines.join("\n");
      try {
        const payload = JSON.parse(raw);
        if (payload.text !== undefined) {
          receivedStreamText = true;
          clearTimeout(slowStartTimer);
          clearTimeout(stalledTimer);
          appendText(payload.text);
        }
      } catch {
        receivedStreamText = true;
        clearTimeout(slowStartTimer);
        clearTimeout(stalledTimer);
        appendText(raw);
      }
    }

    if (eventType === "done") finish(false);
  }

  function finish(isErr) {
    if (isDone) return;
    isDone = true;
    clearTimeout(slowStartTimer);
    clearTimeout(stalledTimer);
    onRunDone(isErr);
  }

  fetch("/api/tr/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testArgs })
  }).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("响应体为空");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary).trim();
        if (chunk) flushChunk(chunk);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }

    const remain = buffer.trim();
    if (remain) flushChunk(remain);
    finish(false);
  }).catch((error) => {
    appendText(`\n[网络错误] ${error.message}`);
    finish(true);
  });
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  dom.btnTheme.textContent = theme === "light" ? "切到暗色" : "切到浅色";
  dom.btnTheme.title = theme === "light" ? "切换到暗色模式" : "切换到浅色模式";
  localStorage.setItem("tr-theme", theme);
}

function bindActions() {
  dom.btnTheme.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "light" ? "dark" : "light");
  });

  dom.btnSelectAll.addEventListener("click", () => {
    state.specTree.forEach(({ file, groups }) => {
      groups.forEach(({ describe, tests }) => {
        tests.forEach((testName) => {
          state.selected[file][describe][testName] = true;
        });
      });
    });
    markUpdated();
    renderTree();
  });

  dom.btnDeselectAll.addEventListener("click", () => {
    state.specTree.forEach(({ file, groups }) => {
      groups.forEach(({ describe, tests }) => {
        tests.forEach((testName) => {
          state.selected[file][describe][testName] = false;
        });
      });
    });
    markUpdated();
    renderTree();
  });

  dom.btnRunAll.addEventListener("click", () => {
    state.specTree.forEach(({ file, groups }) => {
      groups.forEach(({ describe, tests }) => {
        tests.forEach((testName) => {
          state.selected[file][describe][testName] = true;
        });
      });
    });
    renderTree();
    startRun("");
  });

  dom.btnRunSelected.addEventListener("click", () => {
    startRun(buildTestArgs());
  });
}

async function loadSpecs() {
  const results = await Promise.allSettled(
    SPEC_FILES.map(({ file }) =>
      fetch(`/api/tr/spec/${file}`).then((response) => response.ok ? response.text() : Promise.reject(response.status))
    )
  );

  state.specTree = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      state.specTree.push({
        file: SPEC_FILES[index].file,
        label: SPEC_FILES[index].label,
        groups: parseSpec(result.value)
      });
    }
  });

  initSelected(state.specTree);
  markUpdated();
  dom.runContext.textContent = state.lastRunLabel;
  renderTree();
}

async function bootstrap() {
  const savedTheme = localStorage.getItem("tr-theme") || "dark";
  applyTheme(savedTheme);
  bindActions();
  setupScrollTracking();
  updateSummary();
  await Promise.all([loadHealth(), loadSpecs()]);
}

bootstrap().catch((error) => {
  dom.treeBody.innerHTML = `<div class="log-empty">加载失败：${escapeHtml(error.message)}</div>`;
  if (dom.healthPill) {
    dom.healthPill.className = "status-pill status-pill-err";
    dom.healthPill.textContent = "初始化失败";
  }
});
