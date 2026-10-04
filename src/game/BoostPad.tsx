import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CuboidCollider, RigidBody } from "@react-three/rapier"
import type { RapierRigidBody } from "@react-three/rapier"
import { RigidBodyType } from "@dimforge/rapier3d-compat"
import { Group, Quaternion, Vector3 } from "three"
import { getAudio } from "@/audio/AudioEngine"
import { SPIRAL_BONUS, SPIRAL_BOOST, SPIRAL_LIFT, type V3 } from "@/game/trackLayout"
import { useGame } from "@/game/state"

const LIFT_SPEED = 1.35

function along(points: V3[], distance: number) {
  let left = distance
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = Math.hypot(dx, dy, dz) || 0.0001
    if (left <= len) {
      const t = left / len
      return {
        x: a[0] + dx * t,
        y: a[1] + dy * t,
        z: a[2] + dz * t,
        dx: dx / len,
        dy: dy / len,
        dz: dz / len,
        done: false,
      }
    }
    left -= len
  }
  const last = points[points.length - 1]!
  const prev = points[points.length - 2] ?? last
  const dx = last[0] - prev[0]
  const dy = last[1] - prev[1]
  const dz = last[2] - prev[2]
  const len = Math.hypot(dx, dy, dz) || 1
  return { x: last[0], y: last[1], z: last[2], dx: dx / len, dy: dy / len, dz: dz / len, done: true }
}

export function BoostPad() {
  const { award, phase, runId } = useGame()
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const bonusTaken = useRef(false)
  const liftUsed = useRef(false)
  const stripes = useRef<Group>(null)
  const hook = useRef<Group>(null)
  const ride = useRef<{ body: RapierRigidBody; distance: number } | null>(null)
  const [bonusGone, setBonusGone] = useState(false)
  const cable = useMemo(() => {
    const up = new Vector3(0, 1, 0)
    const dir = new Vector3()
    const q = new Quaternion()
    return SPIRAL_LIFT.slice(0, -1).map((a, index) => {
      const b = SPIRAL_LIFT[index + 1]!
      dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const len = dir.length() || 0.001
      dir.multiplyScalar(1 / len)
      q.setFromUnitVectors(up, dir)
      return {
        position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.16, (a[2] + b[2]) / 2] as V3,
        quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
        len,
      }
    })
  }, [])

  useEffect(() => {
    const riding = ride.current
    if (riding) {
      riding.body.setBodyType(RigidBodyType.Dynamic, true)
      ride.current = null
    }
    bonusTaken.current = false
    liftUsed.current = false
    setBonusGone(false)
  }, [runId])

  useFrame((_, dt) => {
    const node = stripes.current
    if (node) node.position.z = ((node.position.z + dt * 0.35) % 0.18) - 0.09
    const riding = ride.current
    if (!riding) return
    riding.distance += Math.min(dt, 0.05) * LIFT_SPEED
    const at = along(SPIRAL_LIFT, riding.distance)
    const hookNode = hook.current
    if (hookNode) hookNode.position.set(at.x, at.y + 0.16, at.z)
    if (at.done) {
      riding.body.setBodyType(RigidBodyType.Dynamic, true)
      riding.body.setLinvel({ x: at.dx * 0.7, y: at.dy * 0.7, z: at.dz * 0.7 }, true)
      riding.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      ride.current = null
      return
    }
    riding.body.setNextKinematicTranslation({ x: at.x, y: at.y, z: at.z })
  }, -3)

  return (
    <group>
      {cable.map((span, index) => (
        <mesh key={index} position={span.position} quaternion={span.quaternion}>
          <cylinderGeometry args={[0.012, 0.012, span.len, 6]} />
          <meshStandardMaterial color="#7af0ff" emissive="#3ee0ff" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <group ref={hook} position={SPIRAL_BOOST.position}>
        <mesh>
          <torusGeometry args={[0.16, 0.018, 8, 16]} />
          <meshStandardMaterial color="#ff4fa3" emissive="#ff4fa3" emissiveIntensity={0.45} />
        </mesh>
      </group>
      <group position={SPIRAL_BOOST.position} quaternion={SPIRAL_BOOST.quaternion}>
        <mesh>
          <boxGeometry args={[0.78, 0.028, 0.36]} />
          <meshStandardMaterial color="#3ef0ff" emissive="#1ad4e8" emissiveIntensity={0.85} roughness={0.22} metalness={0.15} />
        </mesh>
        <mesh position={[-0.39, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.36, 10]} />
          <meshStandardMaterial color="#ff4fa3" emissive="#ff4fa3" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.39, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.36, 10]} />
          <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={0.4} />
        </mesh>
        <group ref={stripes}>
          {[-0.12, 0, 0.12].map((z) => (
            <mesh key={z} position={[0, 0.016, z]}>
              <boxGeometry args={[0.62, 0.006, 0.035]} />
              <meshBasicMaterial color={z === 0 ? "#fff4b0" : "#ff4fa3"} />
            </mesh>
          ))}
        </group>
        <RigidBody type="fixed" colliders={false} sensor>
          <CuboidCollider
            args={[0.4, 0.16, 0.22]}
            sensor
            onIntersectionEnter={(payload) => {
              if (phaseRef.current !== "running" || liftUsed.current) return
              if (payload.other.rigidBodyObject?.name !== "marble-body") return
              const body = payload.other.rigidBody as RapierRigidBody | null
              if (!body || ride.current) return
              liftUsed.current = true
              const start = SPIRAL_LIFT[0]!
              body.setLinvel({ x: 0, y: 0, z: 0 }, true)
              body.setAngvel({ x: 0, y: 0, z: 0 }, true)
              body.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
              body.setBodyType(RigidBodyType.KinematicPositionBased, true)
              body.setNextKinematicTranslation({ x: start[0], y: start[1], z: start[2] })
              ride.current = { body, distance: 0 }
              getAudio().playGem(SPIRAL_BOOST.position[0], false)
            }}
          />
        </RigidBody>
      </group>
      <RigidBody type="fixed" position={SPIRAL_BONUS.position} colliders={false} sensor>
        <CuboidCollider
          args={[0.16, 0.16, 0.16]}
          sensor
          onIntersectionEnter={(payload) => {
            if (bonusTaken.current || phaseRef.current !== "running") return
            if (payload.other.rigidBodyObject?.name !== "marble-body") return
            bonusTaken.current = true
            award(750, "bonus")
            getAudio().playGem(SPIRAL_BONUS.position[0], true)
            setBonusGone(true)
          }}
        />
      </RigidBody>
      {bonusGone ? null : (
        <mesh position={SPIRAL_BONUS.position}>
          <sphereGeometry args={[0.12, 18, 14]} />
          <meshPhysicalMaterial color="#ff4fa3" emissive="#ffb020" emissiveIntensity={0.55} roughness={0.08} transmission={0.45} thickness={0.3} clearcoat={1} />
        </mesh>
      )}
    </group>
  )
}
