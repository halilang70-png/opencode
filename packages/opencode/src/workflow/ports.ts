import type {
  WorkflowPorts,
  ProgressEmitter,
  TaskRegistrar,
  JournalStore,
  PermissionGate,
  Logger,
  HostFactory,
  AgentRunner,
} from "@opencode-ai/workflow-engine"
import { createFileJournalStore } from "@opencode-ai/workflow-engine"
import { OpenCodeBackend } from "./adapter"
import type { AgentAdapterRegistry } from "@opencode-ai/workflow-engine"
import { AgentAdapterRegistry as Registry } from "@opencode-ai/workflow-engine"
import type { SessionID } from "../session/schema"
import { Session } from "../session/session"
import { Effect } from "effect"
import path from "path"
import os from "os"

const RUNS_DIR = path.join(os.homedir(), ".local/share/opencode/workflow-runs")

export interface WorkflowHostBundle {
  sessionID: SessionID
  parentAgent: string
  parentModel: { providerID: string; modelID: string }
}

export function createWorkflowPorts(opts: {
  sessions: Session.Service
  resolveAgent: (name: string) => Promise<{ name: string; model?: { providerID: string; modelID: string } } | undefined>
}): WorkflowPorts {
  const { sessions, resolveAgent } = opts

  const backend = new OpenCodeBackend(sessions, resolveAgent)
  const registry = new Registry()
  registry.register(backend).default("opencode")

  const progressEmitter: ProgressEmitter = {
    emit(event) {
      // Route to OpenCode's event system or log
      if (event.type === "run_started") {
        console.log(`[workflow] run started: ${event.workflowName}`)
      } else if (event.type === "run_done") {
        console.log(`[workflow] run done: ${event.workflowName} (${event.status})`)
      } else if (event.type === "agent_started") {
        console.log(`[workflow] agent started: ${event.label ?? event.agentType}`)
      } else if (event.type === "agent_done") {
        console.log(`[workflow] agent done: ${event.label ?? event.agentType} (${event.status})`)
      } else if (event.type === "phase_started") {
        console.log(`[workflow] phase started: ${event.title}`)
      }
    },
  }

  const pendingRuns = new Map<string, { taskId: string; abortController: AbortController }>()

  const taskRegistrar: TaskRegistrar = {
    register(runId, opts) {
      const abortController = new AbortController()
      pendingRuns.set(runId, { taskId: runId, abortController })
      return { runId, signal: abortController.signal }
    },
    complete(runId) {
      pendingRuns.delete(runId)
    },
    fail(runId) {
      pendingRuns.delete(runId)
    },
    kill(runId) {
      const binding = pendingRuns.get(runId)
      if (binding) {
        binding.abortController.abort()
        pendingRuns.delete(runId)
      }
    },
    registerAgentAbort(runId, agentId, signal) {
      // Simplified: agent abort handled by parent signal
    },
    unregisterAgentAbort(runId, agentId) {
      // No-op for minimal implementation
    },
    pendingAction(runId, agentId) {
      return undefined
    },
  }

  const journalStore: JournalStore = createFileJournalStore(RUNS_DIR)

  const permissionGate: PermissionGate = {
    async check() {
      return true
    },
  }

  const logger: Logger = {
    debug(msg, data) {
      if (process.env.OPENCODE_DEBUG) {
        console.debug(`[workflow:debug] ${msg}`, data ?? "")
      }
    },
    warn(msg, data) {
      console.warn(`[workflow:warn] ${msg}`, data ?? "")
    },
    event(name, data) {
      console.log(`[workflow:event] ${name}`, data ?? "")
    },
  }

  const hostFactory: HostFactory = (bundle) => {
    return bundle as unknown as import("@opencode-ai/workflow-engine").HostHandle
  }

  const agentRunner: AgentRunner = async (params, host) => {
    return backend.run(params, {
      host,
      signal: new AbortController().signal,
      runId: "legacy",
      agentId: 0,
      onProgress: () => {},
      registerAgentAbort: () => {},
      unregisterAgentAbort: () => {},
    })
  }

  return {
    agentRunner,
    agentAdapterRegistry: registry as unknown as AgentAdapterRegistry,
    progressEmitter,
    taskRegistrar,
    journalStore,
    permissionGate,
    logger,
    hostFactory,
  }
}
