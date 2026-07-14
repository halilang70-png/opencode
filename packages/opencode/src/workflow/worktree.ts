import { execSync } from "child_process"
import path from "path"

export interface WorktreeInfo {
  path: string
  branch: string
  createdAt: number
}

export function createWorktree(basePath: string, branch: string): WorktreeInfo {
  const worktreePath = path.join(basePath, `.worktrees/${branch}`)

  try {
    execSync(`git worktree add "${worktreePath}" -b "${branch}"`, {
      cwd: basePath,
      stdio: "pipe",
    })
  } catch {
    // Branch might already exist, try checking out
    try {
      execSync(`git worktree add "${worktreePath}" "${branch}"`, {
        cwd: basePath,
        stdio: "pipe",
      })
    } catch (e) {
      throw new Error(`Failed to create worktree: ${e}`)
    }
  }

  return {
    path: worktreePath,
    branch,
    createdAt: Date.now(),
  }
}

export function removeWorktree(basePath: string, worktreePath: string): void {
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: basePath,
      stdio: "pipe",
    })
  } catch (e) {
    console.error(`Failed to remove worktree: ${e}`)
  }
}

export function listWorktrees(basePath: string): string[] {
  try {
    const output = execSync("git worktree list --porcelain", {
      cwd: basePath,
      encoding: "utf-8",
    })

    return output
      .split("\n")
      .filter((line) => line.startsWith("worktree "))
      .map((line) => line.replace("worktree ", "").trim())
  } catch {
    return []
  }
}

export function mergeWorktree(basePath: string, worktreePath: string): { success: boolean; output: string } {
  try {
    const output = execSync(`git merge "${worktreePath}" --no-edit`, {
      cwd: basePath,
      encoding: "utf-8",
      stdio: "pipe",
    })
    return { success: true, output }
  } catch (e: any) {
    return { success: false, output: e.stderr || e.message }
  }
}

export function getWorktreeDiff(worktreePath: string): string {
  try {
    return execSync("git diff", {
      cwd: worktreePath,
      encoding: "utf-8",
    })
  } catch {
    return ""
  }
}

export function getWorktreeStatus(worktreePath: string): string {
  try {
    return execSync("git status --porcelain", {
      cwd: worktreePath,
      encoding: "utf-8",
    })
  } catch {
    return ""
  }
}
