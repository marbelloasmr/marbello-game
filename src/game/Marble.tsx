import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { BallCollider, CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier"
import { CanvasTexture, SRGBColorSpace, type Mesh } from "three"
import { marbleById, type MarblePattern } from "@/data/marbleTypes"
import { getAudio } from "@/audio/AudioEngine"
import { FINISH_POSITION } from "@/game/trackLayout"
import { marblePose } from "@/game/marblePose"
import { aimedStart, marbleApi, spawn } from "@/game/spawn"
import { useGame } from "@/game/state"
import { gameConfig } from "@/config/gameConfig"
import type { Surface } from "@/physics/materials"
import { cameraShake } from "@/game/CameraRig"
import { watchStuck } from "@/game/stuck"

function gloss(ctx: CanvasRenderingContext2D) {
  const shine = ctx.createRadialGradient(78, 68, 6, 128, 120, 150)
  shine.addColorStop(0, "rgba(255,255,255,0.72)")
  shine.addColorStop(0.35, "rgba(255,255,255,0.08)")
  shine.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = shine
  ctx.fillRect(0, 0, 256, 256)
}

function paintTexture(mode: Exclude<MarblePattern, "solid">, a: string, b: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = a
  ctx.fillRect(0, 0, 256, 256)
  if (mode === "speckle") {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 4 === 0 ? "#7eb6ff" : i % 3 === 0 ? "#2436f2" : b
      ctx.beginPath()
      ctx.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 8, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (mode === "flower") {
    const petals: Array<[number, number, string, number]> = [
      [92, 108, "#ff4fa3", 34],
      [164, 104, "#1a32f0", 34],
      [88, 164, "#22c41c", 30],
      [168, 166, "#5ad7ff", 30],
      [128, 78, "#ffe56a", 22],
      [128, 178, "#ff4fa3", 20],
    ]
    for (const [x, y, color, radius] of petals) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = "#ffe56a"
    ctx.beginPath()
    ctx.arc(128, 128, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.arc(128, 128, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (mode === "stripe") {
    ctx.save()
    ctx.translate(128, 128)
    ctx.rotate(-0.7)
    for (let i = -8; i <= 8; i++) {
      ctx.fillStyle = i % 3 === 0 ? b : i % 3 === 1 ? "#7af0ff" : a
      ctx.fillRect(-180, i * 18 - 8, 360, i % 3 === 2 ? 8 : 12)
    }
    ctx.restore()
  } else {
    ctx.lineCap = "round"
    ctx.strokeStyle = b
    ctx.lineWidth = 18
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(128, 128, 28 + i * 26, i * 0.7, i * 0.7 + 3.2)
      ctx.stroke()
    }
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(96, 118, 72, 0.3, 2.5)
    ctx.stroke()
    ctx.strokeStyle = "#7af0ff"
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(150, 140, 58, 2.2, 4.6)
    ctx.stroke()
  }
  gloss(ctx)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function shadowTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
  gradient.addColorStop(0, "rgba(10, 36, 58, 0.62)")
  gradient.addColorStop(1, "rgba(20, 40, 70, 0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const contactMap = typeof document !== "undefined" ? shadowTexture() : null

export function Marble({ fancy }: { fancy: boolean }) {
  const body = useRef<RapierRigidBody>(null)
  const shade = useRef<Mesh>(null)
  const aimMark = useRef<Mesh>(null)
  const { phase, marbleId, runId, registerImpact, miss } = useGame()
  const marble = marbleById(marbleId)
  const live = phase === "running" || phase === "done"
  const texture = useMemo(() => {
    if (marble.pattern === "solid") return null
    return paintTexture(marble.pattern, marble.color, marble.accent)
  }, [marble])

  const placed = spawn.custom
  const aimed = aimedStart()
  const start = placed ? ([spawn.x, spawn.y, spawn.z] as const) : ([aimed.x, aimed.y, aimed.z] as const)
  const kickedRun = useRef("")

  useFrame(() => {
    const current = body.current
    if (!current || phase !== "running") return
    const token = String(runId)
    if (kickedRun.current === token) return
    if (!spawn.custom) {
      kickedRun.current = token
      return
    }
    current.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true)
    current.setLinvel({ x: spawn.vx, y: spawn.vy, z: spawn.vz }, true)
    kickedRun.current = token
  }, -3)

  useFrame(() => {
    const current = body.current
    if (!current) {
      marblePose.on = false
      marblePose.vx = 0
      marblePose.vy = 0
      marblePose.vz = 0
      return
    }
    const p = current.translation()
    const v = current.linvel()
    marblePose.x = p.x
    marblePose.y = p.y
    marblePose.z = p.z
    marblePose.vx = v.x
    marblePose.vy = v.y
    marblePose.vz = v.z
    marblePose.on = true
    if (shade.current) {
      const flying = Math.abs(v.y) > 2.4
      shade.current.visible = !flying
      shade.current.position.set(p.x, p.y - gameConfig.marbleRadius - 0.015, p.z)
    }
    if (aimMark.current) {
      aimMark.current.visible = phase === "ready"
      aimMark.current.position.set(p.x, p.y - gameConfig.marbleRadius - 0.01, p.z)
    }
    watchStuck(phase, p.x, p.y, p.z, performance.now())
    marbleApi.body = current
    if (import.meta.env.DEV) {
      const w = window as unknown as { __marble?: { x: number; y: number; z: number; phase: string } }
      w.__marble = { x: marblePose.x, y: marblePose.y, z: marblePose.z, phase }
    }
    if (phase === "running" && p.y < gameConfig.missBelow) miss()
  }, -1)

  return (
    <>
    <mesh ref={aimMark} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <ringGeometry args={[0.1, 0.15, 28]} />
      <meshBasicMaterial color="#f3d27a" transparent opacity={0.7} depthWrite={false} />
    </mesh>
    <mesh ref={shade} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <circleGeometry args={[0.22, 16]} />
      <meshBasicMaterial map={contactMap} transparent depthWrite={false} />
    </mesh>
    <RigidBody
      ref={body}
      key={`${runId}-${marbleId}-${live ? "go" : "hold"}`}
      name="marble-body"
      position={[start[0], start[1], start[2]]}
      colliders={false}
      type={live ? "dynamic" : "fixed"}
      ccd
      canSleep={false}
      mass={gameConfig.marbleMass}
      linearDamping={0.08}
      angularDamping={0.08}
      onCollisionEnter={(payload) => {
        if (payload.other.rigidBodyObject?.userData?.silent) return
        const material = payload.other.rigidBodyObject?.userData?.material as Surface | undefined
        if (!material) return
        const velocity = payload.target.rigidBody?.linvel()
        const speed = velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : 0
        const where = payload.target.rigidBody?.translation()
        getAudio().playImpact(material, speed, where?.x ?? 0)
        registerImpact(speed)
        if (speed > 2.4) cameraShake.current = Math.min(0.12, speed * 0.012)
      }}
    >
      <BallCollider args={[gameConfig.marbleRadius]} friction={0.03} restitution={0.22} />
      <mesh name="play-marble" castShadow>
        <sphereGeometry args={[gameConfig.marbleRadius, fancy ? 48 : 28, fancy ? 32 : 20]} />
        <meshPhysicalMaterial
          color={texture ? "#ffffff" : marble.color}
          map={texture}
          roughness={marble.roughness}
          metalness={marble.metalness}
          transmission={fancy ? marble.transmission : Math.min(0.35, marble.transmission)}
          thickness={fancy ? marble.thickness : 0.2}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationColor={marble.accent}
          attenuationDistance={0.45}
        />
      </mesh>
      <mesh renderOrder={20} scale={1.002} raycast={() => null}>
        <sphereGeometry args={[gameConfig.marbleRadius, fancy ? 32 : 20, fancy ? 24 : 16]} />
        <meshPhysicalMaterial
          color={texture ? "#ffffff" : marble.color}
          map={texture}
          roughness={marble.roughness}
          metalness={marble.metalness}
          transparent
          opacity={1}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={1.2}
          transmission={0}
        />
      </mesh>
      {live ? null : (
        <mesh name="place-handle">
          <sphereGeometry args={[1.2, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </RigidBody>
    </>
  )
}

export function FinishSensor() {
  const { finish } = useGame()
  return (
    <RigidBody type="fixed" colliders={false} position={FINISH_POSITION} sensor>
      <CuboidCollider
        args={[0.42, 0.28, 0.42]}
        sensor
        onIntersectionEnter={(payload) => {
          if (payload.other.rigidBodyObject?.name === "marble-body") finish()
        }}
      />
    </RigidBody>
  )
}
