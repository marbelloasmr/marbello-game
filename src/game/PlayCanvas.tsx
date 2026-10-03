import { Suspense, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { Physics } from "@react-three/rapier"
import { ACESFilmicToneMapping } from "three"
import { gameConfig } from "@/config/gameConfig"
import { CameraRig } from "@/game/CameraRig"
import { FinishSensor, Marble } from "@/game/Marble"
import { MarblePlacer } from "@/game/MarblePlacer"
import { ScorePickups } from "@/game/ScorePickups"
import { Track } from "@/game/Track"
import { CAMERA_HOME } from "@/game/trackLayout"
import { trackEvent } from "@/utils/analytics"

function useFancy() {
  const [fancy, setFancy] = useState(true)
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches
    const narrow = window.innerWidth < 800
    const cores = navigator.hardwareConcurrency || 8
    setFancy(!(coarse || narrow || cores <= 4))
  }, [])
  return fancy
}

export function PlayCanvas() {
  const fancy = useFancy()
  useEffect(() => {
    trackEvent("game_loaded")
  }, [])

  return (
    <Canvas
      className="h-full w-full touch-none"
      shadows
      dpr={fancy ? [1, 1.5] : [1, 1.1]}
      camera={{ position: CAMERA_HOME.position, fov: 36, near: 0.08, far: 90 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#c5ebfb"]} />
      <fog attach="fog" args={["#d7f3ff", 22, 52]} />
      <hemisphereLight args={["#f4fbff", "#efd2a4", 0.95]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 16, 10]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={fancy ? 1024 : 512}
        shadow-mapSize-height={fancy ? 1024 : 512}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-camera-left={-16}
        shadow-camera-right={18}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.00035}
      />
      <directionalLight position={[-8, 7, -2]} intensity={0.55} color="#ff8ed2" />
      <directionalLight position={[6, 5, -8]} intensity={0.45} color="#7ce8ff" />
      <Suspense fallback={null}>
        <Physics
          gravity={[0, gameConfig.gravity, 0]}
          timeStep={1 / 60}
          numSolverIterations={8}
          maxCcdSubsteps={4}
          updatePriority={-2}
        >
          <Track fancy={fancy} />
          <ScorePickups />
          <Marble fancy={fancy} />
          <FinishSensor />
          <Studio />
        </Physics>
      </Suspense>
      <CameraRig />
      <MarblePlacer />
    </Canvas>
  )
}

function Studio() {
  return (
    <group>
      <mesh position={[-2, 4.2, -8]} rotation={[0, 0.15, 0]}>
        <planeGeometry args={[22, 9]} />
        <meshStandardMaterial color="#e9f7ff" roughness={0.4} />
      </mesh>
      <mesh position={[14, 3.6, 2]} rotation={[0, -0.7, 0]}>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial color="#f3fbff" roughness={0.45} />
      </mesh>
      {[
        [-9, 6.2],
        [12, 8],
        [-2, 10],
        [16, -2],
      ].map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x!, 0.15, z!]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.9, 8]} />
            <meshStandardMaterial color="#5f9a52" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.42, 16, 12]} />
            <meshStandardMaterial color="#79c866" roughness={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
