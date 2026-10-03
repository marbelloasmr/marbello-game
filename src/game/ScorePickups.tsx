import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { BallCollider, CuboidCollider, RigidBody } from "@react-three/rapier"
import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from "three"
import { getAudio } from "@/audio/AudioEngine"
import { GLASS_TARGETS, MARBLE_GEMS, type GemSpot, type GlassSpot } from "@/game/trackLayout"
import { useGame } from "@/game/state"

const GEM_POINTS = 100
const GOLD_POINTS = 500
const GLASS_POINTS = 250

export function ScorePickups() {
  const { runId } = useGame()
  return (
    <group key={runId}>
      {MARBLE_GEMS.map((gem) => (
        <Gem key={gem.id} gem={gem} />
      ))}
      {GLASS_TARGETS.map((target) => (
        <GlassTarget key={target.id} target={target} />
      ))}
    </group>
  )
}

function labelTexture(text: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.clearRect(0, 0, 256, 96)
  ctx.font = "700 54px sans-serif"
  ctx.textAlign = "center"
  ctx.fillStyle = "#fff8dc"
  ctx.strokeStyle = "#1a2744"
  ctx.lineWidth = 8
  ctx.strokeText(text, 128, 64)
  ctx.fillText(text, 128, 64)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function Burst({
  position,
  color,
  text,
  count,
  life,
  spread,
}: {
  position: [number, number, number]
  color: string
  text: string
  count: number
  life: number
  spread: number
}) {
  const group = useRef<Group>(null)
  const born = useRef(0)
  const bits = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        v: new Vector3((Math.random() - 0.5) * spread, 0.6 + Math.random() * spread * 0.45, (Math.random() - 0.5) * spread),
        spin: Math.random() * 6,
      })),
    [count, spread],
  )
  const sprite = useMemo(() => {
    const tex = labelTexture(text)
    const mat = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const s = new Sprite(mat)
    s.scale.set(0.55, 0.22, 1)
    return s
  }, [text])

  useEffect(() => {
    born.current = performance.now()
    return () => {
      sprite.material.map?.dispose()
      sprite.material.dispose()
    }
  }, [sprite])

  useFrame(() => {
    const root = group.current
    if (!root) return
    const t = (performance.now() - born.current) / 1000
    const fade = Math.max(0, 1 - t / life)
    bits.forEach((bit, index) => {
      const child = root.children[index]
      if (!child) return
      child.position.set(bit.v.x * t, bit.v.y * t - 1.4 * t * t, bit.v.z * t)
      child.rotation.x += bit.spin * 0.016
      const mat = (child as { material?: { opacity: number } }).material
      if (mat) mat.opacity = fade
    })
    sprite.position.set(0, 0.18 + t * 0.7, 0)
    sprite.material.opacity = fade
  })

  return (
    <group ref={group} position={position}>
      {bits.map((_, index) => (
        <mesh key={index}>
          <boxGeometry args={[0.045, 0.03, 0.02]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
      <primitive object={sprite} />
    </group>
  )
}

function Gem({ gem }: { gem: GemSpot }) {
  const { award, phase } = useGame()
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const mesh = useRef<Group>(null)
  const [state, setState] = useState<"idle" | "pop" | "gone">("idle")
  const [label, setLabel] = useState("+100")
  const [popAt] = useState(() => ({ t: 0 }))
  const taken = useRef(false)

  useFrame((_, dt) => {
    const node = mesh.current
    if (!node || state === "gone") return
    node.rotation.y += dt * (gem.golden ? 0.9 : 1.4)
    if (state === "pop") {
      const t = (performance.now() - popAt.t) / 380
      const s = t < 0.25 ? 1 + t : Math.max(0.01, 1.2 - t * 1.4)
      node.scale.setScalar(s)
    }
  })

  if (state === "gone") {
    return <Burst position={gem.position} color={gem.color} text={label} count={6} life={0.4} spread={1.1} />
  }

  return (
    <group>
      <RigidBody type="fixed" position={gem.position} colliders={false} sensor>
        <BallCollider
          args={[gem.golden ? 0.2 : 0.15]}
          sensor
          onIntersectionEnter={(payload) => {
            if (taken.current || phaseRef.current !== "running") return
            if (payload.other.rigidBodyObject?.name !== "marble-body") return
            taken.current = true
            const base = gem.golden ? GOLD_POINTS : GEM_POINTS
            const gained = award(base, "gem")
            getAudio().playGem(gem.position[0], Boolean(gem.golden))
            setLabel(`+${gained}`)
            popAt.t = performance.now()
            setState("pop")
            window.setTimeout(() => setState("gone"), 360)
          }}
        />
      </RigidBody>
      <group ref={mesh} position={gem.position}>
        <mesh>
          <sphereGeometry args={[gem.golden ? 0.16 : 0.11, 20, 16]} />
          <meshPhysicalMaterial
            color={gem.color}
            roughness={gem.golden ? 0.05 : 0.08}
            metalness={gem.golden ? 0.35 : 0.04}
            transmission={0.72}
            thickness={0.4}
            emissive={gem.color}
            emissiveIntensity={gem.golden ? 0.45 : 0.22}
            clearcoat={1}
          />
        </mesh>
      </group>
    </group>
  )
}

function GlassTarget({ target }: { target: GlassSpot }) {
  const { award, phase } = useGame()
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [cracked, setCracked] = useState(false)
  const [broken, setBroken] = useState(false)
  const [label, setLabel] = useState("+250")
  const hit = useRef(false)

  if (broken) {
    return <Burst position={target.position} color={target.color} text={label} count={8} life={1.3} spread={2.2} />
  }

  return (
    <RigidBody type="fixed" position={target.position} quaternion={target.quaternion} colliders={false} sensor>
      <CuboidCollider
          args={[0.38, 0.3, 0.2]}
          sensor
          onIntersectionEnter={(payload) => {
            if (hit.current || phaseRef.current !== "running") return
            const body = payload.other.rigidBody
            if (payload.other.rigidBodyObject?.name !== "marble-body" || !body) return
            const v = body.linvel()
            const speed = Math.hypot(v.x, v.y, v.z)
            if (speed < 1.15) return
            if (!cracked && speed < 3.6) {
              setCracked(true)
              return
            }
            hit.current = true
            const gained = award(GLASS_POINTS, "glass")
            setLabel(`+${gained}`)
            getAudio().playGlassBreak(target.position[0])
            setBroken(true)
          }}
        />
      <mesh>
        <boxGeometry args={[0.62, 0.46, 0.035]} />
        <meshPhysicalMaterial
          color={cracked ? "#ffffff" : target.color}
          transparent
          opacity={cracked ? 0.45 : 0.62}
          roughness={0.04}
          transmission={0.86}
          thickness={0.2}
          emissive={target.color}
          emissiveIntensity={cracked ? 0.05 : 0.18}
        />
      </mesh>
      {cracked ? (
        <mesh position={[0.02, 0, 0.02]}>
          <boxGeometry args={[0.5, 0.02, 0.01]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      ) : null}
    </RigidBody>
  )
}
