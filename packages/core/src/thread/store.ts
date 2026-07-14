export * as ThreadStore from "./store"

import { eq, and } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import { Database } from "../database/database"
import { makeGlobalNode } from "../effect/app-node"
import { ThreadTable } from "./sql"
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

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/ThreadStore") {}

function fromRow(row: typeof ThreadTable.$inferSelect): Thread.Info {
  return Thread.Info.make({
    id: Thread.ID.make(row.id),
    projectID: row.project_id,
    title: row.title,
    agent: row.agent ?? undefined,
    parentID: row.parent_id ? Thread.ID.make(row.parent_id) : undefined,
    worktreePath: row.worktree_path ?? undefined,
    worktreeBranch: row.worktree_branch ?? undefined,
    status: row.status as "active" | "idle" | "completed",
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  })
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    return Service.of({
      get: Effect.fn("ThreadStore.get")(function* (threadID) {
        const row = yield* db.select().from(ThreadTable).where(eq(ThreadTable.id, threadID)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      list: Effect.fn("ThreadStore.list")(function* (projectID, status) {
        const condition = status
          ? and(eq(ThreadTable.project_id, projectID), eq(ThreadTable.status, status))
          : eq(ThreadTable.project_id, projectID)
        const rows = yield* db.select().from(ThreadTable).where(condition).all().pipe(Effect.orDie)
        return rows.map(fromRow)
      }),

      create: Effect.fn("ThreadStore.create")(function* (input) {
        const now = Date.now()
        const id = Thread.ID.create()
        yield* db
          .insert(ThreadTable)
          .values({
            id,
            project_id: input.projectID,
            title: input.title,
            agent: input.agent,
            parent_id: input.parentID,
            worktree_path: input.worktreePath,
            worktree_branch: input.worktreeBranch,
            status: "active",
            time_created: now,
            time_updated: now,
          })
          .run()
          .pipe(Effect.orDie)
        return Thread.Info.make({
          id,
          projectID: input.projectID,
          title: input.title,
          agent: input.agent,
          parentID: input.parentID,
          worktreePath: input.worktreePath,
          worktreeBranch: input.worktreeBranch,
          status: "active",
          time: { created: now, updated: now },
        })
      }),

      update: Effect.fn("ThreadStore.update")(function* (threadID, patch) {
        const existing = yield* db.select().from(ThreadTable).where(eq(ThreadTable.id, threadID)).get().pipe(Effect.orDie)
        if (!existing) return undefined
        yield* db
          .update(ThreadTable)
          .set({
            ...(patch.title !== undefined && { title: patch.title }),
            ...(patch.agent !== undefined && { agent: patch.agent }),
            ...(patch.status !== undefined && { status: patch.status }),
            ...(patch.worktreePath !== undefined && { worktree_path: patch.worktreePath }),
            ...(patch.worktreeBranch !== undefined && { worktree_branch: patch.worktreeBranch }),
            time_updated: Date.now(),
          })
          .where(eq(ThreadTable.id, threadID))
          .run()
          .pipe(Effect.orDie)
        const row = yield* db.select().from(ThreadTable).where(eq(ThreadTable.id, threadID)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      remove: Effect.fn("ThreadStore.remove")(function* (threadID) {
        yield* db.delete(ThreadTable).where(eq(ThreadTable.id, threadID)).run().pipe(Effect.orDie)
      }),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })
