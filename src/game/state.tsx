import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DEFAULT_MARBLE, type MarbleId } from "@/data/marbleTypes"
import { getAudio } from "@/audio/AudioEngine"
import { trackEvent } from "@/utils/analytics"

export type Phase = "ready" | "running" | "done" | "missed"

export const runClock = { t0: 0 }

type GameContextValue = {
  phase: Phase
  marbleId: MarbleId
  runId: number
  impacts: number
  seconds: number | null
  sound: boolean
  selectMarble: (id: MarbleId) => void
  drop: () => void
  again: () => void
  finish: () => void
  miss: () => void
  registerImpact: (speed: number) => void
  toggleSound: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("ready")
  const [marbleId, setMarbleId] = useState<MarbleId>(DEFAULT_MARBLE)
  const [runId, setRunId] = useState(0)
  const [impacts, setImpacts] = useState(0)
  const [seconds, setSeconds] = useState<number | null>(null)
  const [sound, setSound] = useState(true)
  const started = useRef<number | null>(null)
  const impactsRef = useRef(0)
  const phaseRef = useRef<Phase>("ready")
  const marbleRef = useRef<MarbleId>(DEFAULT_MARBLE)
  phaseRef.current = phase
  marbleRef.current = marbleId

  useEffect(() => {
    setSound(getAudio().isEnabled)
  }, [])

  const resetGate = useCallback(() => {
    started.current = null
    impactsRef.current = 0
    setImpacts(0)
    setSeconds(null)
    setPhase("ready")
    setRunId((n) => n + 1)
  }, [])

  const selectMarble = useCallback(
    (id: MarbleId) => {
      if (phaseRef.current === "running") return
      if (phaseRef.current !== "ready") resetGate()
      setMarbleId(id)
      trackEvent("marble_changed", { marble: id })
    },
    [resetGate],
  )

  const drop = useCallback(() => {
    if (phaseRef.current === "running") return
    void getAudio().unlock()
    impactsRef.current = 0
    setImpacts(0)
    setSeconds(null)
    started.current = performance.now()
    runClock.t0 = started.current
    setPhase("running")
    trackEvent("marble_dropped", { marble: marbleRef.current })
  }, [])

  const again = useCallback(() => {
    resetGate()
    trackEvent("replay_clicked")
  }, [resetGate])

  const finish = useCallback(() => {
    if (phaseRef.current !== "running" || started.current == null) return
    const elapsed = (performance.now() - started.current) / 1000
    setImpacts(impactsRef.current)
    setSeconds(elapsed)
    setPhase("done")
    trackEvent("run_completed", { seconds: Math.round(elapsed * 100) / 100, impacts: impactsRef.current })
  }, [])

  const miss = useCallback(() => {
    if (phaseRef.current !== "running" || started.current == null) return
    const elapsed = (performance.now() - started.current) / 1000
    setImpacts(impactsRef.current)
    setSeconds(elapsed)
    setPhase("missed")
  }, [])

  const registerImpact = useCallback((speed: number) => {
    if (phaseRef.current !== "running" || speed < 0.45) return
    impactsRef.current += 1
  }, [])

  const toggleSound = useCallback(() => {
    setSound((on) => {
      const next = !on
      getAudio().setEnabled(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      phase,
      marbleId,
      runId,
      impacts,
      seconds,
      sound,
      selectMarble,
      drop,
      again,
      finish,
      miss,
      registerImpact,
      toggleSound,
    }),
    [phase, marbleId, runId, impacts, seconds, sound, selectMarble, drop, again, finish, miss, registerImpact, toggleSound],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error("useGame outside provider")
  return ctx
}
