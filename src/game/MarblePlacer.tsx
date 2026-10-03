import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from "three"
import { marbleApi, previewZoom, setPreviewZoom, setSlingArmed, sling, spawn, throwAim, focusStartZone } from "@/game/spawn"
import { useGame } from "@/game/state"
import { START_ZONE } from "@/game/trackLayout"

const MAX_PULL = 2.5
const MIN_PULL = 0.42
const MAX_THROW = 9

const raycaster = new Raycaster()
const ndc = new Vector2()
const normal = new Vector3()
const planeHit = new Vector3()
const placed = new Vector3()
const scratch = new Vector3()
const right = new Vector3()
const tangent = { x: 1, y: -0.28, z: 0.15 }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pointerNdc(el: HTMLCanvasElement, event: PointerEvent) {
  const rect = el.getBoundingClientRect()
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

/** Keeps the marble over the start ramp: inside the walls, above the floor, not past the ends. */
function clampToStartZone(point: Vector3) {
  const pts = START_ZONE.points
  let best = Infinity
  let cx = pts[0]![0]
  let cy = pts[0]![1]
  let cz = pts[0]![2]
  let lx = 0
  let lz = 0
  let tx = 1
  let tz = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const abx = b[0] - a[0]
    const abz = b[2] - a[2]
    const abLen2 = abx * abx + abz * abz || 1
    const t = clamp(((point.x - a[0]) * abx + (point.z - a[2]) * abz) / abLen2, 0, 1)
    const px = a[0] + abx * t
    const pz = a[2] + abz * t
    const dx = point.x - px
    const dz = point.z - pz
    const dist = dx * dx + dz * dz
    if (dist < best) {
      best = dist
      cx = px
      cy = a[1] + (b[1] - a[1]) * t
      cz = pz
      lx = dx
      lz = dz
      const aby = b[1] - a[1]
      const len3 = Math.hypot(abx, aby, abz) || 1
      tx = abx / len3
      tangent.y = aby / len3
      tz = abz / len3
    }
  }
  const lat = Math.hypot(lx, lz)
  if (lat > START_ZONE.halfWidth && lat > 1e-6) {
    const scale = START_ZONE.halfWidth / lat
    lx *= scale
    lz *= scale
  }
  tangent.x = tx
  tangent.z = tz
  point.x = cx + lx
  point.y = clamp(point.y, cy + START_ZONE.minClear, cy + START_ZONE.maxRise)
  point.z = cz + lz
  return point
}

function writeBody(point: Vector3) {
  const body = marbleApi.body
  if (!body) return
  body.setTranslation({ x: point.x, y: point.y, z: point.z }, true)
  spawn.custom = true
  spawn.x = point.x
  spawn.y = point.y
  spawn.z = point.z
  spawn.vx = 0
  spawn.vy = 0
  spawn.vz = 0
}

function shotVelocity(dx: number, dy: number, dz: number) {
  const pulled = Math.hypot(dx, dy, dz) || 1
  const stretch = clamp((pulled - MIN_PULL) / (MAX_PULL - MIN_PULL), 0, 1)
  const horiz = Math.hypot(dx, dz)
  const hSpeed = stretch * MAX_THROW
  const lob = stretch * (MAX_THROW + 3)
  const aimUp = Math.max(0, dy / pulled) * stretch * 4
  const scale = horiz > 0.04 ? hSpeed / horiz : 0
  return {
    vx: dx * scale,
    vy: lob + aimUp,
    vz: dz * scale,
  }
}

function poseBand(mesh: Object3D, from: Vector3, to: Vector3) {
  const span = from.distanceTo(to)
  mesh.visible = span > 0.05
  if (!mesh.visible) return
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.lookAt(to)
  mesh.scale.set(1, 1, span)
}

