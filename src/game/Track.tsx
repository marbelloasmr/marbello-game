import { useMemo } from "react"
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier"
import { Matrix4, Quaternion, Vector3 } from "three"
import { START_ZONE, TRACK_PIECES, type TrackPiece } from "@/game/trackLayout"
import { SURFACE_PHYSICS, type Surface } from "@/physics/materials"

const COLOR: Record<Surface, string> = {
  wood: "#d3924e",
  metal: "#e7eef5",
  glass: "#d7f6ff",
  acrylic: "#eefcff",
}

function materialProps(surface: Surface, fancy: boolean) {
  if (surface === "wood") {
    return { color: COLOR.wood, roughness: 0.62, metalness: 0.04, transmission: 0, transparent: false, opacity: 1 }
  }
  if (surface === "metal") {
    return { color: COLOR.metal, roughness: 0.22, metalness: 0.92, transmission: 0, transparent: false, opacity: 1 }
  }
  if (!fancy) {
    return {
      color: surface === "glass" ? "#bfefff" : "#f4fdff",
      roughness: 0.08,
      metalness: 0.05,
      transmission: 0,
      transparent: true,
      opacity: 0.45,
    }
  }
  return {
    color: COLOR[surface],
    roughness: 0.06,
    metalness: 0.02,
    transmission: surface === "glass" ? 0.85 : 0.72,
    transparent: true,
    opacity: 1,
    thickness: 0.4,
    ior: 1.45,
  }
}

function Piece({ piece, fancy }: { piece: TrackPiece; fancy: boolean }) {
  const phys = SURFACE_PHYSICS[piece.material]
  const look = materialProps(piece.material, fancy)
  if (piece.kind === "cylinder") {
    return (
      <RigidBody type="fixed" colliders={false} position={piece.position} userData={{ material: piece.material }}>
        <CylinderCollider args={[piece.height / 2, piece.radius]} friction={phys.friction} restitution={phys.restitution} />
        <mesh name="track-surface" castShadow receiveShadow>
          <cylinderGeometry args={[piece.radius, piece.radius, piece.height, 18]} />
          <meshPhysicalMaterial {...look} />
        </mesh>
      </RigidBody>
    )
  }
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={piece.position}
      quaternion={piece.quaternion}
      userData={{ material: piece.material }}
    >
      <CuboidCollider
        args={[piece.size[0] / 2, piece.size[1] / 2, piece.size[2] / 2]}
        friction={phys.friction}
        restitution={phys.restitution}
      />
      <mesh name="track-surface" castShadow receiveShadow>
        <boxGeometry args={piece.size} />
        <meshPhysicalMaterial {...look} />
      </mesh>
    </RigidBody>
  )
}

export function Track({ fancy }: { fancy: boolean }) {
  return (
    <group>
      {TRACK_PIECES.map((piece) => (
        <Piece key={piece.id} piece={piece} fancy={fancy} />
      ))}
      <StartWalls />
      <RigidBody type="fixed" colliders={false} position={[2, -0.12, 3]} userData={{ material: "wood" }}>
        <CuboidCollider args={[16, 0.12, 14]} friction={0.6} restitution={0.05} />
        <mesh receiveShadow>
          <boxGeometry args={[32, 0.24, 28]} />
          <meshStandardMaterial color="#e7d3b0" roughness={0.85} metalness={0.02} />
        </mesh>
      </RigidBody>
    </group>
  )
}

function StartWalls() {
  const walls = useMemo(() => {
    const pts = START_ZONE.points
    const height = 8.2
    const thick = 0.14
    const sideOff = 0.5
    const up = new Vector3(0, 1, 0)
    const built: { pos: [number, number, number]; quat: [number, number, number, number]; size: [number, number, number] }[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new Vector3(...pts[i]!)
      const b = new Vector3(...pts[i + 1]!)
      const delta = b.clone().sub(a)
      const len = delta.length()
      const dir = delta.multiplyScalar(1 / len)
      const flat = new Vector3(dir.x, 0, dir.z)
      if (flat.lengthSq() < 1e-6) continue
      flat.normalize()
      const side = new Vector3().crossVectors(up, flat).normalize()
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, up, flat))
      const quat: [number, number, number, number] = [q.x, q.y, q.z, q.w]
      for (const sign of [-1, 1] as const) {
        const p = mid.clone().addScaledVector(side, sign * sideOff)
        built.push({
          pos: [p.x, mid.y + height * 0.5 - 0.4, p.z],
          quat,
          size: [thick, height, len + 0.2],
        })
      }
    }
    const a = new Vector3(...pts[0]!)
    const b = new Vector3(...pts[1]!)
    const forward = b.clone().sub(a)
    forward.y = 0
    forward.normalize()
    const side = new Vector3().crossVectors(up, forward).normalize()
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(forward, up, side))
    const back = a.clone().addScaledVector(forward, -0.22)
    built.push({
      pos: [back.x, a.y + height * 0.5 - 0.4, back.z],
      quat: [q.x, q.y, q.z, q.w],
      size: [thick, height, sideOff * 2 + 0.24],
    })
    return built
  }, [])
  return (
    <group>
      {walls.map((wall, index) => (
        <RigidBody key={index} type="fixed" colliders={false} position={wall.pos} quaternion={wall.quat} userData={{ silent: true }}>
          <CuboidCollider args={[wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2]} friction={0.35} restitution={0.04} />
        </RigidBody>
      ))}
    </group>
  )
}
