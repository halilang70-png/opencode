import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/sql"
import { ProjectV2 } from "../project"
import { Thread } from "@opencode-ai/schema/thread"

export const ThreadTable = sqliteTable(
  "thread",
  {
    id: text().$type<Thread.ID>().primaryKey(),
    project_id: text()
      .$type<ProjectV2.ID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    title: text().notNull().default(""),
    agent: text(),
    parent_id: text().$type<Thread.ID>(),
    worktree_path: text(),
    worktree_branch: text(),
    status: text().notNull().default("active"),
    time_created: integer().notNull().$default(() => Date.now()),
    time_updated: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    index("thread_project_idx").on(table.project_id),
    index("thread_parent_idx").on(table.parent_id),
    index("thread_status_idx").on(table.status),
  ],
)
