import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier"
import { TRACK_PIECES, type TrackPiece } from "@/game/trackLayout"
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
        <mesh castShadow receiveShadow>
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
      <mesh castShadow receiveShadow>
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
