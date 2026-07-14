export * as Thread from "./thread"

import { Schema } from "effect"
import { Agent } from "./agent"
import { Project } from "./project"
import { DateTimeUtcFromMillis, optional } from "./schema"
import { ThreadEvent } from "./thread-event"
import { ThreadID } from "./thread-id"

export const ID = ThreadID
export type ID = ThreadID

export const Event = ThreadEvent

export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID,
  projectID: Project.ID,
  title: Schema.String,
  agent: Agent.ID.pipe(optional),
  parentID: ID.pipe(optional),
  worktreePath: Schema.String.pipe(optional),
  worktreeBranch: Schema.String.pipe(optional),
  status: Schema.Literals(["active", "idle", "completed"]),
  time: Schema.Struct({
    created: DateTimeUtcFromMillis,
    updated: DateTimeUtcFromMillis,
  }),
}).annotate({ identifier: "Thread.Info" })
