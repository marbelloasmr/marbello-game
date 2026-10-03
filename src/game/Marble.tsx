import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { BallCollider, CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier"
import { CanvasTexture, SRGBColorSpace, type MeshBasicMaterial } from "three"
import { marbleById } from "@/data/marbleTypes"
import { getAudio } from "@/audio/AudioEngine"
import { FINISH_POSITION, START_POSITION } from "@/game/trackLayout"
import { marblePose } from "@/game/marblePose"
import { marbleApi, sling, spawn } from "@/game/spawn"
import { useGame } from "@/game/state"
import { gameConfig } from "@/config/gameConfig"
import type { Surface } from "@/physics/materials"
import { cameraShake } from "@/game/CameraRig"

function paintTexture(mode: "speckle" | "swirl", a: string, b: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = a
  ctx.fillRect(0, 0, 256, 256)
  if (mode === "speckle") {
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = i % 3 === 0 ? b : "#7eb6ff"
      ctx.beginPath()
      ctx.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 7, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.strokeStyle = b
    ctx.lineWidth = 16
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(128, 128, 30 + i * 22, i, i + 3.4)
      ctx.stroke()
    }
    ctx.strokeStyle = "#7af0ff"
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(90, 110, 70, 0.4, 2.6)
    ctx.stroke()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function Marble({ fancy }: { fancy: boolean }) {
  const body = useRef<RapierRigidBody>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const { phase, marbleId, runId, registerImpact, miss } = useGame()
  const marble = marbleById(marbleId)
  const live = phase === "running" || phase === "done"
  const texture = useMemo(() => {
    if (marble.swirl) return paintTexture("swirl", marble.color, marble.accent)
    if (marble.speckle) return paintTexture("speckle", marble.color, marble.accent)
    return null
  }, [marble])

  const placed = spawn.custom
  const start = placed ? ([spawn.x, spawn.y, spawn.z] as const) : START_POSITION
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
    marbleApi.body = current
    if (ring.current) ring.current.color.set(sling.armed ? "#ffe56a" : "#ff4fa3")
    if (import.meta.env.DEV) {
      const w = window as unknown as { __marble?: { x: number; y: number; z: number; phase: string } }
      w.__marble = { x: marblePose.x, y: marblePose.y, z: marblePose.z, phase }
    }
    if (phase === "running" && p.y < gameConfig.missBelow) miss()
  }, -1)

  return (
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
          color={marble.color}
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
      {live ? null : (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.46, 0.028, 8, 28]} />
            <meshBasicMaterial ref={ring} color="#ff4fa3" transparent opacity={0.9} />
          </mesh>
          <mesh name="place-handle">
            <sphereGeometry args={[1.2, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      )}
    </RigidBody>
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
