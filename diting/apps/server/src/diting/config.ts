/**
 * Server 配置：`readConfig` 从环境变量拼装 `ServerConfig`，`validateConfig` 做插件与路径约束校验。
 */
import { resolve } from "node:path";

/** 监听端口、调度、工作目录、目标修复、插件包名、治理阈值等运行期参数。 */
export type ServerConfig = {
  port: number;
  scheduler: {
    intervalMs: number;
    agentCount: number;
    agentOfflineTimeoutMs: number;
    agentWorkerPollIntervalMs: number;
    agents: {
      programming: {
        count: number;
        offlineTimeoutMs: number;
        workerPollIntervalMs: number;
      };
      product: {
        count: number;
        offlineTimeoutMs: number;
        workerPollIntervalMs: number;
      };
      quality: {
        count: number;
        offlineTimeoutMs: number;
        workerPollIntervalMs: number;
      };
    };
  };
  workspace: {
    root: string;
    repoCacheRoot: string;
    cleanupOnSuccess: boolean;
    cleanupOnFailure: boolean;
    preflightDeep: boolean;
    specMaxBytes: number;
    openspecInit: boolean;
    superpowersInstallCmd: string | null;
    toolingTimeoutMs: number;
    prBaseBranchFallback: string | null;
  };
  goalRecovery: {
    executionTimeoutMs: number;
    executionIdleTimeoutMs: number;
    qualityTimeoutMs: number;
    environmentRetryLimit: number;
    executionRetryLimit: number;
    maxRepairIterations: number;
    enableNeedsHumanLoop: boolean;
  };
  plugins: {
    taskIntegration: {
      packageName: string | null;
    };
    execution: {
      packageName: string | null;
      defaultExecutor: string;
      codexBin: string;
      cursorBin: string;
      commitMessageAgent: "agent" | "codex" | "cursor" | "heuristic";
    };
    agents: {
      packageName: string | null;
      defaultKind: "programming";
      defaultRuntime: "codex" | "cursor";
      product: {
        defaultDriver: "openspec-product";
        defaultRuntime: "codex" | "cursor";
      };
      quality: {
        defaultDriver: "quality-orchestrator";
        defaultRuntime: "codex" | "cursor";
      };
      codexBin: string;
      cursorBin: string;
      commitMessageAgent: "agent" | "codex" | "cursor" | "heuristic";
    };
    environment: {
      packageName: string | null;
    };
    completionGate: {
      packageName: string | null;
    };
    quality: {
      packageName: string | null;
    };
    observabilityGovernance: {
      packageName: string | null;
    };
    log: {
      packageName: string | null;
    };
    meegle: {
      mode: "polling" | "webhook";
      sourceMode?: "latest_sprint" | null;
      cliBin?: string;
      authHost?: string | null;
      authProfile?: string | null;
      projectKey?: string | null;
      projectScopeName?: string | null;
      sprintTypeName?: string | null;
      demandTypeName?: string | null;
      sprintLinkField?: string | null;
      nodeName?: string | null;
      /** Meegle field_key for subtask description (e.g. field_c2b4ee). Falls back to display name 子任务描述. */
      childTaskDescriptionFieldKey?: string | null;
      /** Feishu demand role name for board filter (latest_sprint). Default 板子R. */
      boardField?: string | null;
      /** When set, latest_sprint demand MQL filters by board role member = this value. */
      boardValue?: string | null;
      /** When set, latest_sprint filters hydrated demand details by board role member email. */
      boardUserEmail?: string | null;
      queryMql?: string | null;
      detailFields?: string[];
      latestSprintDetailFields?: string[];
      /** Extra Meegle field_key values for spec attachments (comma-separated in MEEGLE_SPEC_FIELD_KEYS). */
      specFieldKeys?: string[];
      tasksFile: string | null;
      resultsFile: string | null;
      webhookSecret: string | null;
    };
    gitlab: {
      cliBin: string;
      host: string;
    };
  };
  openspecReview: {
    gateEnabled: boolean;
    prefixes: {
      approved: string;
      changesRequested: string;
      dismissed: string;
    };
  };
  governance: {
    allowCommandPrefixes: string[];
    blockCommandPatterns: string[];
    maxPromptChars: number;
    maxOutputChars: number;
    maxFilesChanged: number;
    maxDiffLines: number;
  };
};

