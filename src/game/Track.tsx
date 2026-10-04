import { useMemo } from "react"
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier"
import { BackSide, DoubleSide, FrontSide, Matrix4, MeshPhysicalMaterial, Quaternion, Vector3, type Side } from "three"
import { START_ZONE, TRACK_PIECES, ZONES, type TrackPiece } from "@/game/trackLayout"
import { SURFACE_PHYSICS, type Surface } from "@/physics/materials"

const COLOR: Record<Surface, string> = {
  wood: "#d3924e",
  metal: "#e7eef5",
  glass: "#d7f6ff",
  acrylic: "#eefcff",
}

function makeAcrylic(opacity: number, color: string, side: Side, sheen = false) {
  const mat = new MeshPhysicalMaterial({
    color,
    roughness: sheen ? 0.045 : 0.12,
    metalness: 0.02,
    transparent: true,
    opacity,
    depthWrite: false,
    side,
    clearcoat: sheen ? 1 : 0.55,
    clearcoatRoughness: sheen ? 0.04 : 0.2,
    reflectivity: sheen ? 0.72 : 0.35,
    envMapIntensity: sheen ? 1.65 : 0.7,
    transmission: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const shine = sheen ? "0.22" : "0.16"
  const edge = sheen ? "0.16" : "0.22"
  const cap = sheen ? "0.58" : "0.4"
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(-vViewPosition)), 0.0, 1.0), 2.4);
        gl_FragColor.rgb += vec3(0.93, 0.97, 1.0) * fres * ${shine};
        gl_FragColor.a = clamp(gl_FragColor.a + fres * ${edge}, 0.0, ${cap});
        #include <dithering_fragment>
      `,
    )
  }
  return mat
}

function materialProps(surface: Surface) {
  if (surface === "wood") {
    return { color: COLOR.wood, roughness: 0.62, metalness: 0.04, transmission: 0, transparent: false, opacity: 1 }
  }
  if (surface === "metal") {
    return { color: COLOR.metal, roughness: 0.22, metalness: 0.92, transmission: 0, transparent: false, opacity: 1 }
  }
  return null
}

const iceFloor = makeAcrylic(0.42, "#e5f6ff", FrontSide, true)
const floorUnder = new MeshPhysicalMaterial({
  color: "#d5eefb",
  roughness: 0.2,
  metalness: 0,
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
  side: BackSide,
  clearcoat: 0.4,
  clearcoatRoughness: 0.2,
})
const clearWall = makeAcrylic(0.14, "#f7fdff", DoubleSide, false)

function Piece({ piece }: { piece: TrackPiece; fancy: boolean }) {
  const phys = SURFACE_PHYSICS[piece.material]
  const look = materialProps(piece.material)
  const acrylic = piece.material === "glass" || piece.material === "acrylic"
  const floor = acrylic && piece.kind === "box" && piece.id.includes("-f-")
  const sheet = acrylic ? (floor ? iceFloor : clearWall) : null
  if (piece.kind === "cylinder") {
    return (
      <RigidBody type="fixed" colliders={false} position={piece.position} userData={{ material: piece.material }}>
        <CylinderCollider args={[piece.height / 2, piece.radius]} friction={phys.friction} restitution={phys.restitution} />
        <mesh name="track-surface" castShadow receiveShadow material={sheet ?? undefined}>
          <cylinderGeometry args={[piece.radius, piece.radius, piece.height, 18]} />
          {sheet ? null : <meshPhysicalMaterial {...look!} />}
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
      {piece.id.startsWith("bowl") || piece.id === "backstop" ? null : (
        <group>
          <mesh name="track-surface" castShadow receiveShadow material={sheet ?? undefined}>
            <boxGeometry args={piece.size} />
            {sheet ? null : <meshPhysicalMaterial {...look!} />}
          </mesh>
          {floor ? (
            <mesh material={floorUnder}>
              <boxGeometry args={piece.size} />
            </mesh>
          ) : null}
        </group>
      )}
    </RigidBody>
  )
}

export function Track({ fancy }: { fancy: boolean }) {
  return (
    <group>
      {TRACK_PIECES.map((piece) => (
        <Piece key={piece.id} piece={piece} fancy={fancy} />
      ))}
      <MarbleJar fancy={fancy} />
      <StartWalls />
      <RigidBody type="fixed" colliders={false} position={[2, -0.12, 3]} userData={{ material: "wood" }}>
        <CuboidCollider args={[16, 0.12, 14]} friction={0.6} restitution={0.05} />
        <mesh receiveShadow>
          <boxGeometry args={[32, 0.24, 28]} />
          <meshStandardMaterial color="#eef3f8" roughness={0.78} metalness={0.02} />
        </mesh>
      </RigidBody>
    </group>
  )
}

function MarbleJar({ fancy }: { fancy: boolean }) {
  const [x, y, z] = ZONES.bowl
  const fill = useMemo(() => {
    const colors = ["#1a32f0", "#e21814", "#22c41c", "#f6c431", "#d22ad8", "#7fd4ff", "#ff4fa3", "#ffe56a", "#3ec6ff", "#ff9a1a", "#b388ff", "#7dffb3"]
    const spots: { position: [number, number, number]; color: string; radius: number }[] = []
    const rings = [6, 5, 3]
    rings.forEach((count, layer) => {
      const radius = 0.11 + (layer === 2 ? 0.02 : 0)
      const ring = 0.42 - layer * 0.08
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + layer * 0.4
        spots.push({
          position: [Math.cos(a) * ring, 0.08 + radius + layer * 0.16, Math.sin(a) * ring],
          color: colors[(i + layer * 3) % colors.length]!,
          radius,
        })
      }
    })
    return spots
  }, [])
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.92, 0.8, 0.78, 36, 1, true]} />
        <meshStandardMaterial color="#e9fbff" roughness={0.12} metalness={0} transparent opacity={0.28} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.045, 10, 36]} />
        <meshStandardMaterial color="#f4feff" roughness={0.16} metalness={0.05} transparent opacity={0.45} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.8, 0.86, 0.08, 28]} />
        <meshStandardMaterial color="#d7f4ff" roughness={0.25} transparent opacity={0.55} />
      </mesh>
      {fill.map((ball, index) => (
        <mesh key={index} position={ball.position} castShadow>
          <sphereGeometry args={[ball.radius, 20, 16]} />
          <meshPhysicalMaterial
            color={ball.color}
            roughness={0.08}
            metalness={0.05}
            transmission={fancy ? 0.55 : 0}
            thickness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </mesh>
      ))}
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
