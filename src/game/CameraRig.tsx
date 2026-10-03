import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Vector3 } from "three"
import { CAMERA_HOME, ZONES } from "@/game/trackLayout"
import { marblePose } from "@/game/marblePose"
import { useGame } from "@/game/state"

export const cameraShake = { current: 0 }

export function CameraRig() {
  const { camera } = useThree()
  const look = useRef(new Vector3(...CAMERA_HOME.target))
  const homePos = useRef(new Vector3(...CAMERA_HOME.position))
  const homeLook = useRef(new Vector3(...CAMERA_HOME.target))
  const marble = useRef(new Vector3())
  const bowl = useRef(new Vector3(...ZONES.bowl))
  const funnel = useRef(new Vector3(...ZONES.funnel))
  const spiral = useRef(new Vector3(...ZONES.spiral))
  const { phase } = useGame()
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const pos = homePos.current
    const aim = homeLook.current
    let tx = pos.x
    let ty = pos.y
    let tz = pos.z
    let lx = aim.x
    let ly = aim.y
    let lz = aim.z
    if ((phase === "running" || phase === "done") && marblePose.on) {
      const p = marble.current.set(marblePose.x, marblePose.y, marblePose.z)
      if (p.distanceTo(bowl.current) < 1.9) {
        tx = p.x + 1.15
        ty = p.y + 1.85
        tz = p.z + 1.55
      } else if (p.distanceTo(funnel.current) < 2.1) {
        tx = p.x + 0.35
        ty = p.y + 2.5
        tz = p.z + 1.7
      } else if (p.distanceTo(spiral.current) < 2.4) {
        tx = p.x + 2.3
        ty = p.y + 2.35
        tz = p.z + 2.2
      } else {
        tx = p.x - 1.35
        ty = p.y + 1.7
        tz = p.z + 2.55
      }
      lx = p.x
      ly = p.y
      lz = p.z
    }
    const k = 1 - Math.pow(phase === "ready" ? 0.08 : 0.045, dt)
    camera.position.x += (tx - camera.position.x) * k
    camera.position.y += (ty - camera.position.y) * k
    camera.position.z += (tz - camera.position.z) * k
    look.current.x += (lx - look.current.x) * k
    look.current.y += (ly - look.current.y) * k
    look.current.z += (lz - look.current.z) * k
    camera.lookAt(look.current)
    if (!reduce && cameraShake.current > 0.001) {
      camera.position.x += (Math.random() - 0.5) * cameraShake.current
      camera.position.y += (Math.random() - 0.5) * cameraShake.current
      cameraShake.current *= 0.86
    } else {
      cameraShake.current = 0
    }
  })

  return null
}
