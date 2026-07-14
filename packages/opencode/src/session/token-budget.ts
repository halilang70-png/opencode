const SHORTHAND_START = /^\s*\+(\d+(?:\.\d+)?)\s*([kKmMbB])?\s*/i
const SHORTHAND_END = /(?:^|\s)\+(\d+(?:\.\d+)?)\s*([kKmMbB])?\s*[.!,;:)\]]?\s*$/i
const VERBOSE = /(?:use|spend|budget|target)\s+(\d+(?:\.\d+)?)\s*([kKmMbB])?\s*tokens?/i

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
}

function parseBudgetNumber(match: RegExpMatchArray | null): number | null {
  if (!match) return null
  const value = parseFloat(match[1])
  const suffix = match[2]?.toLowerCase()
  const multiplier = suffix ? MULTIPLIERS[suffix] ?? 1 : 1
  return Math.round(value * multiplier)
}

export function parseTokenBudget(text: string): number | null {
  const startMatch = text.match(SHORTHAND_START)
  if (startMatch) return parseBudgetNumber(startMatch)
  const endMatch = text.match(SHORTHAND_END)
  if (endMatch) return parseBudgetNumber(endMatch)
  const verboseMatch = text.match(VERBOSE)
  if (verboseMatch) return parseBudgetNumber(verboseMatch)
  return null
}

export function getBudgetContinuationMessage(pct: number, turnTokens: number, budget: number): string {
  const pctStr = Math.round(pct * 100)
  return `Stopped at ${pctStr}% of token target (${turnTokens.toLocaleString()} / ${budget.toLocaleString()}). Keep working — do not summarize.`
}

const COMPLETION_THRESHOLD = 0.9
const DIMINISHING_THRESHOLD = 500
const MIN_CONTINUATIONS_FOR_DIMINISHING = 3

export interface BudgetTracker {
  continuationCount: number
  lastDeltaTokens: number
  lastGlobalTurnTokens: number
  cumulativeOutputTokens: number
}

export function createBudgetTracker(): BudgetTracker {
  return { continuationCount: 0, lastDeltaTokens: 0, lastGlobalTurnTokens: 0, cumulativeOutputTokens: 0 }
}

export interface BudgetCheckResult {
  action: "continue" | "stop"
  message?: string
}

export function checkTokenBudget(
  tracker: BudgetTracker,
  budget: number | null,
  globalTurnTokens: number,
): BudgetCheckResult {
  if (!budget || budget <= 0) return { action: "stop" }

  const delta = Math.max(0, globalTurnTokens - tracker.lastGlobalTurnTokens)
  const isDiminishing =
    tracker.continuationCount >= MIN_CONTINUATIONS_FOR_DIMINISHING &&
    delta < DIMINISHING_THRESHOLD &&
    tracker.lastDeltaTokens < DIMINISHING_THRESHOLD

  tracker.lastDeltaTokens = delta
  tracker.lastGlobalTurnTokens = globalTurnTokens

  if (globalTurnTokens >= budget * COMPLETION_THRESHOLD) {
    return { action: "stop" }
  }

  if (isDiminishing) {
    return { action: "stop" }
  }

  tracker.continuationCount++
  const pct = globalTurnTokens / budget
  return {
    action: "continue",
    message: getBudgetContinuationMessage(pct, globalTurnTokens, budget),
  }
}
