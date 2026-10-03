import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { PerspectiveCamera, Vector3 } from "three"
import { CAMERA_HOME, START_ZONE } from "@/game/trackLayout"
import { marblePose } from "@/game/marblePose"
import { previewZoom } from "@/game/spawn"
import { useGame } from "@/game/state"

export const cameraShake = { current: 0 }

const HOME_POS = new Vector3(...CAMERA_HOME.position)
const HOME_LOOK = new Vector3(...CAMERA_HOME.target)

function damp(current: number, target: number, responsiveness: number, dt: number) {
  const alpha = 1 - Math.exp(-responsiveness * dt)
  return current + (target - current) * alpha
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
  const { phase } = useGame()
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Priority 0 runs after physics (-2) and the marble pose copy (-1).
  // A positive priority would disable R3F's render loop, leaving only the HUD.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const camera = state.camera as PerspectiveCamera
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
      rig.current.x = damp(rig.current.x, aimX + (dx / len) * dist, resp, dt)
      rig.current.y = damp(rig.current.y, aimY + (dy / len) * dist, resp, dt)
      rig.current.z = damp(rig.current.z, aimZ + (dz / len) * dist, resp, dt)
      look.current.x = damp(look.current.x, aimX, resp, dt)
      look.current.y = damp(look.current.y, aimY, resp, dt)
      look.current.z = damp(look.current.z, aimZ, resp, dt)
      fov.current = damp(fov.current, portrait ? 48 : 36, 2.2, dt)
      filteredPos.current.copy(look.current)
      filteredVel.current.set(0, 0, 0)
      camera.position.copy(rig.current)
      camera.up.set(0, 1, 0)
      camera.lookAt(look.current)
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
      primed.current = true
    }

    // Low-pass the physics. Impacts rattle velocity every frame; the rig should not.
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
    let lift = (portrait ? 3.05 : 3.35) + fastAmt * 0.35
    distSm.current = damp(distSm.current, dist, 1.5, dt)
    liftSm.current = damp(liftSm.current, lift, 1.5, dt)

    desiredPos.current.set(
      anchor.x + svx * posT,
      anchor.y + svy * posT + liftSm.current,
      anchor.z + distSm.current,
    )
    const minZ = anchor.z + 5.6
    if (desiredPos.current.z < minZ) desiredPos.current.z = minZ

    let resp = reduce ? 4.2 : 2.7 + speedN * 0.8 + fastAmt * 1.1 + edgePush * 2.4
    rig.current.x = damp(rig.current.x, desiredPos.current.x, resp, dt)
    rig.current.y = damp(rig.current.y, desiredPos.current.y, resp + fastAmt * 1.2, dt)
    rig.current.z = damp(rig.current.z, desiredPos.current.z, resp, dt)
    const lookResp = resp + 0.3
    look.current.x = damp(look.current.x, desiredLook.current.x, lookResp, dt)
    look.current.y = damp(look.current.y, desiredLook.current.y, lookResp, dt)
    look.current.z = damp(look.current.z, desiredLook.current.z, lookResp, dt)

    const fovTarget = reduce
      ? portrait
        ? 42
        : 36
      : (portrait ? 42 : 35.5) + speedN * 1.6 + fastAmt * 1
    fov.current = damp(fov.current, fovTarget, 1.1 + edgePush, dt)

    camera.position.copy(rig.current)
    camera.up.set(0, 1, 0)
    camera.lookAt(look.current)
    if (Math.abs(camera.fov - fov.current) > 0.05) {
      camera.fov = fov.current
      camera.updateProjectionMatrix()
    }
    cameraShake.current = 0
  }, 0)

  return null
}