/** 可被 `readConfig` 逐项覆盖的默认值。 */
export const CONFIG_DEFAULTS = {
  port: 3000,
  scheduler: {
    intervalMs: 30_000,
    agentCount: 2,
    agentOfflineTimeoutMs: 300_000,
    agentWorkerPollIntervalMs: 1_000,
    agents: {
      programming: {
        count: 2,
        offlineTimeoutMs: 300_000,
        workerPollIntervalMs: 1_000
      },
      product: {
        count: 1,
        offlineTimeoutMs: 300_000,
        workerPollIntervalMs: 1_000
      },
      quality: {
        count: 1,
        offlineTimeoutMs: 300_000,
        workerPollIntervalMs: 1_000
      }
    }
  },
  workspace: {
    root: ".diting/workspaces",
    repoCacheRoot: ".diting/repos",
    cleanupOnSuccess: false,
    cleanupOnFailure: false,
    preflightDeep: false,
    specMaxBytes: 50 * 1024 * 1024,
    openspecInit: true,
    superpowersInstallCmd: null as string | null,
    toolingTimeoutMs: 300_000,
    prBaseBranchFallback: null as string | null
  },
  goalRecovery: {
    executionTimeoutMs: 1_800_000,
    executionIdleTimeoutMs: 900_000,
    qualityTimeoutMs: 600_000,
    environmentRetryLimit: 2,
    executionRetryLimit: 2,
    maxRepairIterations: 3,
    enableNeedsHumanLoop: false
  },
  plugins: {
    taskIntegration: {
      packageName: null as string | null
    },
    execution: {
      packageName: null as string | null,
      defaultExecutor: "programming",
      codexBin: "codex",
      cursorBin: "agent",
      commitMessageAgent: "agent" as const
    },
    agents: {
      packageName: null as string | null,
      defaultKind: "programming" as const,
      defaultRuntime: "codex" as const,
      product: {
        defaultDriver: "openspec-product" as const,
        defaultRuntime: "codex" as const
      },
      quality: {
        defaultDriver: "quality-orchestrator" as const,
        defaultRuntime: "codex" as const
      },
      codexBin: "codex",
      cursorBin: "agent",
      commitMessageAgent: "agent" as const
    },
    environment: {
      packageName: null as string | null
    },
    completionGate: {
      packageName: null as string | null
    },
    quality: {
      packageName: null as string | null
    },
    observabilityGovernance: {
      packageName: null as string | null
    },
    log: {
      packageName: null as string | null
    },
    meegle: {
      mode: "polling" as const,
      sourceMode: null as "latest_sprint" | null,
      cliBin: "meegle",
      authHost: null,
      authProfile: null,
      projectKey: null,
      projectScopeName: null,
      sprintTypeName: null,
      demandTypeName: null,
      sprintLinkField: null,
      nodeName: null,
      childTaskDescriptionFieldKey: null,
      boardField: "板子R",
      boardValue: null,
      boardUserEmail: null,
      queryMql: null,
      detailFields: [] as string[],
      latestSprintDetailFields: [] as string[],
      specFieldKeys: [] as string[],
      tasksFile: null,
      resultsFile: null,
      webhookSecret: null
    },
    gitlab: {
      cliBin: "glab",
      host: "gitlab.yc345.tv"
    }
  },
  openspecReview: {
    gateEnabled: true,
    prefixes: {
      approved: "【评审通过】",
      changesRequested: "【需要修改】",
      dismissed: "【废弃】"
    }
  },
  governance: {
    allowCommandPrefixes: [] as string[],
    blockCommandPatterns: [
      "\\bgit\\s+push\\b",
      "\\brm\\s+-rf\\s+/",
      "\\bterraform\\s+destroy\\b",
      "\\baws\\s+iam\\b",
      "\\bssh\\b",
      "\\bscp\\b"
    ],
    maxPromptChars: 16_000,
    maxOutputChars: 12_000,
    maxFilesChanged: 20,
    maxDiffLines: 400
  }
};

