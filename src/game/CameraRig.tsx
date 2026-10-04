import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { PerspectiveCamera, Vector3 } from "three"
import { CAMERA_HOME, START_ZONE, TRACK_PATH } from "@/game/trackLayout"
import { marblePose } from "@/game/marblePose"
import { marbleScreen } from "@/game/stuck"
import { previewZoom } from "@/game/spawn"
import { isPaused } from "@/game/pause"
import { useGame } from "@/game/state"

export const cameraShake = { current: 0 }
export const cameraFocus = { x: -1.6, y: 4.8, z: 0.6 }

export type CameraMode = "standard" | "follow" | "free"
const cameraListeners = new Set<() => void>()
let cameraMode: CameraMode = "follow"

export function subscribeCamera(listener: () => void) {
  cameraListeners.add(listener)
  return () => cameraListeners.delete(listener)
}

export function getCameraMode() {
  return cameraMode
}

export function setCameraMode(mode: CameraMode) {
  if (mode === cameraMode) return
  cameraMode = mode
  for (const listener of cameraListeners) listener()
}

export const manualYaw = { target: 0, current: 0 }
export const manualPitch = { target: 0, current: 0 }
const PITCH_MIN = -1.15
const PITCH_MAX = 1.15

export function addManualYaw(delta: number) {
  manualYaw.target = wrapAngle(manualYaw.target + delta)
}

export function addManualPitch(delta: number) {
  manualPitch.target = clamp(manualPitch.target + delta, PITCH_MIN, PITCH_MAX)
}

function wrapAngle(rad: number) {
  const turns = (rad + Math.PI) / (Math.PI * 2)
  return (turns - Math.floor(turns)) * Math.PI * 2 - Math.PI
}

function dampAngle(current: number, target: number, responsiveness: number, dt: number) {
  const alpha = 1 - Math.exp(-responsiveness * dt)
  return wrapAngle(current + wrapAngle(target - current) * alpha)
}

const HOME_POS = new Vector3(...CAMERA_HOME.position)
const HOME_LOOK = new Vector3(...CAMERA_HOME.target)
const PATH = TRACK_PATH.map((point) => new Vector3(...point))

