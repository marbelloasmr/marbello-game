import { Suspense, useEffect, useState, useSyncExternalStore } from "react"
import { Canvas } from "@react-three/fiber"
import { Physics } from "@react-three/rapier"
import { ACESFilmicToneMapping } from "three"
import { gameConfig } from "@/config/gameConfig"
import { CameraRig } from "@/game/CameraRig"
import { FinishSensor, Marble } from "@/game/Marble"
import { MarblePlacer } from "@/game/MarblePlacer"
import { ScorePickups } from "@/game/ScorePickups"
import { BoostPad } from "@/game/BoostPad"
import { Track } from "@/game/Track"
import { MarbelloWorld } from "@/game/MarbelloWorld"
import { CAMERA_HOME } from "@/game/trackLayout"
import { isPaused, subscribePause } from "@/game/pause"
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
  const paused = useSyncExternalStore(subscribePause, isPaused, () => false)
  useEffect(() => {
    trackEvent("game_loaded")
  }, [])

  return (
    <Canvas
      className="h-full w-full touch-none"
      shadows
      dpr={fancy ? [1, 1.5] : [1, 1.1]}
      camera={{ position: CAMERA_HOME.position, fov: 36, near: 0.08, far: 160 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#e7f4fc"]} />
      <fog attach="fog" args={["#f4f9fc", 40, 130]} />
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
          paused={paused}
          numSolverIterations={8}
          maxCcdSubsteps={4}
          updatePriority={-2}
        >
          <Track fancy={fancy} />
          <ScorePickups />
          <BoostPad />
          <Marble fancy={fancy} />
          <FinishSensor />
        </Physics>
        <MarbelloWorld />
      </Suspense>
      <CameraRig />
      <MarblePlacer />
    </Canvas>
  )
}