export function MarblePlacer() {
  const { camera, gl, scene } = useThree()
  const { phase, throwMarble } = useGame()
  const phaseRef = useRef(phase)
  const throwRef = useRef(throwMarble)
  phaseRef.current = phase
  throwRef.current = throwMarble
  const dragging = useRef(false)
  const moved = useRef(false)
  const slinging = useRef(false)
  const tappedMarble = useRef(false)
  const downAt = useRef({ x: 0, y: 0 })
  const anchor = useRef(new Vector3())
  const grabPlane = useRef(new Plane())
  const bandL = useRef<Object3D>(null)
  const bandR = useRef<Object3D>(null)
  const pointL = useRef<Object3D>(null)
  const pointR = useRef<Object3D>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef(0)

  useEffect(() => {
    if (phase === "ready") return
    throwAim.on = false
    setSlingArmed(false)
  }, [phase])

  useEffect(() => {
    const el = gl.domElement

    const onDown = (event: PointerEvent) => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.current.size >= 2) {
        if (dragging.current) writeBody(anchor.current)
        dragging.current = false
        slinging.current = false
        throwAim.on = false
        const [a, b] = [...pointers.current.values()]
        pinchDist.current = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        return
      }
      if (phaseRef.current !== "ready" || event.button !== 0) return
      const body = marbleApi.body
      if (!body) return
      pointerNdc(el, event)
      raycaster.setFromCamera(ndc, camera)
      const grabbed = raycaster.intersectObjects(scene.children, true).some((item) => {
        return item.object.name === "place-handle" || item.object.name === "play-marble"
      })
      const origin = body.translation()
      anchor.current.set(origin.x, origin.y, origin.z)
      if (grabbed) focusStartZone()
      camera.getWorldDirection(normal)
      grabPlane.current.setFromNormalAndCoplanarPoint(normal, anchor.current)
      dragging.current = true
      moved.current = false
      slinging.current = sling.armed && grabbed
      tappedMarble.current = grabbed
      downAt.current.x = event.clientX
      downAt.current.y = event.clientY
      throwAim.on = false
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        /* Synthetic pointers still drag. */
      }
    }

    const aimFrom = (next: Vector3) => {
      scratch.subVectors(anchor.current, next)
      const pulled = scratch.length()
      if (pulled < 0.08) {
        throwAim.on = false
        return
      }
      const shot = shotVelocity(scratch.x, scratch.y, scratch.z)
      throwAim.on = true
      throwAim.x = next.x
      throwAim.y = next.y
      throwAim.z = next.z
      throwAim.vx = shot.vx
      throwAim.vy = shot.vy
      throwAim.vz = shot.vz
    }

    const onMove = (event: PointerEvent) => {
      const known = pointers.current.get(event.pointerId)
      if (known) {
        known.x = event.clientX
        known.y = event.clientY
      }
      if (pointers.current.size >= 2) {
        if (phaseRef.current === "ready") {
          const [a, b] = [...pointers.current.values()]
          const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
          if (pinchDist.current > 12 && dist > 12) setPreviewZoom(previewZoom.distance * (pinchDist.current / dist))
          pinchDist.current = dist
        }
        dragging.current = false
        return
      }
      if (!dragging.current || phaseRef.current !== "ready") return
      if (!moved.current) {
        const travel = Math.hypot(event.clientX - downAt.current.x, event.clientY - downAt.current.y)
        if (travel < 8) return
        moved.current = true
      }
      pointerNdc(el, event)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(grabPlane.current, planeHit)) return

      if (!slinging.current) {
        if (sling.armed) setSlingArmed(false)
        clampToStartZone(planeHit)
        writeBody(planeHit)
        throwAim.on = false
        return
      }

      scratch.subVectors(planeHit, anchor.current)
      const reach = scratch.length()
      if (reach > MAX_PULL) scratch.multiplyScalar(MAX_PULL / reach)
      placed.copy(anchor.current).add(scratch)
      clampToStartZone(placed)
      writeBody(placed)
      aimFrom(placed)
    }

    const finish = () => {
      if (!dragging.current) return
      dragging.current = false
      const wasSling = slinging.current
      slinging.current = false
      throwAim.on = false
      if (phaseRef.current !== "ready") return
      if (!moved.current) {
        setSlingArmed(tappedMarble.current)
        return
      }
      if (!wasSling) {
        setSlingArmed(true)
        return
      }
      const body = marbleApi.body
      if (!body) return
      const at = body.translation()
      clampToStartZone(placed.set(at.x, at.y, at.z))
      writeBody(placed)
      const dx = anchor.current.x - placed.x
      const dy = anchor.current.y - placed.y
      const dz = anchor.current.z - placed.z
      const pulled = Math.hypot(dx, dy, dz)
      if (pulled < MIN_PULL) {
        writeBody(anchor.current)
        return
      }
      const shot = shotVelocity(dx, dy, dz)
      throwRef.current(placed.x, placed.y, placed.z, shot.vx, shot.vy, shot.vz)
    }

    const onUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId)
      if (pointers.current.size > 0) {
        dragging.current = false
        slinging.current = false
        throwAim.on = false
        return
      }
      finish()
    }

    const onWheel = (event: WheelEvent) => {
      if (phaseRef.current !== "ready") return
      event.preventDefault()
      const dir = event.deltaY > 0 ? 1 : -1
      const mag = Math.min(Math.abs(event.deltaY), 140)
      setPreviewZoom(previewZoom.distance * (1 + dir * mag * 0.0018))
    }

    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onUp)
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onUp)
      el.removeEventListener("wheel", onWheel)
    }
  }, [camera, gl, scene])

  useFrame(() => {
    const left = bandL.current
    const rightBand = bandR.current
    const markL = pointL.current
    const markR = pointR.current
    const body = marbleApi.body
    const show = Boolean(body) && phaseRef.current === "ready" && (sling.armed || slinging.current)
    if (!show || !body || !markL || !markR) {
      if (left) left.visible = false
      if (rightBand) rightBand.visible = false
      if (markL) markL.visible = false
      if (markR) markR.visible = false
      return
    }
    const at = body.translation()
    if (!slinging.current) clampToStartZone(scratch.set(at.x, at.y, at.z))
    const horiz = Math.hypot(tangent.x, tangent.z) || 1
    right.set(-tangent.z / horiz, 0, tangent.x / horiz)
    const base = slinging.current ? anchor.current : at
    markL.visible = true
    markR.visible = true
    markL.position.set(base.x + right.x * 0.34, base.y + 0.22, base.z + right.z * 0.34)
    markR.position.set(base.x - right.x * 0.34, base.y + 0.22, base.z - right.z * 0.34)
    placed.set(at.x, at.y, at.z)
    if (left) poseBand(left, markL.position, placed)
    if (rightBand) poseBand(rightBand, markR.position, placed)
  })

  return (
    <group>
      <mesh ref={pointL} visible={false}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshStandardMaterial color="#ff4b7d" roughness={0.3} emissive="#ff2d6a" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={pointR} visible={false}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshStandardMaterial color="#ff4b7d" roughness={0.3} emissive="#ff2d6a" emissiveIntensity={0.4} />
      </mesh>
      <group ref={bandL} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
          <meshStandardMaterial color="#ff3d78" roughness={0.32} emissive="#ff2a68" emissiveIntensity={0.25} />
        </mesh>
      </group>
      <group ref={bandR} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
          <meshStandardMaterial color="#ff3d78" roughness={0.32} emissive="#ff2a68" emissiveIntensity={0.25} />
        </mesh>
      </group>
    </group>
  )
}