function damp(current: number, target: number, responsiveness: number, dt: number) {
  const alpha = 1 - Math.exp(-responsiveness * dt)
  return current + (target - current) * alpha
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function nearestPath(x: number, y: number, z: number, from: number, to: number) {
  let best = from
  let bestD = Infinity
  for (let i = from; i <= to; i++) {
    const point = PATH[i]!
    const dx = point.x - x
    const dy = point.y - y
    const dz = point.z - z
    const d = dx * dx + dy * dy + dz * dz
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function pathTangent(index: number) {
  const prev = PATH[Math.max(0, index - 1)]!
  const next = PATH[Math.min(PATH.length - 1, index + 1)]!
  const out = new Vector3(next.x - prev.x, 0, next.z - prev.z)
  if (out.lengthSq() > 1e-6) out.normalize()
  return out
}

function orbitAround(
  enteredFree: boolean,
  lookX: number,
  lookY: number,
  lookZ: number,
  camX: number,
  camY: number,
  camZ: number,
  fromX: number,
  fromZ: number,
  dt: number,
) {
  const ox = camX - lookX
  const oy = camY - lookY
  const oz = camZ - lookZ
  if (enteredFree) {
    const seeded = wrapAngle(Math.atan2(fromX - lookX, fromZ - lookZ) - Math.atan2(ox, oz))
    manualYaw.target = seeded
    manualYaw.current = seeded
    manualPitch.target = 0
    manualPitch.current = 0
  } else if (cameraMode !== "free") {
    manualYaw.target = 0
    manualPitch.target = 0
  }
  manualYaw.current = dampAngle(manualYaw.current, manualYaw.target, 5.5, dt)
  manualPitch.current = damp(manualPitch.current, manualPitch.target, 5.5, dt)
  const c = Math.cos(manualYaw.current)
  const s = Math.sin(manualYaw.current)
  const rx = ox * c - oz * s
  const rz = ox * s + oz * c
  const horiz = Math.hypot(rx, rz) || 0.001
  const len = Math.hypot(horiz, oy) || 0.001
  const pitched = clamp(Math.atan2(oy, horiz) + manualPitch.current, -0.35, 1.25)
  const nh = Math.cos(pitched) * len
  return {
    x: lookX + (rx / horiz) * nh,
    y: lookY + Math.sin(pitched) * len,
    z: lookZ + (rz / horiz) * nh,
  }
}

function orbitActive() {
  return (
    cameraMode === "free" ||
    Math.abs(manualYaw.current) > 0.0008 ||
    Math.abs(manualYaw.target) > 0.0008 ||
    Math.abs(manualPitch.current) > 0.0008 ||
    Math.abs(manualPitch.target) > 0.0008
  )
}

export function CameraRig() {
  const look = useRef(new Vector3(...CAMERA_HOME.target))
  const rig = useRef(new Vector3(...CAMERA_HOME.position))
  const filteredPos = useRef(new Vector3(...CAMERA_HOME.target))
  const filteredVel = useRef(new Vector3())
  const aimDir = useRef(new Vector3(1, 0, 0))
  const desiredLook = useRef(new Vector3())
  const desiredPos = useRef(new Vector3())
  const ndc = useRef(new Vector3())
  const fov = useRef(36)
  const distSm = useRef(8)
  const liftSm = useRef(3)
  const primed = useRef(false)
  const pathIndex = useRef(0)
  const tangent = useRef(new Vector3(0, 0, 1))
  const freeOn = useRef(false)
  const { phase } = useGame()
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Priority 0 runs after physics (-2) and the marble pose copy (-1).
  // A positive priority would disable R3F's render loop, leaving only the HUD.
  useFrame((state, delta) => {
    if (isPaused()) {
      if (cameraMode !== "free") {
        freeOn.current = false
        return
      }
      const dt = Math.min(delta, 0.05)
      const camera = state.camera as PerspectiveCamera
      const enteredFree = !freeOn.current
      freeOn.current = true
      const spun = orbitAround(
        enteredFree,
        look.current.x,
        look.current.y,
        look.current.z,
        rig.current.x,
        rig.current.y,
        rig.current.z,
        rig.current.x,
        rig.current.z,
        dt,
      )
      rig.current.set(spun.x, spun.y, spun.z)
      camera.position.copy(rig.current)
      camera.up.set(0, 1, 0)
      camera.lookAt(look.current)
      return
    }
    const dt = Math.min(delta, 0.05)
    const camera = state.camera as PerspectiveCamera
    const enteredFree = cameraMode === "free" && !freeOn.current
    freeOn.current = cameraMode === "free"
    const portrait = state.size.height > state.size.width
    const filming = (phase === "running" || phase === "done") && marblePose.on

    if (!filming) {
      primed.current = false
      const resp = reduce ? 6 : 5
      const homeX = portrait ? -0.4 : HOME_POS.x
      const homeY = portrait ? 8.6 : HOME_POS.y
      const homeZ = portrait ? 38 : HOME_POS.z
      const lookX = portrait ? -1.6 : HOME_LOOK.x
      const lookY = portrait ? 4.8 : HOME_LOOK.y
      const lookZ = portrait ? 0.6 : HOME_LOOK.z
      const dx = homeX - lookX
      const dy = homeY - lookY
      const dz = homeZ - lookZ
      const len = Math.hypot(dx, dy, dz) || 1
      const zoom = clamp(previewZoom.distance, 0.34, 1.15)
      let aimX = lookX
      let aimY = lookY
      let aimZ = lookZ
      let dist = len * zoom
      if (previewZoom.zone) {
        const mid = START_ZONE.points[1] ?? START_ZONE.points[0]!
        aimX = mid[0]
        aimY = mid[1] + 0.5
        aimZ = mid[2]
        const close = portrait ? 6.4 : 6
        const framed = portrait ? 9 : 8
        if (zoom <= 0.42) {
          const t = (zoom - 0.34) / (0.42 - 0.34)
          dist = close + t * (framed - close)
        } else {
          const t = (Math.min(zoom, 1) - 0.42) / (1 - 0.42)
          dist = framed + t * (len - framed)
        }
      } else if (marblePose.on) {
        const focusBlend = clamp(1 - zoom, 0, 0.82)
        aimX = lookX + (marblePose.x - lookX) * focusBlend
        aimY = lookY + (marblePose.y - lookY) * focusBlend * 0.7
        aimZ = lookZ + (marblePose.z - lookZ) * focusBlend
      }
      let camX = aimX + (dx / len) * dist
      let camY = aimY + (dy / len) * dist
      let camZ = aimZ + (dz / len) * dist
      let fovTarget = portrait ? 48 : 36
      if ((cameraMode === "follow" || cameraMode === "free") && marblePose.on) {
        const from = START_ZONE.points[0]!
        const to = START_ZONE.points[Math.min(START_ZONE.points.length - 1, 2)]!
        let tx = to[0] - from[0]
        let tz = to[2] - from[2]
        const tlen = Math.hypot(tx, tz) || 1
        tx /= tlen
        tz /= tlen
        const back = (portrait ? 3.5 : 4.3) * (0.72 + zoom * 0.4)
        const lift = portrait ? 1.35 : 1.75
        aimX = marblePose.x + tx * 1.4
        aimY = marblePose.y + 0.2
        aimZ = marblePose.z + tz * 1.4
        camX = marblePose.x - tx * back
        camY = marblePose.y + lift
        camZ = marblePose.z - tz * back
        fovTarget = portrait ? 52 : 44
        if (orbitActive()) {
          const spun = orbitAround(enteredFree, aimX, aimY, aimZ, camX, camY, camZ, rig.current.x, rig.current.z, dt)
          camX = spun.x
          camY = spun.y
          camZ = spun.z
        }
      }
      rig.current.x = damp(rig.current.x, camX, resp, dt)
      rig.current.y = damp(rig.current.y, camY, resp, dt)
      rig.current.z = damp(rig.current.z, camZ, resp, dt)
      look.current.x = damp(look.current.x, aimX, resp, dt)
      look.current.y = damp(look.current.y, aimY, resp, dt)
      look.current.z = damp(look.current.z, aimZ, resp, dt)
      fov.current = damp(fov.current, fovTarget, 2.2, dt)
      filteredPos.current.copy(look.current)
      filteredVel.current.set(0, 0, 0)
      pathIndex.current = 0
      camera.position.copy(rig.current)
      camera.up.set(0, 1, 0)
      camera.lookAt(look.current)
      cameraFocus.x = look.current.x
      cameraFocus.y = look.current.y
      cameraFocus.z = look.current.z
      if (Math.abs(camera.fov - fov.current) > 0.04) {
        camera.fov = fov.current
        camera.updateProjectionMatrix()
      }
      cameraShake.current = 0
      return
    }

    if (!primed.current) {
      filteredPos.current.set(marblePose.x, marblePose.y, marblePose.z)
      filteredVel.current.set(marblePose.vx, marblePose.vy, marblePose.vz)
      pathIndex.current = nearestPath(marblePose.x, marblePose.y, marblePose.z, 0, PATH.length - 1)
      primed.current = true
    }

    if (cameraMode === "follow" || cameraMode === "free") {
      const speed = Math.hypot(marblePose.vx, marblePose.vy, marblePose.vz)
      const speedN = clamp(speed / 7, 0, 1)
      const from = Math.max(0, pathIndex.current - 6)
      const to = Math.min(PATH.length - 1, pathIndex.current + 18)
      pathIndex.current = nearestPath(marblePose.x, marblePose.y, marblePose.z, from, to)
      const along = pathTangent(pathIndex.current)
      if (along.lengthSq() > 1e-4) {
        tangent.current.x = damp(tangent.current.x, along.x, 2.4, dt)
        tangent.current.z = damp(tangent.current.z, along.z, 2.4, dt)
        const tlen = Math.hypot(tangent.current.x, tangent.current.z) || 1
        tangent.current.x /= tlen
        tangent.current.z /= tlen
      }

      const posFollow = 6 + speedN * 2
      filteredPos.current.x = damp(filteredPos.current.x, marblePose.x, posFollow, dt)
      filteredPos.current.y = damp(filteredPos.current.y, marblePose.y, posFollow, dt)
      filteredPos.current.z = damp(filteredPos.current.z, marblePose.z, posFollow, dt)
      const anchor = filteredPos.current
      const tx = tangent.current.x
      const tz = tangent.current.z

      const dist = (portrait ? 6.4 : 7.2) + speedN * 0.8
      const lift = portrait ? 2.55 : 2.9
      distSm.current = damp(distSm.current, dist, 2.2, dt)
      liftSm.current = damp(liftSm.current, lift, 2.2, dt)

      desiredLook.current.set(anchor.x + tx * 0.85, anchor.y + 0.12, anchor.z + tz * 0.85)
      desiredPos.current.set(anchor.x - tx * distSm.current, anchor.y + liftSm.current, anchor.z - tz * distSm.current)
      if (orbitActive()) {
        const spun = orbitAround(
          enteredFree,
          desiredLook.current.x,
          desiredLook.current.y,
          desiredLook.current.z,
          desiredPos.current.x,
          desiredPos.current.y,
          desiredPos.current.z,
          rig.current.x,
          rig.current.z,
          dt,
        )
        desiredPos.current.x = spun.x
        desiredPos.current.y = spun.y
        desiredPos.current.z = spun.z
      }

      const resp = reduce ? 4 : 3.4 + speedN * 1.2
      rig.current.x = damp(rig.current.x, desiredPos.current.x, resp, dt)
      rig.current.y = damp(rig.current.y, desiredPos.current.y, resp, dt)
      rig.current.z = damp(rig.current.z, desiredPos.current.z, resp, dt)
      look.current.x = damp(look.current.x, desiredLook.current.x, resp + 0.6, dt)
      look.current.y = damp(look.current.y, desiredLook.current.y, resp + 0.6, dt)
      look.current.z = damp(look.current.z, desiredLook.current.z, resp + 0.6, dt)
      fov.current = damp(fov.current, (portrait ? 46 : 38) + (reduce ? 0 : speedN * 1.2), 1.4, dt)
    } else {
      const velFollow = 1.8
      filteredVel.current.x = damp(filteredVel.current.x, marblePose.vx, velFollow, dt)
      filteredVel.current.y = damp(filteredVel.current.y, marblePose.vy, velFollow, dt)
      filteredVel.current.z = damp(filteredVel.current.z, marblePose.vz, velFollow, dt)
      const svx = filteredVel.current.x
      const svy = filteredVel.current.y
      const svz = filteredVel.current.z
      const speed = Math.hypot(svx, svy, svz)
      const horiz = Math.hypot(svx, svz)
      const speedN = clamp(speed / 7, 0, 1)
      const dropAmt = clamp((-svy - 0.45) / 2.4, 0, 1)
      const fastAmt = clamp((-svy - 1.6) / 2.2, 0, 1)

      camera.updateMatrixWorld()
      ndc.current.set(marblePose.x, marblePose.y, marblePose.z).project(camera)
      const nx = Number.isFinite(ndc.current.x) ? ndc.current.x : 0
      const ny = Number.isFinite(ndc.current.y) ? ndc.current.y : 0
      const behind = !Number.isFinite(ndc.current.z) || ndc.current.z < 0 || ndc.current.z > 1
      const edge = Math.max(Math.abs(nx), Math.abs(ny))
      const edgePush = behind ? 1 : clamp((edge - 0.66) / 0.28, 0, 1)

      const posFollowX = 3.2 + edgePush * 3.5
      const posFollowY = 4.8 + fastAmt * 2.4 + edgePush * 3
      filteredPos.current.x = damp(filteredPos.current.x, marblePose.x, posFollowX, dt)
      filteredPos.current.y = damp(filteredPos.current.y, marblePose.y, posFollowY, dt)
      filteredPos.current.z = damp(filteredPos.current.z, marblePose.z, posFollowX, dt)

      let lookT = (portrait ? 0.22 : 0.16) + speedN * 0.1 + fastAmt * (portrait ? 0.1 : 0.06)
      if (reduce) lookT *= 0.5
      lookT *= 1 - edgePush * 0.45
      const posT = lookT * 0.35

      if (horiz > 0.65) {
        aimDir.current.x = damp(aimDir.current.x, svx / horiz, 1.6, dt)
        aimDir.current.z = damp(aimDir.current.z, svz / horiz, 1.6, dt)
      }

      const leadScale = 1 - edgePush * 0.65
      let leadX = svx * lookT * leadScale
      let leadY = svy * lookT * leadScale
      let leadZ = svz * lookT * leadScale
      const leadLen = Math.hypot(leadX, leadY, leadZ)
      const leadCap = 1.15 + fastAmt * 0.7
      if (leadLen > leadCap) {
        const s = leadCap / leadLen
        leadX *= s
        leadY *= s
        leadZ *= s
      }

      const anchor = filteredPos.current
      const ahead = (portrait ? 0.42 : 0.28) * leadScale
      desiredLook.current.set(
        anchor.x + leadX + aimDir.current.x * ahead,
        anchor.y + leadY - dropAmt * (portrait ? 0.85 : 0.42),
        anchor.z + leadZ + aimDir.current.z * 0.12 * leadScale,
      )

      let dist = (portrait ? 8.2 : 8.8) + speedN * 1.3 + fastAmt * (portrait ? 1.1 : 0.6)
      if (edgePush > 0.2) dist += 0.8 * edgePush
      dist = clamp(dist, portrait ? 7.4 : 8, portrait ? 11.6 : 10.8)
      const lift = (portrait ? 3.05 : 3.35) + fastAmt * 0.35
      distSm.current = damp(distSm.current, dist, 1.5, dt)
      liftSm.current = damp(liftSm.current, lift, 1.5, dt)

      desiredPos.current.set(anchor.x + svx * posT, anchor.y + svy * posT + liftSm.current, anchor.z + distSm.current)
      const minZ = anchor.z + 5.6
      if (desiredPos.current.z < minZ) desiredPos.current.z = minZ

      const resp = reduce ? 4.2 : 2.7 + speedN * 0.8 + fastAmt * 1.1 + edgePush * 2.4
      rig.current.x = damp(rig.current.x, desiredPos.current.x, resp, dt)
      rig.current.y = damp(rig.current.y, desiredPos.current.y, resp + fastAmt * 1.2, dt)
      rig.current.z = damp(rig.current.z, desiredPos.current.z, resp, dt)
      const lookResp = resp + 0.3
      look.current.x = damp(look.current.x, desiredLook.current.x, lookResp, dt)
      look.current.y = damp(look.current.y, desiredLook.current.y, lookResp, dt)
      look.current.z = damp(look.current.z, desiredLook.current.z, lookResp, dt)
      fov.current = damp(fov.current, (portrait ? 42 : 35.5) + (reduce ? 0 : speedN * 1.6 + fastAmt), 1.1 + edgePush, dt)
    }

    camera.position.copy(rig.current)
    camera.up.set(0, 1, 0)
    camera.lookAt(look.current)
    cameraFocus.x = look.current.x
    cameraFocus.y = look.current.y
    cameraFocus.z = look.current.z
    if (Math.abs(camera.fov - fov.current) > 0.05) {
      camera.fov = fov.current
      camera.updateProjectionMatrix()
    }
    cameraShake.current = 0
    if (filming && marblePose.on) {
      ndc.current.set(marblePose.x, marblePose.y + 0.28, marblePose.z).project(camera)
      const seen = ndc.current.z > 0 && ndc.current.z < 1
      marbleScreen.visible = seen
      marbleScreen.x = (ndc.current.x * 0.5 + 0.5) * state.size.width
      marbleScreen.y = (-ndc.current.y * 0.5 + 0.5) * state.size.height
    } else {
      marbleScreen.visible = false
    }
  }, 0)

  return null
}
