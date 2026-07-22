import { CONFIG_DEFAULTS, readConfig } from "./config";

describe("readConfig", () => {
  it("enables product and quality agents by default and allows explicit zero", () => {
    const defaultConfig = readConfig({});
    const disabledConfig = readConfig({ DITING_SCHEDULER_PRODUCT_AGENT_COUNT: "0" });
    const disabledQualityConfig = readConfig({ DITING_SCHEDULER_QUALITY_AGENT_COUNT: "0" });

    expect(defaultConfig.scheduler.agents.product.count).toBe(1);
    expect(defaultConfig.scheduler.agents.quality.count).toBe(1);
    expect(disabledConfig.scheduler.agents.product.count).toBe(0);
    expect(disabledQualityConfig.scheduler.agents.quality.count).toBe(0);
  });

  it("reads structured config groups from env", () => {
    const config = readConfig({
      BACKEND_PORT: "4100",
      DITING_SCHEDULER_INTERVAL_MS: "45000",
      DITING_SCHEDULER_AGENT_COUNT: "4",
      DITING_SCHEDULER_PRODUCT_AGENT_COUNT: "1",
      DITING_SCHEDULER_QUALITY_AGENT_COUNT: "2",
      DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS: "610000",
      DITING_AGENT_WORKER_POLL_INTERVAL_MS: "1500",
      DITING_WORKSPACE_ROOT: "./tmp/workspaces",
      DITING_WORKSPACE_REPO_CACHE_ROOT: "./tmp/repos",
      DITING_WORKSPACE_CLEANUP_ON_SUCCESS: "false",
      DITING_WORKSPACE_CLEANUP_ON_FAILURE: "true",
      DITING_GOAL_EXECUTION_TIMEOUT_MS: "120000",
      DITING_GOAL_EXECUTION_IDLE_TIMEOUT_MS: "150000",
      DITING_GOAL_QUALITY_TIMEOUT_MS: "240000",
      DITING_GOAL_ENVIRONMENT_RETRY_LIMIT: "5",
      DITING_GOAL_EXECUTION_RETRY_LIMIT: "4",
      DITING_GOAL_MAX_REPAIR_ITERATIONS: "7",
      DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP: "true",
      DITING_PLUGIN_TASK_INTEGRATION_PACKAGE: "@demo/task-integration-plugin",
      DITING_PLUGIN_EXECUTION_PACKAGE: "@demo/execution-plugin",
      DITING_DEFAULT_EXECUTOR: "cursor",
      DITING_PLUGIN_EXECUTION_CODEX_BIN: "codex-dev",
      DITING_PLUGIN_EXECUTION_CURSOR_BIN: "cursor-dev",
      DITING_PR_COMMIT_MESSAGE_AGENT: "cursor",
      DITING_PLUGIN_PRODUCT_AGENT_DEFAULT_RUNTIME: "cursor",
      DITING_PLUGIN_QUALITY_AGENT_DEFAULT_RUNTIME: "cursor",
      DITING_OPENSPEC_REVIEW_GATE_ENABLED: "false",
      DITING_OPENSPEC_REVIEW_PREFIX_APPROVED: "【通过】",
      DITING_OPENSPEC_REVIEW_PREFIX_CHANGES_REQUESTED: "【修改】",
      DITING_OPENSPEC_REVIEW_PREFIX_DISMISSED: "【关闭】",
      DITING_PLUGIN_ENVIRONMENT_PACKAGE: "@demo/environment-plugin",
      DITING_PLUGIN_QUALITY_PACKAGE: "@demo/quality-plugin",
      DITING_PLUGIN_OBSERVABILITY_GOVERNANCE_PACKAGE: "@demo/governance-plugin",
      DITING_PLUGIN_LOG_PACKAGE: "@demo/log-plugin",
      DITING_PLUGIN_MEEGLE_MODE: "polling",
      DITING_PLUGIN_MEEGLE_TASKS_FILE: "./tasks.json",
      DITING_PLUGIN_MEEGLE_RESULTS_FILE: "./results.json",
      GITLAB_CLI_BIN: "glab-dev",
      DITING_GITLAB_HOST: "gitlab.example.com",
      DITING_GOVERNANCE_ALLOW_COMMAND_PREFIXES: "codex,agent",
      DITING_GOVERNANCE_BLOCK_COMMAND_PATTERNS: "git\\s+push,rm\\s+-rf",
      DITING_GOVERNANCE_MAX_PROMPT_CHARS: "8000",
      DITING_GOVERNANCE_MAX_OUTPUT_CHARS: "9000",
      DITING_GOVERNANCE_MAX_FILES_CHANGED: "11",
      DITING_GOVERNANCE_MAX_DIFF_LINES: "222"
    });

    expect(config).toEqual(expect.objectContaining({
      port: 4100,
      scheduler: expect.objectContaining({
        intervalMs: 45_000,
        agentCount: 4,
        agentOfflineTimeoutMs: 610_000,
        agentWorkerPollIntervalMs: 1_500,
        agents: expect.objectContaining({
          programming: expect.objectContaining({
            count: 4,
            offlineTimeoutMs: 610_000,
            workerPollIntervalMs: 1_500
          }),
          product: expect.objectContaining({
            count: 1,
            offlineTimeoutMs: 610_000,
            workerPollIntervalMs: 1_500
          }),
          quality: expect.objectContaining({
            count: 2,
            offlineTimeoutMs: 610_000,
            workerPollIntervalMs: 1_500
          })
        })
      }),
      workspace: expect.objectContaining({
        root: expect.stringContaining("tmp/workspaces"),
        repoCacheRoot: expect.stringContaining("tmp/repos"),
        cleanupOnSuccess: false,
        cleanupOnFailure: true
      }),
      goalRecovery: expect.objectContaining({
        executionTimeoutMs: 120_000,
        executionIdleTimeoutMs: 150_000,
        qualityTimeoutMs: 240_000,
        environmentRetryLimit: 5,
        executionRetryLimit: 4,
        maxRepairIterations: 7,
        enableNeedsHumanLoop: true
      }),
      plugins: expect.objectContaining({
        taskIntegration: {
          packageName: "@demo/task-integration-plugin"
        },
        execution: {
          packageName: "@demo/execution-plugin",
          defaultExecutor: "cursor",
          codexBin: "codex-dev",
          cursorBin: "cursor-dev",
          commitMessageAgent: "cursor"
        },
        agents: expect.objectContaining({
          packageName: "@demo/execution-plugin",
          defaultKind: "programming",
          defaultRuntime: "cursor",
          product: expect.objectContaining({
            defaultDriver: "openspec-product",
            defaultRuntime: "cursor"
          }),
          quality: expect.objectContaining({
            defaultDriver: "quality-orchestrator",
            defaultRuntime: "cursor"
          }),
          codexBin: "codex-dev",
          cursorBin: "cursor-dev",
          commitMessageAgent: "cursor"
        }),
        environment: {
          packageName: "@demo/environment-plugin"
        },
        quality: {
          packageName: "@demo/quality-plugin"
        },
        observabilityGovernance: {
          packageName: "@demo/governance-plugin"
        },
        log: {
          packageName: "@demo/log-plugin"
        },
        meegle: expect.objectContaining({
          mode: "polling",
          tasksFile: "./tasks.json",
          resultsFile: "./results.json",
          webhookSecret: null,
          sourceMode: null,
          cliBin: "meegle"
        }),
        gitlab: {
          cliBin: "glab-dev",
          host: "gitlab.example.com"
        }
      }),
      openspecReview: expect.objectContaining({
        gateEnabled: false,
        prefixes: {
          approved: "【通过】",
          changesRequested: "【修改】",
          dismissed: "【关闭】"
        }
      }),
      governance: expect.objectContaining({
        allowCommandPrefixes: ["codex", "agent"],
        blockCommandPatterns: ["git\\s+push", "rm\\s+-rf"],
        maxPromptChars: 8000,
        maxOutputChars: 9000,
        maxFilesChanged: 11,
        maxDiffLines: 222
      })
    }));
  });

  it("supports legacy env names as fallback", () => {
    const config = readConfig({
      DITING_AGENT_COUNT: "3",
      DITING_AGENT_OFFLINE_TIMEOUT_MS: "123000",
      DITING_REPO_CACHE_ROOT: "./legacy-repos",
      DITING_CLEANUP_ON_SUCCESS: "0",
      DITING_CLEANUP_ON_FAILURE: "1",
      DITING_EXECUTION_TIMEOUT_MS: "99000",
      DITING_QUALITY_TIMEOUT_MS: "88000",
      DITING_MEEGLE_TASKS_FILE: "./legacy-tasks.json",
      DITING_MEEGLE_RESULTS_FILE: "./legacy-results.json",
      CODEX_CLI_BIN: "codex-legacy",
      CURSOR_CLI_BIN: "agent-legacy",
      DITING_PLUGIN_EXECUTION_DEFAULT_EXECUTOR: "cursor"
    });

    expect(config.scheduler.agentCount).toBe(3);
    expect(config.scheduler.agentOfflineTimeoutMs).toBe(123_000);
    expect(config.workspace.repoCacheRoot).toContain("legacy-repos");
    expect(config.workspace.cleanupOnSuccess).toBe(false);
    expect(config.workspace.cleanupOnFailure).toBe(true);
    expect(config.goalRecovery.executionTimeoutMs).toBe(99_000);
    expect(config.goalRecovery.qualityTimeoutMs).toBe(88_000);
    expect(config.goalRecovery.enableNeedsHumanLoop).toBe(false);
    expect(config.plugins.meegle.tasksFile).toBe("./legacy-tasks.json");
    expect(config.plugins.execution.defaultExecutor).toBe("cursor");
    expect(config.plugins.execution.packageName).toBeNull();
    expect(config.plugins.execution.codexBin).toBe("codex-legacy");
    expect(config.plugins.execution.cursorBin).toBe("agent-legacy");
    expect(config.plugins.execution.commitMessageAgent).toBe(CONFIG_DEFAULTS.plugins.execution.commitMessageAgent);
    expect(config.plugins.agents.defaultRuntime).toBe("cursor");
    expect(config.plugins.agents.packageName).toBeNull();
  });

  it("keeps the new agent defaults independent from legacy execution defaults", () => {
    const config = readConfig({
      DITING_DEFAULT_EXECUTOR: "codex",
      DITING_PLUGIN_AGENT_PACKAGE: "@demo/agent-plugin",
      DITING_PLUGIN_AGENT_DEFAULT_RUNTIME: "cursor"
    });

    expect(config.plugins.execution.defaultExecutor).toBe("codex");
    expect(config.plugins.agents.packageName).toBe("@demo/agent-plugin");
    expect(config.plugins.agents.defaultRuntime).toBe("cursor");
  });

  it("throws on invalid values and invalid webhook config", () => {
    expect(() => readConfig({
      DITING_SCHEDULER_AGENT_COUNT: "0"
    })).toThrow("Invalid positive number for DITING_SCHEDULER_AGENT_COUNT: 0");

    expect(() => readConfig({
      DITING_PLUGIN_MEEGLE_MODE: "webhook"
    })).toThrow("Webhook Meegle mode requires DITING_PLUGIN_MEEGLE_WEBHOOK_SECRET");

    expect(() => readConfig({
      DITING_DEFAULT_EXECUTOR: "   "
    })).toThrow("DITING_DEFAULT_EXECUTOR must be a non-empty string");
  });

  it("skips built-in Meegle validation when an external task integration package is configured", () => {
    const config = readConfig({
      DITING_PLUGIN_TASK_INTEGRATION_PACKAGE: "@demo/task-integration-plugin",
      DITING_PLUGIN_MEEGLE_MODE: "webhook"
    });

    expect(config.plugins.taskIntegration.packageName).toBe("@demo/task-integration-plugin");
  });

  it("reads Meegle board filter env for latest_sprint", () => {
    const config = readConfig({
      MEEGLE_BOARD_VALUE: "R",
      MEEGLE_BOARD_FIELD: "板子R",
      MEEGLE_BOARD_USER_EMAIL: "yangdong2@guanghe.tv"
    });

    expect(config.plugins.meegle.boardValue).toBe("R");
    expect(config.plugins.meegle.boardField).toBe("板子R");
    expect(config.plugins.meegle.boardUserEmail).toBe("yangdong2@guanghe.tv");
  });

  it("supports legacy Meegle board email env fallback", () => {
    const config = readConfig({
      DITING_PLUGIN_MEEGLE_BOARD_USER_EMAIL: "legacy@example.com"
    });

    expect(config.plugins.meegle.boardUserEmail).toBe("legacy@example.com");
  });

  it("returns defaults when no env overrides are provided", () => {
    const config = readConfig({});

    expect(config.scheduler.intervalMs).toBe(CONFIG_DEFAULTS.scheduler.intervalMs);
    expect(config.scheduler.agents.programming.count).toBe(CONFIG_DEFAULTS.scheduler.agentCount);
    expect(config.scheduler.agents.product.count).toBe(CONFIG_DEFAULTS.scheduler.agents.product.count);
    expect(config.plugins.meegle.boardValue).toBeNull();
    expect(config.plugins.meegle.boardField).toBe("板子R");
    expect(config.plugins.meegle.boardUserEmail).toBeNull();
    expect(config.plugins.gitlab.cliBin).toBe(CONFIG_DEFAULTS.plugins.gitlab.cliBin);
    expect(config.plugins.gitlab.host).toBe(CONFIG_DEFAULTS.plugins.gitlab.host);
    expect(config.goalRecovery.maxRepairIterations).toBe(CONFIG_DEFAULTS.goalRecovery.maxRepairIterations);
    expect(config.goalRecovery.enableNeedsHumanLoop).toBe(CONFIG_DEFAULTS.goalRecovery.enableNeedsHumanLoop);
    expect(config.governance.maxDiffLines).toBe(CONFIG_DEFAULTS.governance.maxDiffLines);
    expect(config.plugins.agents.defaultRuntime).toBe("codex");
    expect(config.plugins.agents.product.defaultDriver).toBe("openspec-product");
    expect(config.plugins.agents.product.defaultRuntime).toBe("codex");
    expect(config.openspecReview.prefixes).toEqual({
      approved: "【评审通过】",
      changesRequested: "【需要修改】",
      dismissed: "【废弃】"
    });
  });
});
