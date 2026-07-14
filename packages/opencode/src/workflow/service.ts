import { runWorkflow } from "@opencode-ai/workflow-engine"
import { createWorkflowPorts, type WorkflowHostBundle } from "./ports"
import type { SessionID } from "../session/schema"
import { Session } from "../session/session"
import { Effect } from "effect"

export interface WorkflowRunOptions {
  sessionID: SessionID
  script: string
  args?: Record<string, unknown>
  name?: string
  agent?: string
}

export interface WorkflowService {
  run(opts: WorkflowRunOptions): Promise<{ runId: string }>
  kill(runId: string): void
}

export function createWorkflowService(opts: {
  sessions: Session.Service
  resolveAgent: (name: string) => Promise<{ name: string; model?: { providerID: string; modelID: string } } | undefined>
}): WorkflowService {
  const ports = createWorkflowPorts(opts)
  const activeRuns = new Map<string, AbortController>()

  return {
    async run(runOpts) {
      const hostBundle: WorkflowHostBundle = {
        sessionID: runOpts.sessionID,
        parentAgent: runOpts.agent ?? "build",
        parentModel: { providerID: "unknown", modelID: "unknown" },
      }

      const host = ports.hostFactory(hostBundle)
      const abortController = new AbortController()

      const result = await runWorkflow({
        script: runOpts.script,
        name: runOpts.name,
        args: runOpts.args ?? {},
        ports,
        host,
        signal: abortController.signal,
      })

      if (result.status === "completed") {
        return { runId: result.runId }
      }

      throw new Error(`Workflow failed: ${result.error ?? "unknown error"}`)
    },

    kill(runId: string) {
      ports.taskRegistrar.kill(runId)
    },
  }
}
