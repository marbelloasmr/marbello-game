type Listener = () => void

let paused = false
const listeners = new Set<Listener>()

export function isPaused() {
  return paused
}

export function setPaused(next: boolean) {
  if (next === paused) return
  paused = next
  for (const listener of listeners) listener()
}

export function togglePaused() {
  setPaused(!paused)
}

export function subscribePause(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
