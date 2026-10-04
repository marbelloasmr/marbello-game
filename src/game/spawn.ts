import type { RapierRigidBody } from "@react-three/rapier"
import { START_POSITION, START_ZONE } from "@/game/trackLayout"

const rampA = START_ZONE.points[0]!
const rampB = START_ZONE.points[1]!
const rampX = rampB[0] - rampA[0]
const rampZ = rampB[2] - rampA[2]
const rampLen = Math.hypot(rampX, rampZ) || 1

/** Horizontal axis across the start ramp. Dragging aims along this. */
export const startSide = { x: -rampZ / rampLen, z: rampX / rampLen }

/** Remembered start line. Again keeps it so the next run can nudge it. */
export const startAim = { offset: 0, lift: 0 }

const AIM_LIMIT = 0.2
const LIFT_UP = 0.48
const LIFT_DOWN = 0.06
const AIM_SNAP = 0.035

export function setStartAim(offset: number, lift: number) {
  const clamped = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, offset))
  const raised = Math.max(-LIFT_DOWN, Math.min(LIFT_UP, lift))
  startAim.offset = Math.abs(clamped) < AIM_SNAP ? 0 : clamped
  startAim.lift = Math.abs(raised) < AIM_SNAP ? 0 : raised
}

export function aimedStart() {
  return {
    x: START_POSITION[0] + startSide.x * startAim.offset,
    y: START_POSITION[1] + startAim.lift,
    z: START_POSITION[2] + startSide.z * startAim.offset,
  }
}

function readSavedPower() {
  try {
    const value = Number(localStorage.getItem("marbello-power"))
    if (Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)))
  } catch {
    /* Storage can be blocked. */
  }
  return 55
}

/** 0% is a plain drop. 100% matches a fully drawn slingshot: speed 9 along the ramp. */
export const startPower = { value: readSavedPower(), last: null as number | null }

export function setStartPower(value: number) {
  const next = Math.max(0, Math.min(100, Math.round(value)))
  startPower.value = next
  try {
    localStorage.setItem("marbello-power", String(next))
  } catch {
    /* Ignore storage failures. */
  }
}

export function launchVelocity(power = startPower.value) {
  const t = Math.max(0, Math.min(100, power)) / 100
  const dx = rampB[0] - rampA[0]
  const dy = rampB[1] - rampA[1]
  const dz = rampB[2] - rampA[2]
  const len = Math.hypot(dx, dy, dz) || 1
  const speed = t * 9
  return { vx: (dx / len) * speed, vy: (dy / len) * speed, vz: (dz / len) * speed }
}

/** Where the next run begins. A placed marble keeps this until Again. */
export const spawn = {
  custom: false,
  x: START_POSITION[0],
  y: START_POSITION[1],
  z: START_POSITION[2],
  vx: 0,
  vy: 0,
  vz: 0,
}

export const marbleApi: { body: RapierRigidBody | null } = { body: null }

/** Live flick preview. The placer writes it; the arrow reads it. */
export const throwAim = {
  on: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
}

/** 1 is the wide start view. Smaller moves the camera closer. `zone` frames the start ramp. */
export const previewZoom = { distance: 1, zone: false }

/** Who owns the current pointer gesture in free-camera mode. */
export const freeGesture = {
  owner: "none" as "none" | "marble" | "camera",
  controls: null as { enabled: boolean } | null,
}

export function claimMarbleGesture() {
  freeGesture.owner = "marble"
  if (freeGesture.controls) freeGesture.controls.enabled = false
}

export function claimCameraGesture() {
  if (freeGesture.owner === "marble") return
  freeGesture.owner = "camera"
}

export function releaseGesture() {
  freeGesture.owner = "none"
  if (freeGesture.controls) freeGesture.controls.enabled = true
}

export function setPreviewZoom(distance: number) {
  previewZoom.distance = Math.min(1.15, Math.max(0.34, distance))
  if (previewZoom.distance > 0.96) previewZoom.zone = false
}

/** Pull the ready camera in on the start ramp. */
export function focusStartZone() {
  previewZoom.zone = true
  previewZoom.distance = 0.36
}

/** Placement first. A release onto the dashed ring arms the slingshot. */
export const sling = { armed: false }

const slingListeners = new Set<() => void>()

export function setSlingArmed(armed: boolean) {
  if (sling.armed === armed) return
  sling.armed = armed
  for (const listener of slingListeners) listener()
}

export function subscribeSling(listener: () => void) {
  slingListeners.add(listener)
  return () => {
    slingListeners.delete(listener)
  }
}

export function clearSpawn() {
  spawn.custom = false
  spawn.x = START_POSITION[0]
  spawn.y = START_POSITION[1]
  spawn.z = START_POSITION[2]
  spawn.vx = 0
  spawn.vy = 0
  spawn.vz = 0
  throwAim.on = false
  setSlingArmed(false)
}