/** 读取并归一化环境变量，最后调用 `validateConfig`。 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = readPositiveNumber(env, ["BACKEND_PORT"], CONFIG_DEFAULTS.port);
  const meegleMode = readEnum(env, ["DITING_PLUGIN_MEEGLE_MODE"], ["polling", "webhook"], CONFIG_DEFAULTS.plugins.meegle.mode);
  const config: ServerConfig = {
    port,
    scheduler: {
      intervalMs: readPositiveNumber(
        env,
        ["DITING_SCHEDULER_INTERVAL_MS"],
        CONFIG_DEFAULTS.scheduler.intervalMs
      ),
      agentCount: readPositiveNumber(
        env,
        ["DITING_SCHEDULER_AGENT_COUNT", "DITING_AGENT_COUNT"],
        CONFIG_DEFAULTS.scheduler.agentCount
      ),
      agentOfflineTimeoutMs: readPositiveNumber(
        env,
        ["DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS", "DITING_AGENT_OFFLINE_TIMEOUT_MS"],
        CONFIG_DEFAULTS.scheduler.agentOfflineTimeoutMs
      ),
      agentWorkerPollIntervalMs: readPositiveNumber(
        env,
        ["DITING_AGENT_WORKER_POLL_INTERVAL_MS"],
        CONFIG_DEFAULTS.scheduler.agentWorkerPollIntervalMs
      ),
      agents: {
        programming: {
          count: readPositiveNumber(
            env,
            ["DITING_SCHEDULER_AGENT_COUNT", "DITING_AGENT_COUNT"],
            CONFIG_DEFAULTS.scheduler.agentCount
          ),
          offlineTimeoutMs: readPositiveNumber(
            env,
            ["DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS", "DITING_AGENT_OFFLINE_TIMEOUT_MS"],
            CONFIG_DEFAULTS.scheduler.agentOfflineTimeoutMs
          ),
          workerPollIntervalMs: readPositiveNumber(
            env,
            ["DITING_AGENT_WORKER_POLL_INTERVAL_MS"],
            CONFIG_DEFAULTS.scheduler.agentWorkerPollIntervalMs
          )
        },
        product: {
          count: readNonNegativeNumber(
            env,
            ["DITING_SCHEDULER_PRODUCT_AGENT_COUNT"],
            CONFIG_DEFAULTS.scheduler.agents.product.count
          ),
          offlineTimeoutMs: readPositiveNumber(
            env,
            ["DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS", "DITING_AGENT_OFFLINE_TIMEOUT_MS"],
            CONFIG_DEFAULTS.scheduler.agentOfflineTimeoutMs
          ),
          workerPollIntervalMs: readPositiveNumber(
            env,
            ["DITING_AGENT_WORKER_POLL_INTERVAL_MS"],
            CONFIG_DEFAULTS.scheduler.agentWorkerPollIntervalMs
          )
        },
        quality: {
          count: readNonNegativeNumber(
            env,
            ["DITING_SCHEDULER_QUALITY_AGENT_COUNT"],
            CONFIG_DEFAULTS.scheduler.agents.quality.count
          ),
          offlineTimeoutMs: readPositiveNumber(
            env,
            ["DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS", "DITING_AGENT_OFFLINE_TIMEOUT_MS"],
            CONFIG_DEFAULTS.scheduler.agentOfflineTimeoutMs
          ),
          workerPollIntervalMs: readPositiveNumber(
            env,
            ["DITING_AGENT_WORKER_POLL_INTERVAL_MS"],
            CONFIG_DEFAULTS.scheduler.agentWorkerPollIntervalMs
          )
        }
      }
    },
    workspace: {
      root: resolve(readString(env, ["DITING_WORKSPACE_ROOT"], CONFIG_DEFAULTS.workspace.root)),
      repoCacheRoot: resolve(
        readString(
          env,
          ["DITING_WORKSPACE_REPO_CACHE_ROOT", "DITING_REPO_CACHE_ROOT"],
          CONFIG_DEFAULTS.workspace.repoCacheRoot
        )
      ),
      cleanupOnSuccess: readBoolean(
        env,
        ["DITING_WORKSPACE_CLEANUP_ON_SUCCESS", "DITING_CLEANUP_ON_SUCCESS"],
        CONFIG_DEFAULTS.workspace.cleanupOnSuccess
      ),
      cleanupOnFailure: readBoolean(
        env,
        ["DITING_WORKSPACE_CLEANUP_ON_FAILURE", "DITING_CLEANUP_ON_FAILURE"],
        CONFIG_DEFAULTS.workspace.cleanupOnFailure
      ),
      preflightDeep: readBoolean(env, ["DITING_PREFLIGHT_DEEP"], CONFIG_DEFAULTS.workspace.preflightDeep),
      specMaxBytes: readPositiveNumber(env, ["DITING_SPEC_MAX_BYTES"], CONFIG_DEFAULTS.workspace.specMaxBytes),
      openspecInit: readBoolean(env, ["DITING_WORKSPACE_OPENSPEC_INIT"], CONFIG_DEFAULTS.workspace.openspecInit),
      superpowersInstallCmd: readOptionalString(
        env,
        ["DITING_WORKSPACE_SUPERPOWERS_INSTALL_CMD"],
        CONFIG_DEFAULTS.workspace.superpowersInstallCmd
      ),
      toolingTimeoutMs: readPositiveNumber(
        env,
        ["DITING_WORKSPACE_TOOLING_TIMEOUT_MS"],
        CONFIG_DEFAULTS.workspace.toolingTimeoutMs
      ),
      prBaseBranchFallback: readOptionalString(
        env,
        ["DITING_PR_BASE_BRANCH"],
        CONFIG_DEFAULTS.workspace.prBaseBranchFallback
      )
    },
    goalRecovery: {
      executionTimeoutMs: readPositiveNumber(
        env,
        ["DITING_GOAL_EXECUTION_TIMEOUT_MS", "DITING_EXECUTION_TIMEOUT_MS"],
        CONFIG_DEFAULTS.goalRecovery.executionTimeoutMs
      ),
      executionIdleTimeoutMs: readPositiveNumber(
        env,
        ["DITING_GOAL_EXECUTION_IDLE_TIMEOUT_MS", "DITING_EXECUTION_IDLE_TIMEOUT_MS"],
        CONFIG_DEFAULTS.goalRecovery.executionIdleTimeoutMs
      ),
      qualityTimeoutMs: readPositiveNumber(
        env,
        ["DITING_GOAL_QUALITY_TIMEOUT_MS", "DITING_QUALITY_TIMEOUT_MS"],
        CONFIG_DEFAULTS.goalRecovery.qualityTimeoutMs
      ),
      environmentRetryLimit: readPositiveNumber(
        env,
        ["DITING_GOAL_ENVIRONMENT_RETRY_LIMIT"],
        CONFIG_DEFAULTS.goalRecovery.environmentRetryLimit
      ),
      executionRetryLimit: readPositiveNumber(
        env,
        ["DITING_GOAL_EXECUTION_RETRY_LIMIT"],
        CONFIG_DEFAULTS.goalRecovery.executionRetryLimit
      ),
      maxRepairIterations: readPositiveNumber(
        env,
        ["DITING_GOAL_MAX_REPAIR_ITERATIONS"],
        CONFIG_DEFAULTS.goalRecovery.maxRepairIterations
      ),
      enableNeedsHumanLoop: readBoolean(
        env,
        ["DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP"],
        CONFIG_DEFAULTS.goalRecovery.enableNeedsHumanLoop
      )
    },
    plugins: {
      taskIntegration: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_TASK_INTEGRATION_PACKAGE"],
          CONFIG_DEFAULTS.plugins.taskIntegration.packageName
        )
      },
      execution: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_EXECUTION_PACKAGE"],
          CONFIG_DEFAULTS.plugins.execution.packageName
        ),
        defaultExecutor: readNonEmptyString(
          env,
          ["DITING_DEFAULT_EXECUTOR", "DITING_PLUGIN_EXECUTION_DEFAULT_EXECUTOR"],
          CONFIG_DEFAULTS.plugins.execution.defaultExecutor
        ),
        codexBin: readString(
          env,
          ["DITING_PLUGIN_EXECUTION_CODEX_BIN", "CODEX_CLI_BIN"],
          CONFIG_DEFAULTS.plugins.execution.codexBin
        ),
        cursorBin: readString(
          env,
          ["DITING_PLUGIN_EXECUTION_CURSOR_BIN", "CURSOR_CLI_BIN"],
          CONFIG_DEFAULTS.plugins.execution.cursorBin
        ),
        commitMessageAgent: readEnum(
          env,
          ["DITING_PR_COMMIT_MESSAGE_AGENT", "DITING_PLUGIN_EXECUTION_COMMIT_MESSAGE_AGENT"],
          ["agent", "codex", "cursor", "heuristic"],
          CONFIG_DEFAULTS.plugins.execution.commitMessageAgent
        )
      },
      agents: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_AGENT_PACKAGE"],
          CONFIG_DEFAULTS.plugins.agents.packageName
        ),
        defaultKind: "programming" as const,
        defaultRuntime: readEnum(
          env,
          ["DITING_PLUGIN_AGENT_DEFAULT_RUNTIME"],
          ["codex", "cursor"],
          CONFIG_DEFAULTS.plugins.agents.defaultRuntime
        ),
        product: {
          defaultDriver: "openspec-product" as const,
          defaultRuntime: readEnum(
            env,
            ["DITING_PLUGIN_PRODUCT_AGENT_DEFAULT_RUNTIME"],
            ["codex", "cursor"],
            CONFIG_DEFAULTS.plugins.agents.product.defaultRuntime
          )
        },
        quality: {
          defaultDriver: "quality-orchestrator" as const,
          defaultRuntime: readEnum(
            env,
            ["DITING_PLUGIN_QUALITY_AGENT_DEFAULT_RUNTIME"],
            ["codex", "cursor"],
            CONFIG_DEFAULTS.plugins.agents.quality.defaultRuntime
          )
        },
        codexBin: readString(
          env,
          ["DITING_PLUGIN_EXECUTION_CODEX_BIN", "CODEX_CLI_BIN"],
          CONFIG_DEFAULTS.plugins.agents.codexBin
        ),
        cursorBin: readString(
          env,
          ["DITING_PLUGIN_EXECUTION_CURSOR_BIN", "CURSOR_CLI_BIN"],
          CONFIG_DEFAULTS.plugins.agents.cursorBin
        ),
        commitMessageAgent: readEnum(
          env,
          ["DITING_PR_COMMIT_MESSAGE_AGENT", "DITING_PLUGIN_EXECUTION_COMMIT_MESSAGE_AGENT"],
          ["agent", "codex", "cursor", "heuristic"],
          CONFIG_DEFAULTS.plugins.agents.commitMessageAgent
        )
      },
      environment: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_ENVIRONMENT_PACKAGE"],
          CONFIG_DEFAULTS.plugins.environment.packageName
        )
      },
      completionGate: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_COMPLETION_GATE_PACKAGE"],
          CONFIG_DEFAULTS.plugins.completionGate.packageName
        )
      },
      quality: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_QUALITY_PACKAGE"],
          CONFIG_DEFAULTS.plugins.quality.packageName
        )
      },
      observabilityGovernance: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_OBSERVABILITY_GOVERNANCE_PACKAGE"],
          CONFIG_DEFAULTS.plugins.observabilityGovernance.packageName
        )
      },
      log: {
        packageName: readOptionalString(
          env,
          ["DITING_PLUGIN_LOG_PACKAGE"],
          CONFIG_DEFAULTS.plugins.log.packageName
        )
      },
      meegle: {
        mode: meegleMode,
        sourceMode: (() => {
          const value = readOptionalString(
            env,
            ["MEEGLE_SOURCE_MODE", "DITING_PLUGIN_MEEGLE_SOURCE_MODE"],
            CONFIG_DEFAULTS.plugins.meegle.sourceMode
          );
          return value === "latest_sprint" ? "latest_sprint" : null;
        })(),
        cliBin: readString(
          env,
          ["MEEGLE_CLI_BIN", "DITING_PLUGIN_MEEGLE_CLI_BIN"],
          CONFIG_DEFAULTS.plugins.meegle.cliBin ?? "meegle"
        ),
        authHost: readOptionalString(
          env,
          ["MEEGLE_AUTH_HOST", "DITING_PLUGIN_MEEGLE_AUTH_HOST"],
          CONFIG_DEFAULTS.plugins.meegle.authHost
        ),
        authProfile: readOptionalString(
          env,
          ["MEEGLE_AUTH_PROFILE", "DITING_PLUGIN_MEEGLE_AUTH_PROFILE"],
          CONFIG_DEFAULTS.plugins.meegle.authProfile
        ),
        projectKey: readOptionalString(
          env,
          ["MEEGLE_PROJECT_KEY", "DITING_PLUGIN_MEEGLE_PROJECT_KEY"],
          CONFIG_DEFAULTS.plugins.meegle.projectKey
        ),
        projectScopeName: readOptionalString(
          env,
          ["MEEGLE_PROJECT_SCOPE_NAME", "DITING_PLUGIN_MEEGLE_PROJECT_SCOPE_NAME"],
          CONFIG_DEFAULTS.plugins.meegle.projectScopeName
        ),
        sprintTypeName: readOptionalString(
          env,
          ["MEEGLE_SPRINT_TYPE_NAME", "DITING_PLUGIN_MEEGLE_SPRINT_TYPE_NAME"],
          CONFIG_DEFAULTS.plugins.meegle.sprintTypeName
        ),
        demandTypeName: readOptionalString(
          env,
          ["MEEGLE_DEMAND_TYPE_NAME", "DITING_PLUGIN_MEEGLE_DEMAND_TYPE_NAME"],
          CONFIG_DEFAULTS.plugins.meegle.demandTypeName
        ),
        sprintLinkField: readOptionalString(
          env,
          ["MEEGLE_SPRINT_LINK_FIELD", "DITING_PLUGIN_MEEGLE_SPRINT_LINK_FIELD"],
          CONFIG_DEFAULTS.plugins.meegle.sprintLinkField
        ),
        nodeName: readOptionalString(
          env,
          ["MEEGLE_NODE_NAME", "DITING_PLUGIN_MEEGLE_NODE_NAME"],
          CONFIG_DEFAULTS.plugins.meegle.nodeName
        ),
        childTaskDescriptionFieldKey: readOptionalString(
          env,
          [
            "MEEGLE_CHILD_TASK_DESCRIPTION_FIELD_KEY",
            "MEEGLE_CHILD_TASK_DESCRIPTION_FIELD",
            "DITING_PLUGIN_MEEGLE_CHILD_TASK_DESCRIPTION_FIELD_KEY",
            "DITING_PLUGIN_MEEGLE_CHILD_TASK_DESCRIPTION_FIELD"
          ],
          CONFIG_DEFAULTS.plugins.meegle.childTaskDescriptionFieldKey
        ),
        boardField: readOptionalString(
          env,
          ["MEEGLE_BOARD_FIELD", "DITING_PLUGIN_MEEGLE_BOARD_FIELD"],
          CONFIG_DEFAULTS.plugins.meegle.boardField
        ),
        boardValue: readOptionalString(
          env,
          ["MEEGLE_BOARD_VALUE", "DITING_PLUGIN_MEEGLE_BOARD_VALUE"],
          CONFIG_DEFAULTS.plugins.meegle.boardValue
        ),
        boardUserEmail: readOptionalString(
          env,
          ["MEEGLE_BOARD_USER_EMAIL", "DITING_PLUGIN_MEEGLE_BOARD_USER_EMAIL"],
          CONFIG_DEFAULTS.plugins.meegle.boardUserEmail
        ),
        queryMql: readOptionalString(
          env,
          ["MEEGLE_QUERY_MQL", "DITING_PLUGIN_MEEGLE_QUERY_MQL"],
          CONFIG_DEFAULTS.plugins.meegle.queryMql
        ),
        detailFields: readStringArray(
          env,
          ["MEEGLE_DETAIL_FIELDS", "DITING_PLUGIN_MEEGLE_DETAIL_FIELDS"],
          CONFIG_DEFAULTS.plugins.meegle.detailFields ?? []
        ),
        latestSprintDetailFields: readStringArray(
          env,
          ["MEEGLE_LATEST_SPRINT_DETAIL_FIELDS", "DITING_PLUGIN_MEEGLE_LATEST_SPRINT_DETAIL_FIELDS"],
          CONFIG_DEFAULTS.plugins.meegle.latestSprintDetailFields ?? []
        ),
        specFieldKeys: readStringArray(
          env,
          ["MEEGLE_SPEC_FIELD_KEYS", "DITING_PLUGIN_MEEGLE_SPEC_FIELD_KEYS"],
          CONFIG_DEFAULTS.plugins.meegle.specFieldKeys ?? []
        ),
        tasksFile: readOptionalString(
          env,
          ["DITING_PLUGIN_MEEGLE_TASKS_FILE", "DITING_MEEGLE_TASKS_FILE"],
          CONFIG_DEFAULTS.plugins.meegle.tasksFile
        ),
        resultsFile: readOptionalString(
          env,
          ["DITING_PLUGIN_MEEGLE_RESULTS_FILE", "DITING_MEEGLE_RESULTS_FILE"],
          CONFIG_DEFAULTS.plugins.meegle.resultsFile
        ),
        webhookSecret: readOptionalString(
          env,
          ["DITING_PLUGIN_MEEGLE_WEBHOOK_SECRET"],
          CONFIG_DEFAULTS.plugins.meegle.webhookSecret
        )
      },
      gitlab: {
        cliBin: readString(
          env,
          ["GITLAB_CLI_BIN", "DITING_GITLAB_CLI_BIN", "DITING_PLUGIN_GITLAB_CLI_BIN"],
          CONFIG_DEFAULTS.plugins.gitlab.cliBin
        ),
        host: readString(
          env,
          ["DITING_GITLAB_HOST", "GITLAB_HOST", "DITING_PLUGIN_GITLAB_HOST"],
          CONFIG_DEFAULTS.plugins.gitlab.host
        )
      }
    },
    openspecReview: {
      gateEnabled: readBoolean(
        env,
        ["DITING_OPENSPEC_REVIEW_GATE_ENABLED"],
        CONFIG_DEFAULTS.openspecReview.gateEnabled
      ),
      prefixes: {
        approved: readString(
          env,
          ["DITING_OPENSPEC_REVIEW_PREFIX_APPROVED"],
          CONFIG_DEFAULTS.openspecReview.prefixes.approved
        ),
        changesRequested: readString(
          env,
          ["DITING_OPENSPEC_REVIEW_PREFIX_CHANGES_REQUESTED"],
          CONFIG_DEFAULTS.openspecReview.prefixes.changesRequested
        ),
        dismissed: readString(
          env,
          ["DITING_OPENSPEC_REVIEW_PREFIX_DISMISSED"],
          CONFIG_DEFAULTS.openspecReview.prefixes.dismissed
        )
      }
    },
    governance: {
      allowCommandPrefixes: readStringArray(
        env,
        ["DITING_GOVERNANCE_ALLOW_COMMAND_PREFIXES"],
        CONFIG_DEFAULTS.governance.allowCommandPrefixes
      ),
      blockCommandPatterns: readStringArray(
        env,
        ["DITING_GOVERNANCE_BLOCK_COMMAND_PATTERNS"],
        CONFIG_DEFAULTS.governance.blockCommandPatterns
      ),
      maxPromptChars: readPositiveNumber(
        env,
        ["DITING_GOVERNANCE_MAX_PROMPT_CHARS"],
        CONFIG_DEFAULTS.governance.maxPromptChars
      ),
      maxOutputChars: readPositiveNumber(
        env,
        ["DITING_GOVERNANCE_MAX_OUTPUT_CHARS"],
        CONFIG_DEFAULTS.governance.maxOutputChars
      ),
      maxFilesChanged: readPositiveNumber(
        env,
        ["DITING_GOVERNANCE_MAX_FILES_CHANGED"],
        CONFIG_DEFAULTS.governance.maxFilesChanged
      ),
      maxDiffLines: readPositiveNumber(
        env,
        ["DITING_GOVERNANCE_MAX_DIFF_LINES"],
        CONFIG_DEFAULTS.governance.maxDiffLines
      )
    }
  };

  config.scheduler.agents.programming.count = config.scheduler.agentCount;
  config.scheduler.agents.programming.offlineTimeoutMs = config.scheduler.agentOfflineTimeoutMs;
  config.scheduler.agents.programming.workerPollIntervalMs = config.scheduler.agentWorkerPollIntervalMs;
  config.scheduler.agents.product.offlineTimeoutMs = config.scheduler.agentOfflineTimeoutMs;
  config.scheduler.agents.product.workerPollIntervalMs = config.scheduler.agentWorkerPollIntervalMs;
  config.plugins.agents.packageName = config.plugins.agents.packageName ?? config.plugins.execution.packageName;
  if (!hasAnyDefinedValue(env, ["DITING_PLUGIN_AGENT_DEFAULT_RUNTIME"])) {
    config.plugins.agents.defaultRuntime = config.plugins.execution.defaultExecutor === "cursor" ? "cursor" : "codex";
  }
  config.plugins.agents.codexBin = config.plugins.execution.codexBin;
  config.plugins.agents.cursorBin = config.plugins.execution.cursorBin;
  config.plugins.agents.commitMessageAgent = config.plugins.execution.commitMessageAgent;

  validateConfig(config);
  return config;
}

/** Meegle / 工作目录 / 默认执行器等交叉约束，启动前尽早失败。 */
export function validateConfig(config: ServerConfig): void {
  const meegle = config.plugins.meegle;
  if (!config.plugins.taskIntegration.packageName) {
    if (meegle.sourceMode === "latest_sprint") {
      if (!meegle.cliBin) {
        throw new Error("Latest sprint Meegle mode requires MEEGLE_CLI_BIN");
      }
      if (!meegle.projectKey || !meegle.projectScopeName || !meegle.sprintTypeName || !meegle.demandTypeName || !meegle.sprintLinkField) {
        throw new Error("Latest sprint Meegle mode requires project, sprint, demand, and link field configuration");
      }
    }
    if (meegle.mode === "polling" && meegle.resultsFile && !meegle.tasksFile) {
      throw new Error("Polling Meegle mode requires tasksFile when resultsFile is configured");
    }
    if (meegle.mode === "webhook" && !meegle.webhookSecret) {
      throw new Error("Webhook Meegle mode requires DITING_PLUGIN_MEEGLE_WEBHOOK_SECRET");
    }
  }
  if (config.workspace.repoCacheRoot === config.workspace.root) {
    throw new Error("workspace.root and workspace.repoCacheRoot must be different paths");
  }
  if (!config.plugins.execution.defaultExecutor.trim()) {
    throw new Error("DITING_DEFAULT_EXECUTOR must be a non-empty string");
  }
  if (config.scheduler.agents.programming.count !== config.scheduler.agentCount) {
    throw new Error("scheduler.agents.programming.count must match scheduler.agentCount");
  }
}

