// Test Runner 独立服务
// 端口 4176，与 ops-admin-lab (4175) 完全隔离
// 启动：node test-runner/server.js

const express = require("express");
const path    = require("path");
const fs      = require("fs/promises");
const { spawn } = require("child_process");

const app      = express();
const PORT     = Number(process.env.TR_PORT || 4176);
const trDir    = __dirname;                                      // test-runner/
const appDir   = path.resolve(trDir, "..");                      // ops-admin-lab/
const repoRoot = path.resolve(trDir, "../../../..");             // AutoFlow/
const APP_BASE_URL = process.env.OPS_ADMIN_LAB_URL || "http://127.0.0.1:4175";

const CURSOR_MODEL = "composer-2";
// 某些系统不支持 sandbox enabled；默认走兼容性更好的 disabled，可按需用环境变量覆盖。
const CURSOR_SANDBOX = process.env.TR_CURSOR_SANDBOX || "disabled";

app.use(express.json());

// 静态文件：test-runner UI 本身
app.use(express.static(trDir));

// 静态文件：Playwright HTML 报告
app.use("/playwright-report", express.static(path.join(appDir, "playwright-report")));

// ── GET /api/tr/spec/:name ─────────────────────────────────────
// 读取 tests/ 目录下的 spec 文件内容，返回纯文本
app.get("/api/tr/spec/:name", async (req, res) => {
  const file = path.join(appDir, "tests", path.basename(req.params.name));
  try {
    res.type("text").send(await fs.readFile(file, "utf8"));
  } catch {
    res.status(404).end();
  }
});

// ── POST /api/tr/run ──────────────────────────────────────────
// 用 cursor-agent 执行 playwright-fix-loop，SSE 实时推流
function buildFixLoopPrompt(testCmd) {
  return [
    "你是 AI 软件工程流程的执行代理，当前阶段：playwright 测试自动修复闭环。",
    "必须严格按以下 skills 方法执行：playwright-fix-loop。",
    "要求：输出结构化、可执行、简洁；若涉及代码改动，优先最小改动，并给出变更证据。",
    "",
    "在 archive/apps/ops-admin-lab 目录执行以下命令，循环直到全部通过：",
    testCmd
  ].join("\n");
}

async function probeAppService() {
  try {
    const response = await fetch(APP_BASE_URL, {
      signal: AbortSignal.timeout(1500)
    });
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

app.post("/api/tr/run", async (req, res) => {
  const { testArgs } = req.body;
  const safeArgs = typeof testArgs === "string" ? testArgs.trim() : "";
  const testCmd  = `cd archive/apps/ops-admin-lab && PLAYWRIGHT_HEADED=1 PLAYWRIGHT_SLOW_MO=800 npx playwright test${safeArgs ? " " + safeArgs : ""}`;
  const prompt   = buildFixLoopPrompt(testCmd);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (text) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  };

  const finish = () => {
    if (!res.writableEnded) {
      res.write("event: done\ndata: {}\n\n");
      res.end();
    }
  };

  send("[系统] 已收到执行请求，正在检查被测应用和 cursor-agent 启动环境...");

  const appProbe = await probeAppService();
  if (!appProbe.ok) {
    send(
      `[错误] 无法连接被测应用 ${APP_BASE_URL}。\n` +
      `请先确认 ops-admin-lab 已正常启动，再重试。\n` +
      `诊断信息：${appProbe.error}`
    );
    finish();
    return;
  }

  send(`[系统] 被测应用可访问（${APP_BASE_URL}，HTTP ${appProbe.status}），准备启动 cursor-agent...`);

  const child = spawn(
    "cursor-agent",
    [
      "-p",
      "--output-format", "stream-json",
      "--model",  CURSOR_MODEL,
      "--trust",
      "--force",
      "--sandbox", CURSOR_SANDBOX,
      "--workspace", repoRoot,
      prompt
    ],
    { cwd: repoRoot, env: process.env }
  );

  let sawAgentOutput = false;
  const markAgentOutput = () => {
    sawAgentOutput = true;
    clearTimeout(startupWarnTimer);
    clearInterval(startupHeartbeat);
  };

  const startupWarnTimer = setTimeout(() => {
    if (!sawAgentOutput) {
      send(
        "[提示] cursor-agent 已启动但暂未输出日志。通常是模型初始化、网络波动、登录状态失效，" +
        "或首次拉起需要更久时间。"
      );
    }
  }, 12000);

  const startupHeartbeat = setInterval(() => {
    if (!sawAgentOutput) {
      send("[提示] 仍在等待 cursor-agent 首条日志，请继续稍候...");
    }
  }, 20000);

  child.on("spawn", () => {
    send("[系统] cursor-agent 进程已启动，等待首条执行日志...");
  });

  child.stdout.on("data", (chunk) => {
    markAgentOutput();
    for (const line of chunk.toString().split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const j = JSON.parse(trimmed);
        if (j.type === "assistant" && Array.isArray(j.message?.content)) {
          for (const block of j.message.content) {
            if (block.type === "text" && block.text) send(block.text);
          }
        }
        if (j.type === "tool_call") {
          const shellCall = j.tool_call?.shellToolCall;
          const description = shellCall?.description || j.tool_call?.description;
          if (j.subtype === "started" && description) {
            send(`\n## 工具执行\n${description}\n`);
          }
          if (j.subtype === "completed") {
            const success = shellCall?.result?.success;
            const failure = shellCall?.result?.failure;
            const output = success?.interleavedOutput || failure?.interleavedOutput;
            if (output) {
              send(`\n## 原始命令输出\n${output}\n`);
            }
          }
        }
      } catch { send(trimmed); }
    }
  });

  child.stderr.on("data", (chunk) => {
    markAgentOutput();
    send(chunk.toString());
  });

  child.on("close", (code) => {
    clearTimeout(startupWarnTimer);
    clearInterval(startupHeartbeat);
    if (!sawAgentOutput && code !== 0) {
      send(
        `[错误] cursor-agent 在输出任何日志前退出了（exit ${code}）。\n` +
        "请检查 Cursor 登录状态、网络连通性，以及终端里能否直接运行 cursor-agent。"
      );
    }
    send(`\n── 完成，exit ${code} ──`);
    finish();
  });

  child.on("error", (err) => {
    clearTimeout(startupWarnTimer);
    clearInterval(startupHeartbeat);
    const detail = err.code === "ENOENT"
      ? "未找到 cursor-agent 命令，请确认 Cursor CLI 已安装且当前终端可直接执行 cursor-agent。"
      : err.message;
    send(`\n[错误] 无法启动 cursor-agent：${detail}`);
    finish();
  });

  // 监听响应侧断开（客户端关闭），避免误 kill child
  res.on("close", () => {
    if (!res.writableEnded && !child.killed) child.kill("SIGTERM");
  });
});

// ── 健康检查 ──────────────────────────────────────────────────
app.get("/api/tr/health", (_req, res) => {
  res.json({ ok: true, service: "test-runner", port: PORT });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Test Runner 已启动：http://127.0.0.1:${PORT}`);
  console.log(`  UI:     http://127.0.0.1:${PORT}/`);
  console.log(`  Report: http://127.0.0.1:${PORT}/playwright-report/`);
});
