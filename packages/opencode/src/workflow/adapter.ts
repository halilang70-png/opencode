import type {
  AgentAdapter,
  AgentAdapterCapabilities,
  AgentAdapterContext,
  AgentRunParams,
  AgentRunResult,
} from "@opencode-ai/workflow-engine"
import { Effect, Exit } from "effect"
import { Session } from "../session/session"
import { MessageV2 } from "../session/message-v2"
import { PartID, MessageID } from "../session/schema"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import type { SessionID } from "../session/schema"

const WORKFLOW_AGENT_ID = "opencode-workflow-agent"

const WORKFLOW_AGENT_CAPABILITIES: AgentAdapterCapabilities = {
  structuredOutput: true,
  tools: true,
}

export interface WorkflowHostBundle {
  sessionID: SessionID
  parentAgent: string
  parentModel: { providerID: string; modelID: string }
}

export class OpenCodeBackend implements AgentAdapter {
  readonly id = "opencode"
  readonly capabilities = WORKFLOW_AGENT_CAPABILITIES

  constructor(
    private readonly sessions: Session.Service,
    private readonly resolveAgent: (name: string) => Promise<{ name: string; model?: { providerID: string; modelID: string } } | undefined>,
  ) {}

  async run(params: AgentRunParams, ctx: AgentAdapterContext): Promise<AgentRunResult> {
    const host = ctx.host as WorkflowHostBundle

    const agentInfo = params.agentType
      ? await this.resolveAgent(params.agentType)
      : undefined

    const agentName = agentInfo?.name ?? WORKFLOW_AGENT_ID
    const model = agentInfo?.model ?? host.parentModel

    const sessionID = host.sessionID

    const userMsg: SessionV1.User = {
      id: MessageID.ascending(),
      role: "user",
      sessionID,
      time: { created: Date.now() },
      agent: agentName,
      model: {
        providerID: model.providerID,
        modelID: model.modelID,
      },
    }

    await Effect.runPromise(
      Effect.gen(
        function* () {
          const sessions = yield* Session.Service
          yield* sessions.updateMessage(userMsg)
          yield* sessions.updatePart({
            id: PartID.ascending(),
            messageID: userMsg.id,
            sessionID,
            type: "text",
            text: params.prompt,
          })
        }.pipe(Effect.provideService(Session.Service, this.sessions)),
      ),
    )

    await new Promise<void>((resolve, reject) => {
      const check = setInterval(async () => {
        try {
          const msgs = await Effect.runPromise(
            Effect.gen(
              function* () {
                const sessions = yield* Session.Service
                return yield* sessions.messages({ sessionID, limit: 1 })
              }.pipe(Effect.provideService(Session.Service, this.sessions)),
            ),
          )
          const lastMsg = msgs[0]
          if (lastMsg?.info.role === "assistant" && (lastMsg.info as SessionV1.Assistant).finish) {
            clearInterval(check)
            resolve()
          }
        } catch {
          clearInterval(check)
          reject(new Error("Failed to poll session"))
        }
      }, 500)

      ctx.signal.addEventListener("abort", () => {
        clearInterval(check)
        reject(new DOMException("Aborted", "AbortError"))
      })
    })

    const msgs = await Effect.runPromise(
      Effect.gen(
        function* () {
          const sessions = yield* Session.Service
          return yield* sessions.messages({ sessionID, limit: 1 })
        }.pipe(Effect.provideService(Session.Service, this.sessions)),
      ),
    )

    const lastMsg = msgs[0]
    if (!lastMsg || lastMsg.info.role !== "assistant") {
      return { status: "dead", error: "No assistant response" }
    }

    const assistant = lastMsg.info as SessionV1.Assistant
    const textParts = lastMsg.parts.filter((p): p is SessionV1.TextPart => p.type === "text")
    const text = textParts.map((p) => p.text).join("\n")

    let structuredOutput: unknown = undefined
    if (params.structuredOutput) {
      try {
        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
        if (jsonMatch) {
          structuredOutput = JSON.parse(jsonMatch[1])
        } else {
          structuredOutput = JSON.parse(text)
        }
      } catch {
        // Structured output extraction failed
      }
    }

    return {
      status: "ok",
      text,
      tokenCount: assistant.tokens.output + assistant.tokens.input,
      toolCount: lastMsg.parts.filter((p) => p.type === "tool").length,
      ...(structuredOutput !== undefined ? { structuredOutput } : {}),
    }
  }
}