function readString(env: NodeJS.ProcessEnv, names: string[], fallback: string): string {
  const value = readEnv(env, names);
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function readNonEmptyString(env: NodeJS.ProcessEnv, names: string[], fallback: string): string {
  const value = readEnv(env, names);
  if (value === undefined) {
    return fallback;
  }
  if (value.trim().length === 0) {
    throw new Error(`${names[0]} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(env: NodeJS.ProcessEnv, names: string[], fallback: string | null): string | null {
  const value = readEnv(env, names);
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

function readBoolean(env: NodeJS.ProcessEnv, names: string[], fallback: boolean): boolean {
  const value = readEnv(env, names);
  if (value === undefined) {
    return fallback;
  }
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }
  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }
  throw new Error(`Invalid boolean for ${names[0]}: ${value}`);
}

function readPositiveNumber(env: NodeJS.ProcessEnv, names: string[], fallback: number): number {
  const value = readEnv(env, names);
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive number for ${names[0]}: ${value}`);
  }
  return parsed;
}

function readNonNegativeNumber(env: NodeJS.ProcessEnv, names: string[], fallback: number): number {
  const value = readEnv(env, names);
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative number for ${names[0]}: ${value}`);
  }
  return parsed;
}

function readEnum<T extends string>(
  env: NodeJS.ProcessEnv,
  names: string[],
  allowed: T[],
  fallback: T
): T {
  const value = readEnv(env, names);
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  if (allowed.includes(value as T)) {
    return value as T;
  }
  throw new Error(`Invalid value for ${names[0]}: ${value}. Allowed: ${allowed.join(", ")}`);
}

function readStringArray(env: NodeJS.ProcessEnv, names: string[], fallback: string[]): string[] {
  const value = readEnv(env, names);
  if (value === undefined || value.trim().length === 0) {
    return [...fallback];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readEnv(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function hasAnyDefinedValue(env: NodeJS.ProcessEnv, names: string[]): boolean {
  return names.some((name) => {
    const value = env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}
