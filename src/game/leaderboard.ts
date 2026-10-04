export type BoardEntry = {
  score: number
  seconds: number
  marble: string
  at: number
}

const KEY = "marbello-leaderboard"
const listeners = new Set<() => void>()

function load(): BoardEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]") as BoardEntry[]
    if (!Array.isArray(raw)) return []
    return raw.filter((row) => typeof row?.score === "number").slice(0, 10)
  } catch {
    return []
  }
}

let rows = load()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeBoard(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBoard() {
  return rows
}

export function recordRun(entry: BoardEntry) {
  rows = [...rows, entry].sort((a, b) => b.score - a.score || a.seconds - b.seconds).slice(0, 10)
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(rows))
  emit()
}
