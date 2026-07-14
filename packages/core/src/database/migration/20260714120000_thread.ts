import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260714120000_thread",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`thread\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`title\` text DEFAULT '' NOT NULL,
          \`agent\` text,
          \`parent_id\` text,
          \`worktree_path\` text,
          \`worktree_branch\` text,
          \`status\` text DEFAULT 'active' NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_thread_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`thread_project_idx\` ON \`thread\` (\`project_id\`);`)
      yield* tx.run(`CREATE INDEX \`thread_parent_idx\` ON \`thread\` (\`parent_id\`);`)
      yield* tx.run(`CREATE INDEX \`thread_status_idx\` ON \`thread\` (\`status\`);`)

      // Add thread_id foreign key to session table
      const columns = yield* tx.all<{ name: string }>(`PRAGMA table_info(\`session\`)`)
      if (!columns.some((col) => col.name === "thread_id")) {
        yield* tx.run(`ALTER TABLE \`session\` ADD \`thread_id\` text;`)
        yield* tx.run(`CREATE INDEX \`session_thread_idx\` ON \`session\` (\`thread_id\`);`)
      }
    })
  },
} satisfies DatabaseMigration.Migration
