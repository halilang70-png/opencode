export * as ThreadEvent from "./thread-event"

import { Schema } from "effect"
import { Event } from "./event"
import { ThreadID } from "./thread-id"

export const Created = Event.define({
  type: "thread.created",
  schema: {
    threadID: ThreadID,
    title: Schema.String,
    projectID: Schema.String,
    agent: Schema.String.pipe(Schema.optional),
    parentID: ThreadID.pipe(Schema.optional),
    worktreePath: Schema.String.pipe(Schema.optional),
    worktreeBranch: Schema.String.pipe(Schema.optional),
  },
})

export const Updated = Event.define({
  type: "thread.updated",
  schema: {
    threadID: ThreadID,
    title: Schema.String.pipe(Schema.optional),
    agent: Schema.String.pipe(Schema.optional),
    status: Schema.Literals(["active", "idle", "completed"]).pipe(Schema.optional),
    worktreePath: Schema.String.pipe(Schema.optional),
    worktreeBranch: Schema.String.pipe(Schema.optional),
  },
})

export const Deleted = Event.define({
  type: "thread.deleted",
  schema: {
    threadID: ThreadID,
  },
})

export const Definitions = Event.inventory(Created, Updated, Deleted)
