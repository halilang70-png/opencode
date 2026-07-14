import { Thread } from "@opencode-ai/schema/thread"
import { Effect, Schema } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ThreadPaths, CreatePayload, UpdatePayload, ListQuery } from "../groups/thread"
import { ThreadStore } from "@opencode-ai/core/thread/store"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { Database } from "@opencode-ai/core/database/database"
import { eq } from "drizzle-orm"
import { InstanceState } from "@/effect/instance-state"

const requireThread = (threadID: Thread.ID) =>
  Effect.gen(function* () {
    const store = yield* ThreadStore.Service
    const thread = yield* store.get(threadID)
    if (!thread) return yield* new HttpApiError.NotFound({})
    return thread
  })

export const threadHandlers = HttpApiBuilder.group(InstanceHttpApi, "thread", (handlers) =>
  handlers
    .handle("list", Effect.fn("ThreadHttpApi.list")(function* (ctx) {
      const store = yield* ThreadStore.Service
      const ctx2 = yield* InstanceState.context
      const projectID = ctx.query.projectID ?? ctx2.project.id
      return yield* store.list(projectID, ctx.query.status)
    }))

    .handle("get", Effect.fn("ThreadHttpApi.get")(function* (ctx) {
      yield* requireThread(ctx.params.threadID)
      const store = yield* ThreadStore.Service
      return yield* store.get(ctx.params.threadID).pipe(Effect.orDie)
    }))

    .handle("create", Effect.fn("ThreadHttpApi.create")(function* (ctx) {
      const store = yield* ThreadStore.Service
      const ctx2 = yield* InstanceState.context
      return yield* store.create({
        title: ctx.payload.title,
        projectID: ctx2.project.id,
        agent: ctx.payload.agent,
        parentID: ctx.payload.parentID,
        worktreePath: ctx.payload.worktreePath,
        worktreeBranch: ctx.payload.worktreeBranch,
      })
    }))

    .handle("update", Effect.fn("ThreadHttpApi.update")(function* (ctx) {
      yield* requireThread(ctx.params.threadID)
      const store = yield* ThreadStore.Service
      const result = yield* store.update(ctx.params.threadID, ctx.payload)
      if (!result) return yield* new HttpApiError.NotFound({})
      return result
    }))

    .handle("remove", Effect.fn("ThreadHttpApi.remove")(function* (ctx) {
      yield* requireThread(ctx.params.threadID)
      const store = yield* ThreadStore.Service
      const { db } = yield* Database.Service
      // Disassociate sessions from this thread
      yield* db.update(SessionTable).set({ thread_id: null }).where(eq(SessionTable.thread_id, ctx.params.threadID)).run().pipe(Effect.orDie)
      yield* store.remove(ctx.params.threadID)
    }))

    .handle("sessions", Effect.fn("ThreadHttpApi.sessions")(function* (ctx) {
      yield* requireThread(ctx.params.threadID)
      const { db } = yield* Database.Service
      const rows = yield* db
        .select({ id: SessionTable.id, title: SessionTable.title })
        .from(SessionTable)
        .where(eq(SessionTable.thread_id, ctx.params.threadID))
        .all()
        .pipe(Effect.orDie)
      return rows
    })),
)
