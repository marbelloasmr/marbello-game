import { gameConfig } from "@/config/gameConfig"
import { isPaused } from "@/game/pause"
import { marbleApi } from "@/game/spawn"
import { TRACK_PATH } from "@/game/trackLayout"

type Listener = () => void

export const marbleScreen = { x: 0, y: 0, visible: false }
const listeners = new Set<Listener>()
let stuck = false
let primed = false
let anchor = { x: 0, z: 0, t: 0 }

function emit(next: boolean) {
  if (next === stuck) return
  stuck = next
  for (const listener of listeners) listener()
}

export function subscribeStuck(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isStuck() {
  return stuck
}

/** Marks the marble stuck when it makes no forward progress for 4 seconds. */
export function watchStuck(phase: string, x: number, y: number, z: number, now: number) {
  void y
  if (phase !== "running" || isPaused()) {
    primed = false
    if (phase !== "running") emit(false)
    return
  }
  if (!primed) {
    primed = true
    anchor = { x, z, t: now }
    emit(false)
    return
  }
  if (Math.hypot(x - anchor.x, z - anchor.z) > 0.45) {
    anchor = { x, z, t: now }
    emit(false)
    return
  }
  if (now - anchor.t >= 4000) emit(true)
}

/** Nudge the marble forward along the track. */
export function unstuck() {
  const body = marbleApi.body
  if (!body) return
  const p = body.translation()
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < TRACK_PATH.length; i++) {
    const point = TRACK_PATH[i]!
    const d = (point[0] - p.x) ** 2 + (point[1] - p.y) ** 2 + (point[2] - p.z) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const here = TRACK_PATH[best]!
  const next = TRACK_PATH[Math.min(TRACK_PATH.length - 1, best + 4)]!
  let tx = next[0] - here[0]
  let tz = next[2] - here[2]
  const len = Math.hypot(tx, tz) || 1
  tx /= len
  tz /= len
  body.wakeUp()
  body.setTranslation(
    { x: next[0], y: next[1] + gameConfig.marbleRadius + 0.08, z: next[2] },
    true,
  )
  body.setLinvel({ x: tx * 2.4, y: 0.4, z: tz * 2.4 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  anchor = { x: next[0], z: next[2], t: performance.now() }
  primed = true
  emit(false)
}
