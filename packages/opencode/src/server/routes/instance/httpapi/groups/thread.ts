import { Thread } from "@opencode-ai/schema/thread"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { ApiNotFoundError } from "../errors"
import { described } from "./metadata"

const root = "/thread"

export const ThreadPaths = {
  list: root,
  get: `${root}/:threadID`,
  create: root,
  update: `${root}/:threadID`,
  remove: `${root}/:threadID`,
  sessions: `${root}/:threadID/session`,
} as const

export const CreatePayload = Schema.Struct({
  title: Schema.String,
  agent: Schema.optional(Schema.String),
  parentID: Schema.optional(Thread.ID),
  worktreePath: Schema.optional(Schema.String),
  worktreeBranch: Schema.optional(Schema.String),
})

export const UpdatePayload = Schema.Struct({
  title: Schema.optional(Schema.String),
  agent: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literals(["active", "idle", "completed"])),
  worktreePath: Schema.optional(Schema.String),
  worktreeBranch: Schema.optional(Schema.String),
})

export const ListQuery = Schema.Struct({
  projectID: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
})

export const ThreadApi = HttpApi.make("thread")
  .add(
    HttpApiGroup.make("thread")
      .add(
        HttpApiEndpoint.get("list", ThreadPaths.list, {
          query: ListQuery,
          success: described(Schema.Array(Thread.Info), "List of threads"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "thread.list",
            summary: "List threads",
            description: "List all threads for the current project, optionally filtered by status.",
          }),
        ),
        HttpApiEndpoint.get("get", ThreadPaths.get, {
          params: { threadID: Thread.ID },
          success: described(Thread.Info, "Thread details"),
          error: [ApiNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "thread.get",
            summary: "Get thread",
            description: "Get a single thread by ID.",
          }),
        ),
        HttpApiEndpoint.post("create", ThreadPaths.create, {
          payload: CreatePayload,
          success: described(Thread.Info, "Created thread"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "thread.create",
            summary: "Create thread",
            description: "Create a new thread for parallel agent work.",
          }),
        ),
        HttpApiEndpoint.patch("update", ThreadPaths.update, {
          params: { threadID: Thread.ID },
          payload: UpdatePayload,
          success: described(Thread.Info, "Updated thread"),
          error: [ApiNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "thread.update",
            summary: "Update thread",
            description: "Update thread metadata (title, status, agent, worktree).",
          }),
        ),
        HttpApiEndpoint.delete("remove", ThreadPaths.remove, {
          params: { threadID: Thread.ID },
          success: Schema.Void,
          error: [ApiNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "thread.remove",
            summary: "Delete thread",
            description: "Delete a thread and disassociate its sessions.",
          }),
        ),
        HttpApiEndpoint.get("sessions", ThreadPaths.sessions, {
          params: { threadID: Thread.ID },
          success: described(Schema.Array(Schema.Struct({ id: Schema.String, title: Schema.String })), "Sessions in thread"),
          error: [ApiNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "thread.sessions",
            summary: "List sessions in thread",
            description: "List all sessions belonging to a thread.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "thread",
          description: "Thread management for parallel agent orchestration.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(Authorization),
  )
