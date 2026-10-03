import type { RapierRigidBody } from "@react-three/rapier"
import { START_POSITION } from "@/game/trackLayout"

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
