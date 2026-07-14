export * as ThreadService from "./service"

import { Effect, Context, Layer } from "effect"
import { ThreadStore } from "./store"
import { Thread } from "@opencode-ai/schema/thread"

export interface Interface {
  readonly get: (threadID: Thread.ID) => Effect.Effect<Thread.Info | undefined>
  readonly list: (projectID: string, status?: string) => Effect.Effect<Thread.Info[]>
  readonly create: (input: {
    title: string
    projectID: string
    agent?: string
    parentID?: Thread.ID
    worktreePath?: string
    worktreeBranch?: string
  }) => Effect.Effect<Thread.Info>
  readonly update: (
    threadID: Thread.ID,
    patch: {
      title?: string
      agent?: string
      status?: "active" | "idle" | "completed"
      worktreePath?: string
      worktreeBranch?: string
    },
  ) => Effect.Effect<Thread.Info | undefined>
  readonly remove: (threadID: Thread.ID) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/ThreadService") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = yield* ThreadStore.Service

    return Service.of({
      get: store.get,
      list: store.list,
      create: store.create,
      update: store.update,
      remove: Effect.fn("ThreadService.remove")(function* (threadID) {
        yield* store.remove(threadID)
      }),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [ThreadStore.node] })

import { makeGlobalNode } from "../effect/app-node"
