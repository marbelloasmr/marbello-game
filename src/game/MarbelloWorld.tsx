import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { BackSide, CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from "three"

const wood = new MeshStandardMaterial({ color: "#f0ddc0", roughness: 0.62 })
const pale = new MeshStandardMaterial({ color: "#e7f3f8", roughness: 0.55 })
const hazeCyan = new MeshStandardMaterial({ color: "#d5eef6", roughness: 0.4, transparent: true, opacity: 0.45 })

function skyTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 8
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, "#cfe8f8")
  gradient.addColorStop(0.46, "#eaf6fc")
  gradient.addColorStop(1, "#fffaf4")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 8, 256)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function MarbelloWorld() {
  const sky = useMemo(skyTexture, [])
  return (
    <group>
      <mesh>
        <sphereGeometry args={[110, 16, 10]} />
        <meshBasicMaterial map={sky} side={BackSide} />
      </mesh>
      <Clouds />
      <LowerHaze />
      <DistantTower />
      <DistantRing />
      <DistantLoop />
    </group>
  )
}

function Clouds() {
  const puffs: [number, number, number, number][] = [
    [-28, 24, -36, 3.2],
    [22, 22, -42, 2.6],
    [8, 28, 34, 2.8],
    [-40, 18, 16, 2.2],
  ]
  return (
    <group>
      {puffs.map(([x, y, z, r]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 8]} />
          <meshBasicMaterial color="#f7fbff" transparent opacity={0.42} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function LowerHaze() {
  return (
    <mesh position={[0, -18, 4]} scale={[1.4, 0.16, 1.1]}>
      <sphereGeometry args={[34, 12, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
    </mesh>
  )
}

function DistantTower() {
  return (
    <group position={[-62, -6, -36]}>
      <mesh position={[0, 6, 0]} material={wood}>
        <cylinderGeometry args={[1.2, 1.8, 12, 8]} />
      </mesh>
      <mesh position={[0, 11, 0]} material={hazeCyan}>
        <torusGeometry args={[2.4, 0.14, 6, 14]} />
      </mesh>
      <mesh position={[0, 8, 0]} material={pale}>
        <torusGeometry args={[2.1, 0.1, 6, 14]} />
      </mesh>
    </group>
  )
}

function DistantRing() {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.z += delta * 0.04
  })
  const colors = ["#f4f7f8", "#d5eef5", "#f3d5e2", "#f6e3c4"]
  return (
    <group ref={group} position={[6, 16, -78]}>
      {colors.map((color, index) => (
        <mesh key={color}>
          <torusGeometry args={[5.5 - index * 0.4, 0.07, 6, 28]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function DistantLoop() {
  return (
    <mesh position={[68, 2, 22]} rotation={[0.5, 0.2, 0.1]} material={hazeCyan}>
      <torusGeometry args={[4.5, 0.16, 6, 18]} />
    </mesh>
  )
}
